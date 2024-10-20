<?php
// Database connection
$servername = "railway"; // Your server name
$username = "root"; // Your MySQL username
$password = "oYxaHDcQlCVRGsWIStqxnHwmhjJQhNzH"; // Your MySQL password
$dbname = "railway"; // Your database name

$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Get POST data from frontend
$data = json_decode(file_get_contents("php://input"), true);
$clientCode = $data['clientCode'];
$apiKey = $data['apiKey'];
$password = $data['password'];
$totp = $data['totp'];

// Function to generate a unique code
function generateUniqueCode() {
    return uniqid('user_', true); // This generates a unique code like 'user_5f63b6e2c7a1b'
}

$uniqueCode = generateUniqueCode();

// Insert user data into the database
$sql = "INSERT INTO users (client_code, api_key, password, totp, unique_code) VALUES ('$clientCode', '$apiKey', '$password', '$totp', '$uniqueCode')";

if ($conn->query($sql) === TRUE) {
    $response = array("success" => true, "message" => "User saved successfully with unique code: $uniqueCode");
} else {
    $response = array("success" => false, "message" => "Error: " . $conn->error);
}

// Close the connection
$conn->close();

// Return response in JSON format
header('Content-Type: application/json');
echo json_encode($response);
?>
