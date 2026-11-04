<?php
// Free downloads for reecemusic.com ("Play it yourself"): MIDI and sheet music (PDF, MusicXML) per song.
//   GET  midi.php?action=songs[&id=X]                                  → song list, or one song
//   GET  midi.php?action=download&id=<id>[&format=midi|pdf|musicxml]  → one of that song's files (MIDI by default)
// Songs and their files are managed on the admin's Songs page (songs.php); see catalog.php.

declare(strict_types=1);

require __DIR__ . '/catalog.php';

function sendJson(int $status, array $body, string $cache = 'no-store'): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: ' . $cache);
    echo json_encode($body);
    exit;
}

function page(int $status, string $message): void
{
    http_response_code($status);
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-store');
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>Download | Reece Music</title><link rel="stylesheet" href="/css/reece.css">'
        . '<main class="section"><div class="wrap"><h1 style="font-size:2.4rem;margin-bottom:16px">Download unavailable</h1>'
        . '<p class="lede">' . $message . '</p><p><a class="btn btn-brass" href="/pages/learn.html">Back to the songs</a></p></div></main>';
    exit;
}

// What the browser may see: never the stored file names. Only uploaded files are offered.
function publicSong(array $s): array
{
    return [
        'id' => $s['id'],
        'title' => $s['title'],
        'artist' => $s['artist'],
        'description' => $s['description'],
        'youtubeId' => $s['youtubeId'],
        'formats' => array_values(array_filter(array_keys(FORMATS), static fn($f) => storedFile($s, $f) !== null))
    ];
}

$action = (string) ($_GET['action'] ?? '');

if ($action === 'songs') {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') sendJson(405, ['error' => 'Method not allowed.']);
    // Never cached, so whatever was just changed on the admin's Songs page shows straight away.
    $cache = 'no-store';
    try {
        if (isset($_GET['id'])) {
            $song = findSong($_GET['id']);
            if (!$song) sendJson(404, ['error' => 'Song not found.']);
            sendJson(200, publicSong($song), $cache);
        }
        sendJson(200, ['songs' => array_values(array_map('publicSong', catalog()))], $cache);
    } catch (Throwable $e) {
        error_log('Song list failed: ' . $e->getMessage());
        sendJson(503, ['error' => 'Songs are unavailable right now.']);
    }
}

if ($action === 'download') {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') page(405, 'Method not allowed.');
    try {
        $song = findSong($_GET['id'] ?? '');
    } catch (Throwable $e) {
        error_log('Download failed: ' . $e->getMessage());
        page(503, "Downloads aren't available right now. Please try again in a few minutes.");
    }
    if (!$song) page(404, "That song isn't on the list.");
    $format = (string) ($_GET['format'] ?? 'midi');
    if (!isset(FORMATS[$format])) page(404, "This song doesn't have that download.");
    $label = FORMATS[$format]['label'];
    $path = storedFile($song, $format);
    if ($path === null) page(404, "This {$label} file is being prepared and isn't uploaded yet. Please check back soon, or email info@reecemusic.com.");
    $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $type = FORMATS[$format]['types'][$extension] ?? 'application/octet-stream';
    // Saved under the song's current title and artist, e.g. "Jacob and Stone - Minari.pdf".
    $name = trim(preg_replace('~[\\\\/:*?"<>|\x00-\x1F]+~', '', $song['title'] . ' - ' . $song['artist'])) ?: $song['id'];
    $ascii = trim(preg_replace('/[^A-Za-z0-9 ._()-]+/', '', $name)) ?: $song['id'];

    // Count it for admin.php. Stats must never stop the download, so errors are only logged.
    if (!preg_match('/bot|crawl|spider|slurp|preview|headless/i', (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''))) {
        try {
            db()->prepare('INSERT INTO midi_downloads (song_id, format) VALUES (?, ?)')->execute([$song['id'], $format]);
        } catch (Throwable $e) {
            error_log('Download could not be counted: ' . $e->getMessage());
        }
    }

    header('Content-Type: ' . $type);
    header('Content-Disposition: attachment; filename="' . $ascii . '.' . $extension . "\"; filename*=UTF-8''" . rawurlencode($name . '.' . $extension));
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: no-store');
    readfile($path);
    exit;
}

sendJson(404, ['error' => 'Not found.']);
