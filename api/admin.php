<?php
header('Content-Type: application/json');
require_once 'db_connect.php';
session_start();

// Middleware to check if user is admin
function isAdmin() {
    return isset($_SESSION['role']) && $_SESSION['role'] === 'admin';
}

if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied. Admin privileges required.']);
    exit;
}

$action = $_GET['action'] ?? '';

// Helper to get JSON input
function getJsonInput() {
    return json_decode(file_get_contents('php://input'), true);
}

// Audit Log Helper
function logAction($pdo, $action, $details = null) {
    if (!isset($_SESSION['user_id'])) return;
    $stmt = $pdo->prepare("INSERT INTO audit_logs (admin_id, action, details) VALUES (?, ?, ?)");
    $stmt->execute([$_SESSION['user_id'], $action, $details]);
}

try {
    switch ($action) {
        case 'top_rated':
            // Logic: Suggest arts based on average rating
            // Only suggest arts that have at least one review
            $stmt = $pdo->query("
                SELECT a.*, u.name as artist_name, 
                       AVG(r.rating) as avg_rating, 
                       COUNT(r.id) as review_count
                FROM artworks a
                JOIN users u ON a.artist_id = u.id
                LEFT JOIN reviews r ON a.id = r.artwork_id
                GROUP BY a.id
                HAVING review_count > 0
                ORDER BY avg_rating DESC, review_count DESC
            ");
            $artworks = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $artworks]);
            break;

        case 'list_artworks':
            // Get all artworks for management
            $stmt = $pdo->query("
                SELECT a.*, u.name as artist_name, 
                       IFNULL(AVG(r.rating), 0) as avg_rating
                FROM artworks a
                JOIN users u ON a.artist_id = u.id
                LEFT JOIN reviews r ON a.id = r.artwork_id
                GROUP BY a.id
                ORDER BY a.created_at DESC
            ");
            $artworks = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $artworks]);
            break;

        case 'delete_artwork':
            $id = $_GET['id'] ?? null;
            if (!$id) throw new Exception('Artwork ID required.');
            
            // Get title for logging
            $stmtTitle = $pdo->prepare("SELECT title FROM artworks WHERE id = ?");
            $stmtTitle->execute([$id]);
            $title = $stmtTitle->fetchColumn();

            $stmt = $pdo->prepare("DELETE FROM artworks WHERE id = ?");
            $stmt->execute([$id]);
            
            logAction($pdo, 'Delete Artwork', "ID: $id, Title: $title");
            echo json_encode(['success' => true, 'message' => 'Artwork deleted successfully.']);
            break;

        case 'update_status':
            $input = getJsonInput();
            $id = $input['id'] ?? null;
            $status = $input['status'] ?? null;

            if (!$id || !$status) throw new Exception('ID and status required.');
            if (!in_array($status, ['available', 'sold'])) throw new Exception('Invalid status.');

            $stmt = $pdo->prepare("UPDATE artworks SET status = ? WHERE id = ?");
            $stmt->execute([$status, $id]);
            echo json_encode(['success' => true, 'message' => 'Status updated successfully.']);
            break;

        case 'toggle_featured':
            $input = getJsonInput();
            $id = $input['id'] ?? null;
            $state = $input['state'] ?? null; // Optional explicit state
            if (!$id) throw new Exception('Artwork ID required.');

            if ($state !== null) {
                $stmt = $pdo->prepare("UPDATE artworks SET is_featured = ? WHERE id = ?");
                $stmt->execute([$state ? 1 : 0, $id]);
            } else {
                $stmt = $pdo->prepare("UPDATE artworks SET is_featured = NOT is_featured WHERE id = ?");
                $stmt->execute([$id]);
            }
            echo json_encode(['success' => true, 'message' => 'Featured status updated.']);
            break;

        case 'toggle_verify':
            $input = getJsonInput();
            $id = $input['id'] ?? null;
            $state = $input['state'] ?? null; // Optional explicit state
            if (!$id) throw new Exception('User ID required.');

            if ($state !== null) {
                $stmt = $pdo->prepare("UPDATE users SET is_verified = ? WHERE id = ? AND role = 'artist'");
                $stmt->execute([$state ? 1 : 0, $id]);
            } else {
                $stmt = $pdo->prepare("UPDATE users SET is_verified = NOT is_verified WHERE id = ? AND role = 'artist'");
                $stmt->execute([$id]);
            }
            echo json_encode(['success' => true, 'message' => 'Verification status updated.']);
            break;

        case 'stats':
            // Platform Stats
            $stats = [];
            
            $stats['total_artworks'] = $pdo->query("SELECT COUNT(*) FROM artworks")->fetchColumn();
            $stats['total_users'] = $pdo->query("SELECT COUNT(*) FROM users WHERE role != 'admin'")->fetchColumn();
            $stats['total_sold'] = $pdo->query("SELECT COUNT(*) FROM artworks WHERE status = 'sold'")->fetchColumn();
            
            // Calculate Total Revenue (mock/price-based)
            $stats['revenue'] = $pdo->query("SELECT IFNULL(SUM(price), 0) FROM artworks WHERE status = 'sold'")->fetchColumn();
            
            // Top Artist
            $stmtTop = $pdo->query("
                SELECT u.name, COUNT(a.id) as sold_count 
                FROM users u 
                JOIN artworks a ON u.id = a.artist_id 
                WHERE a.status = 'sold' 
                GROUP BY u.id 
                ORDER BY sold_count DESC 
                LIMIT 1
            ");
            $topArtist = $stmtTop->fetch();
            $stats['top_artist'] = $topArtist ? $topArtist['name'] : 'N/A';

            echo json_encode(['success' => true, 'data' => $stats]);
            break;

        case 'list_users':
            $stmt = $pdo->query("
                SELECT u.id, u.name, u.email, u.role, u.is_verified, u.created_at,
                       (SELECT COUNT(*) FROM artworks WHERE artist_id = u.id) as total_artworks,
                       (SELECT IFNULL(SUM(price), 0) FROM sales WHERE artist_id = u.id) as total_revenue
                FROM users u 
                WHERE u.role != 'admin' 
                ORDER BY u.created_at DESC
            ");
            $users = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $users]);
            break;

        case 'delete_user':
            $id = $_GET['id'] ?? null;
            if (!$id) throw new Exception('User ID required.');
            
            $stmtName = $pdo->prepare("SELECT name FROM users WHERE id = ?");
            $stmtName->execute([$id]);
            $name = $stmtName->fetchColumn();

            $stmt = $pdo->prepare("DELETE FROM users WHERE id = ? AND role != 'admin'");
            $stmt->execute([$id]);
            
            logAction($pdo, 'Delete User', "ID: $id, Name: $name");
            echo json_encode(['success' => true, 'message' => 'User deleted successfully.']);
            break;

        case 'list_reviews':
            $stmt = $pdo->query("
                SELECT r.*, u.name as user_name, a.title as artwork_title 
                FROM reviews r 
                JOIN users u ON r.user_id = u.id 
                JOIN artworks a ON r.artwork_id = a.id 
                ORDER BY r.created_at DESC
            ");
            $reviews = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $reviews]);
            break;

        case 'delete_review':
            $id = $_GET['id'] ?? null;
            if (!$id) throw new Exception('Review ID required.');
            $stmt = $pdo->prepare("DELETE FROM reviews WHERE id = ?");
            $stmt->execute([$id]);

            logAction($pdo, 'Delete Review', "ID: $id");
            echo json_encode(['success' => true, 'message' => 'Review deleted successfully.']);
            break;

        case 'list_sales':
            $stmt = $pdo->query("
                SELECT s.*, a.title as artwork_title, b.name as buyer_name, art.name as artist_name 
                FROM sales s 
                JOIN artworks a ON s.artwork_id = a.id 
                JOIN users b ON s.buyer_id = b.id 
                JOIN users art ON s.artist_id = art.id 
                ORDER BY s.created_at DESC
            ");
            $sales = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $sales]);
            break;

        case 'get_settings':
            $stmt = $pdo->query("SELECT setting_key, setting_value FROM site_settings");
            $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
            echo json_encode(['success' => true, 'data' => $settings]);
            break;

        case 'update_settings':
            $input = getJsonInput();
            foreach ($input as $key => $value) {
                $stmt = $pdo->prepare("INSERT INTO site_settings (setting_key, setting_value) 
                                     VALUES (?, ?) 
                                     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
                $stmt->execute([$key, $value]);
            }
            logAction($pdo, 'Update Settings', "Keys: " . implode(', ', array_keys($input)));
            echo json_encode(['success' => true, 'message' => 'Settings updated successfully.']);
            break;

        case 'get_analytics':
            $analytics = [];

            // 1. Most Posts Leaderboard
            $analytics['most_posts'] = $pdo->query("
                SELECT u.name, COUNT(a.id) as total_posts 
                FROM users u 
                LEFT JOIN artworks a ON u.id = a.artist_id 
                WHERE u.role = 'artist' 
                GROUP BY u.id 
                ORDER BY total_posts DESC 
                LIMIT 5
            ")->fetchAll();

            // 2. Top Rated Artists (Highest average rating)
            $analytics['top_rated'] = $pdo->query("
                SELECT u.name, AVG(r.rating) as avg_rating, COUNT(r.id) as total_reviews 
                FROM users u 
                JOIN artworks a ON u.id = a.artist_id 
                JOIN reviews r ON a.id = r.artwork_id 
                GROUP BY u.id 
                HAVING total_reviews >= 1 
                ORDER BY avg_rating DESC, total_reviews DESC 
                LIMIT 5
            ")->fetchAll();

            // 3. Top Earners (Most total revenue)
            $analytics['top_earners'] = $pdo->query("
                SELECT u.name, SUM(s.price) as total_revenue 
                FROM users u 
                JOIN sales s ON u.id = s.artist_id 
                GROUP BY u.id 
                ORDER BY total_revenue DESC 
                LIMIT 5
            ")->fetchAll();

            echo json_encode(['success' => true, 'data' => $analytics]);
            break;

        case 'list_logs':
            $stmt = $pdo->query("
                SELECT l.*, u.name as admin_name 
                FROM audit_logs l 
                JOIN users u ON l.admin_id = u.id 
                ORDER BY l.created_at DESC 
                LIMIT 50
            ");
            $logs = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $logs]);
            break;

        default:
            throw new Exception('Invalid action.');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
