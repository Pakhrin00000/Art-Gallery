<?php
header('Content-Type: application/json');
require_once 'db_connect.php';
session_start();

$action = $_GET['action'] ?? '';

// Helper to get POST data or Form Data
function getInput() {
    $json = json_decode(file_get_contents('php://input'), true);
    return $json ? $json : $_POST;
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!isset($_SESSION['user_id'])) {
            throw new Exception('Unauthorized.');
        }

        $input = getInput();
        $userId = $_SESSION['user_id'];
        $role = $_SESSION['role'];

        if ($action === 'add') {
            if ($role !== 'artist') {
                throw new Exception('Only artists can add artworks.');
            }

            $title = $input['title'] ?? '';
            $description = $input['description'] ?? '';
            $price = $input['price'] ?? 0;

            if (empty($title) || empty($price)) {
                throw new Exception('Title and Price are required.');
            }

            if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
                throw new Exception('Image is required.');
            }

            // Image Upload Handling
            $allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
            $fileType = mime_content_type($_FILES['image']['tmp_name']);
            if (!in_array($fileType, $allowedTypes)) {
                throw new Exception('Invalid file type. Only JPG, PNG, WEBP allowed.');
            }
            
            // Limit size to 5MB
            if ($_FILES['image']['size'] > 5 * 1024 * 1024)   {
                throw new Exception('File too large. Max 5MB.');
            }

            $uploadDir = '../uploads/';
            if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
            
            $extension = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
            $fileName = uniqid() . '.' . $extension;
            $targetPath = $uploadDir . $fileName;

            if (!move_uploaded_file($_FILES['image']['tmp_name'], $targetPath)) {
                throw new Exception('Failed to save image.');
            }
            
            $dbImagePath = 'uploads/' . $fileName;

            $stmt = $pdo->prepare("INSERT INTO artworks (artist_id, title, description, price, image_path) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$userId, $title, $description, $price, $dbImagePath]);

            echo json_encode(['success' => true, 'message' => 'Artwork added successfully.']);
        }
        elseif ($action === 'purchase') {
            if ($role !== 'client') {
                throw new Exception('Only clients can purchase artworks.');
            }
            $artworkId = $input['artwork_id'] ?? 0;
            
            // Check status
            $stmt = $pdo->prepare("SELECT status FROM artworks WHERE id = ?");
            $stmt->execute([$artworkId]);
            $art = $stmt->fetch();

            if (!$art) throw new Exception('Artwork not found.');
            if ($art['status'] === 'sold') throw new Exception('Artwork already sold.');

            $stmt = $pdo->prepare("UPDATE artworks SET status = 'sold' WHERE id = ?");
            $stmt->execute([$artworkId]);

            echo json_encode(['success' => true, 'message' => 'Purchase successful!']);
        }
        elseif ($action === 'delete') {
            // Optional: Allow artist to delete their own work
            $artworkId = $input['artwork_id'] ?? 0;
            $stmt = $pdo->prepare("DELETE FROM artworks WHERE id = ? AND artist_id = ?");
            $stmt->execute([$artworkId, $userId]);
            if ($stmt->rowCount() > 0) {
                 echo json_encode(['success' => true, 'message' => 'Artwork deleted.']);
            } else {
                 throw new Exception('Artwork not found or permission denied.');
            }
        }
        else {
            throw new Exception('Invalid POST action.');
        }

    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if ($action === 'list') {
            $stmt = $pdo->query("
                SELECT artworks.*, users.name as artist_name 
                FROM artworks 
                JOIN users ON artworks.artist_id = users.id 
                ORDER BY created_at DESC
            ");
            $artworks = $stmt->fetchAll();
            echo json_encode(['success' => true, 'artworks' => $artworks]);
        }
        elseif ($action === 'details') {
            $id = $_GET['id'] ?? 0;
            $stmt = $pdo->prepare("
                SELECT artworks.*, users.name as artist_name, users.bio as artist_bio
                FROM artworks 
                JOIN users ON artworks.artist_id = users.id 
                WHERE artworks.id = ?
            ");
            $stmt->execute([$id]);
            $artwork = $stmt->fetch();
            
            if ($artwork) {
                // Get average rating
                $stmtRate = $pdo->prepare("SELECT AVG(rating) as avg_rating FROM reviews WHERE artwork_id = ?");
                $stmtRate->execute([$id]);
                $rating = $stmtRate->fetch();
                $artwork['avg_rating'] = $rating['avg_rating'] ? round($rating['avg_rating'], 1) : null;
                
                echo json_encode(['success' => true, 'artwork' => $artwork]);
            } else {
                 throw new Exception('Artwork not found.');
            }
        }
        else {
            throw new Exception('Invalid GET action.');
        }
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
