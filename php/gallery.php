<?php

// The recorded performances for the Sight & Sound galleries, as JSON.
//   GET gallery.php  → {"videos": [{gallery, youtube, title, note}, …]} in display order
// Videos are managed on the admin's YouTube page (videos.php); see video-catalog.php.

declare(strict_types=1);

require __DIR__ . '/video-catalog.php';

header('Content-Type: application/json; charset=UTF-8');
// Never cached, so whatever was just changed on the admin's YouTube page shows straight away.
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

try {
    $videos = array_map(static fn($v) => [
        'gallery' => $v['gallery'],
        'youtube' => $v['youtube'],
        'title' => $v['title'],
        'note' => $v['note']
    ], array_values(galleryVideos()));
    echo json_encode(['videos' => $videos]);
} catch (Throwable $e) {
    error_log('Gallery list failed: ' . $e->getMessage());
    http_response_code(503);
    echo json_encode(['error' => 'Videos are unavailable right now.']);
}
