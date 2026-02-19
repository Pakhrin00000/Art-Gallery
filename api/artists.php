<?php
header('Content-Type: application/json');
require_once 'db_connect.php';
session_start();

$action = $_GET['action'] ?? '';

try {
    if ($action === 'profile') {
        $artistId = $_GET['id'] ?? 0;
        if (!$artistId) throw new Exception('Artist ID is required.');

        // Fetch artist details
        $stmt = $pdo->prepare("SELECT id, name, bio, profile_image, is_verified, created_at FROM users WHERE id = ? AND role = 'artist'");
        $stmt->execute([$artistId]);
        $artist = $stmt->fetch();

        if (!$artist) throw new Exception('Artist not found.');

        // Fetch artist portfolio
        $stmtArt = $pdo->prepare("SELECT id, title, description, price, image_path, created_at FROM artworks WHERE artist_id = ? ORDER BY created_at DESC");
        $stmtArt->execute([$artistId]);
        $artworks = $stmtArt->fetchAll();

        echo json_encode([
            'success' => true,
            'artist' => $artist,
            'artworks' => $artworks
        ]);
    } else {
        throw new Exception('Invalid action.');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
