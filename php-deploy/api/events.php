<?php
// POST /api/events         : 新規イベント作成
// GET  /api/events?host_id : ホストのイベント一覧

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = get_pdo();

if ($method === 'POST') {
    $body = read_json_body();
    $id          = trim((string)($body['id']          ?? ''));
    $title       = trim((string)($body['title']       ?? ''));
    $description = (string)($body['description'] ?? '');
    $host_id     = trim((string)($body['host_id']     ?? ''));
    $host_name   = trim((string)($body['host_name']   ?? ''));
    $slots       = $body['slots'] ?? [];

    if ($id === '' || $title === '' || $host_id === '' || $host_name === '' || !is_array($slots) || count($slots) === 0) {
        json_error('Missing required fields', 400);
    }

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO events (id, title, description, host_id, host_name, slots) VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$id, $title, $description, $host_id, $host_name, json_encode($slots, JSON_UNESCAPED_UNICODE)]);
        json_response(['success' => true, 'id' => $id]);
    } catch (PDOException $e) {
        json_error('Failed to create event: ' . $e->getMessage(), 500);
    }
}

if ($method === 'GET') {
    $host_id = $_GET['host_id'] ?? '';
    if ($host_id === '') json_error('host_id is required', 400);

    try {
        $stmt = $pdo->prepare('SELECT * FROM events WHERE host_id = ? ORDER BY created_at DESC');
        $stmt->execute([$host_id]);
        $events = $stmt->fetchAll();

        $countStmt = $pdo->prepare('SELECT COUNT(*) AS c FROM responses WHERE event_id = ?');
        $result = [];
        foreach ($events as $ev) {
            $countStmt->execute([$ev['id']]);
            $countRow = $countStmt->fetch();
            $ev['slots'] = json_decode($ev['slots'], true) ?: [];
            $ev['response_count'] = (int)($countRow['c'] ?? 0);
            $result[] = $ev;
        }
        json_response($result);
    } catch (PDOException $e) {
        json_error('Failed to fetch events: ' . $e->getMessage(), 500);
    }
}

json_error('Method not allowed', 405);
