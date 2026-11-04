<?php

// The recorded performances on the Sight & Sound page, shared by gallery.php (the public list) and videos.php
// (managing them in the admin). Videos live in the `gallery_videos` table, so deploys never overwrite what the
// admin changed; data/gallery-videos.json only seeds the table the first time.

declare(strict_types=1);

require_once __DIR__ . '/db.php';

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    http_response_code(404);
    exit;
}

// Each key matches a data-video-gallery="…" on the Sight & Sound page, in the order they appear there.
const GALLERIES = [
    'piano' => 'Reece Piano',
    'ukulele' => 'Reece Ukulele',
    'electronica' => 'Reece Electronica',
    'original' => 'Original Music'
];

// Creates the gallery_videos table the first time, filled from data/gallery-videos.json.
function videosTable(PDO $pdo): void
{
    static $ready = false;
    if ($ready) return;
    $exists = (bool) $pdo->query("SHOW TABLES LIKE 'gallery_videos'")->fetch();
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS gallery_videos ('
        . 'id INT UNSIGNED NOT NULL AUTO_INCREMENT,'
        . 'gallery VARCHAR(20) NOT NULL,'
        . 'youtube_id VARCHAR(11) NOT NULL,'
        . 'title VARCHAR(200) NOT NULL DEFAULT \'\','
        . 'note VARCHAR(300) NOT NULL DEFAULT \'\','
        . 'position INT UNSIGNED NOT NULL DEFAULT 0,'
        . 'created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,'
        . 'PRIMARY KEY (id),'
        . 'KEY gallery_position (gallery, position)'
        . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    if (!$exists) {
        $seed = json_decode((string) @file_get_contents(dirname(__DIR__) . '/data/gallery-videos.json'), true) ?: [];
        $insert = $pdo->prepare('INSERT INTO gallery_videos (gallery, youtube_id, title, note, position) VALUES (?, ?, ?, ?, ?)');
        foreach ($seed as $i => $v) {
            $insert->execute([$v['gallery'], $v['youtube'], $v['title'] ?? '', $v['note'] ?? '', $i + 1]);
        }
    }
    $ready = true;
}

// Every video, gallery by gallery in GALLERIES order and in display order within each, as
// id => [id, gallery, youtube, title, note].
function galleryVideos(): array
{
    $pdo = db();
    videosTable($pdo);
    $videos = [];
    foreach ($pdo->query('SELECT * FROM gallery_videos ORDER BY position, id') as $row) {
        $videos[(int) $row['id']] = [
            'id' => (int) $row['id'],
            'gallery' => $row['gallery'],
            'youtube' => $row['youtube_id'],
            'title' => $row['title'],
            'note' => $row['note']
        ];
    }
    $order = array_flip(array_keys(GALLERIES));
    uasort($videos, static fn($a, $b) => ($order[$a['gallery']] ?? 99) <=> ($order[$b['gallery']] ?? 99));
    return $videos;
}
