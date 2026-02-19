<?php
header('Content-Type: application/json');
require_once 'api/db_connect.php';
session_start();

$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Unauthorized.');
    }

    $userId = $_SESSION['user_id'];
    $role = $_SESSION['role'];

    if ($action === 'fetch_profile') {
        $stmt = $pdo->prepare("SELECT name, bio, profile_image FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        
        echo json_encode(['success' => true, 'profile' => $user]);
    } 
    elseif ($action === 'update_profile') {
        if ($role !== 'artist') throw new Exception('Only artists can update their public profile here.');

        $bio = trim($_POST['bio'] ?? '');
        
        // Handle Profile Image Upload
        $profileImagePath = null;
        if (isset($_FILES['profile_image']) && $_FILES['profile_image']['error'] === UPLOAD_ERR_OK) {
            $uploadDir = 'uploads/profiles/';
            // Ensure directory exists with full path safety
            if (!is_dir($uploadDir)) {
                if (!mkdir($uploadDir, 0777, true)) {
                    throw new Exception('Failed to create profiles upload directory.');
                }
            }
            
            $fileInfo = pathinfo($_FILES['profile_image']['name']);
            $extension = strtolower($fileInfo['extension']);
            $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
            
            if (!in_array($extension, $allowed)) {
                throw new Exception('Invalid image format. Allowed: ' . implode(', ', $allowed));
            }

            $fileName = 'profile_' . $userId . '_' . time() . '.' . $extension;
            $targetPath = $uploadDir . $fileName;

            if (move_uploaded_file($_FILES['profile_image']['tmp_name'], $targetPath)) {
                $profileImagePath = 'uploads/profiles/' . $fileName;
            } else {
                throw new Exception('Failed to save profile image.');
            }
        }

        if ($profileImagePath) {
            $stmt = $pdo->prepare("UPDATE users SET bio = ?, profile_image = ? WHERE id = ?");
            if (!$stmt->execute([$bio, $profileImagePath, $userId])) {
                throw new Exception('Database update failed.');
            }
        } else {
            $stmt = $pdo->prepare("UPDATE users SET bio = ? WHERE id = ?");
            if (!$stmt->execute([$bio, $userId])) {
                throw new Exception('Database update failed.');
            }
        }

        echo json_encode(['success' => true, 'message' => 'Profile updated successfully.']);
    } else {
        throw new Exception('Invalid action: ' . ($action ?: '(empty)'));
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
