<?php
require_once 'db_connect.php';
$newPassword = 'admin123';
$passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
$email = 'admin@artspace.com';

$stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE email = ? AND role = 'admin'");
$stmt->execute([$passwordHash, $email]);

if ($stmt->rowCount() > 0) {
    echo "Password for $email has been reset to: $newPassword\n";
} else {
    echo "Could not find admin user with email $email.\n";
}
?>
