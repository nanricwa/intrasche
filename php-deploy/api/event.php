<?php
// GET /api/events/:id : 単一イベント + 回答リスト

require_once __DIR__ . '/db.php';

$id = $_GET['id'] ?? '';
if ($id === '') json_error('Event id required', 400);

$pdo = get_pdo();

try {
    $stmt = $pdo->prepare('SELECT * FROM events WHERE id = ?');
    $stmt->execute([$id]);
    $event = $stmt->fetch();
    if (!$event) json_error('Event not found', 404);

    $resStmt = $pdo->prepare('SELECT * FROM responses WHERE event_id = ? ORDER BY created_at ASC');
    $resStmt->execute([$id]);
    $responses = $resStmt->fetchAll();

    $event['slots'] = json_decode($event['slots'], true) ?: [];
    $event['responses'] = array_map(function ($r) {
        $r['availabilities'] = json_decode($r['availabilities'], true) ?: new stdClass();
        return $r;
    }, $responses);

    json_response($event);
} catch (PDOException $e) {
    json_error('Failed to fetch event: ' . $e->getMessage(), 500);
}
