<?php

// Records a YouTube play or YouTube link click, sent by js/site.js. admin.php shows the totals.
//   POST track.php  video=<11-char id or "channel">  kind=play|link  title=…  page=/path

declare(strict_types=1);

require __DIR__ . '/db.php';

header('Content-Type: application/json; charset=UTF-8');
header('X-Robots-Tag: noindex');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

// Search engines and link previews would only inflate the numbers.
if (preg_match('/bot|crawl|spider|slurp|preview|headless/i', (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''))) {
    echo json_encode(['success' => true]);
    exit;
}

$video = (string) ($_POST['video'] ?? '');
$kind = (string) ($_POST['kind'] ?? '');
$title = trim(strip_tags((string) ($_POST['title'] ?? '')));
$title = function_exists('mb_substr') ? mb_substr($title, 0, 200) : substr($title, 0, 200);
$page = substr(preg_replace('/[^a-zA-Z0-9_.\/-]/', '', (string) ($_POST['page'] ?? '')), 0, 100) ?: '/';

if (!preg_match('/^(?:[A-Za-z0-9_-]{11}|channel)$/', $video) || !in_array($kind, ['play', 'link'], true)) {
    http_response_code(422);
    echo json_encode(['error' => 'Unknown video.']);
    exit;
}

try {
    db()->prepare('INSERT INTO video_clicks (video_id, title, kind, page) VALUES (:video, :title, :kind, :page)')
        ->execute(['video' => $video, 'title' => $title, 'kind' => $kind, 'page' => $page]);
} catch (Throwable $error) {
    error_log('Video click could not be recorded: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Stats are unavailable.']);
    exit;
}

echo json_encode(['success' => true]);
