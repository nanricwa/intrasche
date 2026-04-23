-- 社内スケジューラー MySQL スキーマ
-- Xserver の phpMyAdmin で実行してください

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  host_id VARCHAR(128) NOT NULL,
  host_name VARCHAR(255) NOT NULL,
  slots JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_host_id (host_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS responses (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  event_id VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  availabilities JSON NOT NULL,
  comment TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_id (event_id),
  CONSTRAINT fk_responses_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
