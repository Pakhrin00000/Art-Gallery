<?php
header('Content-Type: application/json');
require_once 'db_connect.php';
session_start();

$action = $_GET['action'] ?? '';

// Helper to get POST data (JSON or Form)
function getJsonInput() {
    return json_decode(file_get_contents('php://input'), true);
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = getJsonInput();
        
        if ($action === 'register') {
            $name = trim($input['name'] ?? '');
            $email = trim($input['email'] ?? '');
            $password = $input['password'] ?? '';
            $role = $input['role'] ?? 'client';
            $bio = $input['bio'] ?? '';

            if (empty($name) || empty($email) || empty($password)) {
                throw new Exception('Name, email, and password are required.');
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                throw new Exception('Invalid email format.');
            }
            if (!in_array($role, ['artist', 'client'])) {
                $role = 'client';
            }

            // Check if email exists
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                throw new Exception('Email already registered.');
            }

            $passwordHash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("INSERT INTO users (name, email, password_hash, role, bio) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$name, $email, $passwordHash, $role, $bio]);

            echo json_encode(['success' => true, 'message' => 'Registration successful.']);
        } 
        elseif ($action === 'login') {
            $email = trim($input['email'] ?? '');
            $password = $input['password'] ?? '';

            if (empty($email) || empty($password)) {
                throw new Exception('Email and password are required.');
            }

            $stmt = $pdo->prepare("SELECT id, name, password_hash, role FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch();

            if ($user && password_verify($password, $user['password_hash'])) {
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['role'] = $user['role'];
                $_SESSION['name'] = $user['name'];
                
                echo json_encode([
                    'success' => true, 
                    'user' => [
                        'id' => $user['id'],
                        'name' => $user['name'],
                        'role' => $user['role']
                    ]
                ]);
            } else {
                throw new Exception('Invalid email or password.');
            }
        } 
        elseif ($action === 'logout') {
            session_destroy();
            echo json_encode(['success' => true, 'message' => 'Logged out.']);
        }
        else {
            throw new Exception('Invalid action.');
        }
    } 
    elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if ($action === 'check') {
            if (isset($_SESSION['user_id'])) {
                echo json_encode([
                    'logged_in' => true,
                    'user' => [
                        'id' => $_SESSION['user_id'],
                        'name' => $_SESSION['name'],
                        'role' => $_SESSION['role']
                    ]
                ]);
            } else {
                echo json_encode(['logged_in' => false]);
            }
        } else {
            throw new Exception('Invalid GET action.');
        }
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
