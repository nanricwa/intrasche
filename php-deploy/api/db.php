<?php
// 共通: PDO接続 + JSON応答ユーティリティ

function get_pdo(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $configPath = __DIR__ . '/config.php';
    if (!file_exists($configPath)) {
        json_error('Configuration missing. Copy config.sample.php to config.php.', 500);
    }
    $cfg = require $configPath;

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        $cfg['db_host'],
        $cfg['db_name'],
        $cfg['db_charset'] ?? 'utf8mb4'
    );

    try {
        $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        json_error('DB connection failed: ' . $e->getMessage(), 500);
    }
    return $pdo;
}

function json_response($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $message, int $status = 400): void {
    json_response(['error' => $message], $status);
}

function read_json_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return [];
    $data = json_decode($raw, true);
    if (!is_array($data)) json_error('Invalid JSON body', 400);
    return $data;
}
