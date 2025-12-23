<?php
header('Content-Type: application/json');
require_once 'db_connect.php';
session_start();

$action = $_GET['action'] ?? '';

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
            if ($role !== 'client') {
                throw new Exception('Only clients can leave reviews.');
            }

            $artworkId = $input['artwork_id'] ?? 0;
            $rating = $input['rating'] ?? 0;
            $comment = $input['comment'] ?? '';

            if ($rating < 1 || $rating > 5) {
                throw new Exception('Rating must be between 1 and 5.');
            }

            // Check if artwork exists
            $stmt = $pdo->prepare("SELECT id FROM artworks WHERE id = ?");
            $stmt->execute([$artworkId]);
            if (!$stmt->fetch()) {
                 throw new Exception('Artwork not found.');
            }

            try {
                $stmt = $pdo->prepare("INSERT INTO reviews (user_id, artwork_id, rating, comment) VALUES (?, ?, ?, ?)");
                $stmt->execute([$userId, $artworkId, $rating, $comment]);
                echo json_encode(['success' => true, 'message' => 'Review added successfully.']);
            } catch (PDOException $e) {
                if ($e->getCode() == 23000) { // Duplicate entry
                    throw new Exception('You have already reviewed this artwork.');
                } else {
                    throw $e;
                }
            }
        } else {
            throw new Exception('Invalid POST action.');
        }

    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if ($action === 'list') {
            $artworkId = $_GET['artwork_id'] ?? 0;
            $stmt = $pdo->prepare("
                SELECT reviews.*, users.name as user_name 
                FROM reviews 
                JOIN users ON reviews.user_id = users.id 
                WHERE artwork_id = ? 
                ORDER BY created_at DESC
            ");
            $stmt->execute([$artworkId]);
            $reviews = $stmt->fetchAll();
            echo json_encode(['success' => true, 'reviews' => $reviews]);
        } else {
             throw new Exception('Invalid GET action.');
        }
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
