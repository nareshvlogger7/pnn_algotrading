const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database'); // Import the database module
const { v4: uuidv4 } = require('uuid'); // Import the UUID function
const { SmartAPI } = require('smartapi-javascript');
const OpeningRangeBreakout = require('./opening_range_breakout'); // Adjust path as necessary
const YesterdayRangeBreakout = require('./yesterday_range_breakout'); // Adjust path as necessary
const { linearRegression, logisticRegression, shouldBuyLR, shouldSellLR, shouldBuyLG, shouldSellLG } = require('./golden_strategies'); // Adjust path as necessary

const app = express();
const port = 3000;
let smartApiInstance = null;
let sessionData = null;
let instrumentList = null; // This will hold your instrument list

app.use(bodyParser.json());

// Route to handle saving user data with unique code
app.post('/save-user', (req, res) => {
    const { clientCode, apiKey, password, totp } = req.body;

    // Generate a unique code
    const uniqueCode = uuidv4(); // This generates a universally unique identifier (UUID)

    // Insert user data into the database with the unique code
    db.run(`INSERT INTO users (client_code, api_key, password, totp, unique_code) VALUES (?, ?, ?, ?, ?)`,
        [clientCode, apiKey, password, totp, uniqueCode], 
        function(err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error', error: err.message });
            }
            res.json({ success: true, message: 'User data saved successfully', userId: this.lastID, uniqueCode: uniqueCode });
        }
    );
});

// Route to handle retrieving user data by unique code
app.get('/get-user/:uniqueCode', (req, res) => {
    const uniqueCode = req.params.uniqueCode;

    // Query to retrieve user data by unique code
    db.get(`SELECT * FROM users WHERE unique_code = ?`, [uniqueCode], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        }
        if (!row) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, userData: row });
    });
});

// Route to handle login (Session generation) using unique code
app.post('/login/:uniqueCode', async (req, res) => {
    const uniqueCode = req.params.uniqueCode;

    // Get the user's data from the database
    db.get(`SELECT * FROM users WHERE unique_code = ?`, [uniqueCode], async (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        }
        if (!row) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const { client_code, api_key, password, totp } = row;

        try {
            smartApiInstance = new SmartAPI({ api_key });
            sessionData = await smartApiInstance.generateSession(client_code, password, totp);

            if (sessionData.status === 'success') {
                instrumentList = await smartApiInstance.getScripMaster(); // Get the instrument list
                res.json({ success: true, message: 'Session generated successfully!' });
            } else {
                res.json({ success: false, message: 'Failed to generate session.' });
            }
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// Route to start backend activities (run strategies)
app.post('/start', async (req, res) => {
    if (!smartApiInstance || !sessionData) {
        return res.status(400).json({ success: false, message: 'Session not initialized' });
    }

    try {
        // Example: Running Opening Range Breakout Strategy
        const orbStrategy = new OpeningRangeBreakout(smartApiInstance);
        const hiLoPrices = {}; // Provide your high-low price mapping here
        const positions = await smartApiInstance.getPosition(); // Fetch current positions
        const openOrders = await smartApiInstance.getOrderBook(); // Fetch open orders
        await orbStrategy.orbStrat(['WIPRO', 'TCS'], hiLoPrices, positions, openOrders);

        // Example: Running Yesterday's Range Breakout Strategy
        const yrbStrategy = new YesterdayRangeBreakout(smartApiInstance, instrumentList);
        await yrbStrategy.rangeBreakout(['WIPRO', 'TCS']);

        // Example: Running Golden Strategies (Linear and Logistic Regression)
        const trainData = []; // Load or generate your training data
        const testData = []; // Load or generate your test data
        const linearResults = linearRegression(trainData, testData);
        const logisticResults = logisticRegression(trainData, testData);

        // Use conditions to place orders based on the results
        const currentPrice = 2000; // Replace with actual current price
        const previousHigh = 1980; // Replace with previous high
        const previousLow = 1950; // Replace with previous low
        const currentVolume = 1000; // Replace with actual current volume
        const averageVolume = 800; // Replace with calculated average volume

        if (shouldBuyLR(currentPrice, previousHigh, previousLow, currentVolume, averageVolume)) {
            await placeOrder('BUY', 'WIPRO', 2000, 1); // Example order
        }

        if (shouldSellLR(currentPrice, previousHigh, previousLow, currentVolume, averageVolume)) {
            await placeOrder('SELL', 'WIPRO', 1980, 1); // Example order
        }

        res.json({ success: true, message: 'Strategies executed successfully' });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Function to place an order
async function placeOrder(transactionType, tradingSymbol, price, quantity) {
    try {
        const orderResponse = await smartApiInstance.placeOrder({
            variety: "NORMAL",
            tradingsymbol: tradingSymbol,
            symboltoken: "3045", // Replace with actual token
            transactiontype: transactionType,
            exchange: "NSE", // Adjust as necessary
            ordertype: "LIMIT",
            producttype: "INTRADAY",
            duration: "DAY",
            price: price,
            squareoff: "0",
            stoploss: "0",
            quantity: quantity
        });
        console.log('Order placed successfully: ', orderResponse);
        return orderResponse;
    } catch (error) {
        console.error('Error placing order: ', error);
    }
}

// Start the server
app.listen(port, () => {
    console.log(`Backend server is running on http://localhost:${port}`);
});
