<?php
// POST /api/events/:id/responses : 出欠回答を登録

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') json_error('Method not allowed', 405);

$event_id = $_GET['event_id'] ?? '';
if ($event_id === '') json_error('event_id required', 400);

$body = read_json_body();
$id             = trim((string)($body['id']             ?? ''));
$name           = trim((string)($body['name']           ?? ''));
$availabilities = $body['availabilities'] ?? [];
$comment        = (string)($body['comment']        ?? '');

if ($id === '' || $name === '' || !is_array($availabilities)) {
    json_error('Missing required fields', 400);
}

$pdo = get_pdo();

try {
    $check = $pdo->prepare('SELECT 1 FROM events WHERE id = ?');
    $check->execute([$event_id]);
    if (!$check->fetchColumn()) json_error('Event not found', 404);

    $stmt = $pdo->prepare(
        'INSERT INTO responses (id, event_id, name, availabilities, comment) VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([$id, $event_id, $name, json_encode($availabilities, JSON_UNESCAPED_UNICODE), $comment]);
    json_response(['success' => true]);
} catch (PDOException $e) {
    json_error('Failed to submit response: ' . $e->getMessage(), 500);
}
