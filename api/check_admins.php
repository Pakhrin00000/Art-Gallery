<?php
require_once 'db_connect.php';
$stmt = $pdo->query("SELECT id, name, email, role FROM users WHERE role = 'admin'");
$admins = $stmt->fetchAll();
header('Content-Type: application/json');
echo json_encode($admins);
?>
