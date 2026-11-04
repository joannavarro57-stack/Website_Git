<?php

// Shared settings and database connection for track.php, midi.php and admin.php.
// Everything comes from config.php (not in the repository; see config.example.php).

declare(strict_types=1);

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    http_response_code(404);
    exit;
}

function siteConfig(): array
{
    static $config = null;
    if ($config === null) {
        $path = __DIR__ . '/config.php';
        if (!is_file($path)) throw new RuntimeException('config.php is missing.');
        $config = require $path;
    }
    return $config;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $database = siteConfig()['database'];
    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        $database['host'],
        $database['name'],
        $database['charset'] ?? 'utf8mb4'
    );
    $pdo = new PDO($dsn, $database['user'], $database['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);

    // Same definition as database/schema.sql, so the stats work without a manual setup step.
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS video_clicks ('
        . 'id INT UNSIGNED NOT NULL AUTO_INCREMENT,'
        . 'video_id VARCHAR(11) NOT NULL,'
        . 'title VARCHAR(200) NOT NULL DEFAULT \'\','
        . 'kind ENUM(\'play\', \'link\') NOT NULL,'
        . 'page VARCHAR(100) NOT NULL,'
        . 'clicked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,'
        . 'PRIMARY KEY (id),'
        . 'KEY idx_video_clicks_video (video_id)'
        . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS midi_downloads ('
        . 'id INT UNSIGNED NOT NULL AUTO_INCREMENT,'
        . 'song_id VARCHAR(100) NOT NULL,'
        . 'downloaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,'
        . 'PRIMARY KEY (id),'
        . 'KEY idx_midi_downloads_song (song_id)'
        . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    return $pdo;
}
