<?php
// Free MIDI downloads for reecemusic.com ("Play it yourself").
//   GET  midi.php?action=songs[&id=X]       → song list, or one song
//   GET  midi.php?action=download&id=<id>   → that song's MIDI file
// Catalog: data/midi-songs.json. Files: the private folder set in config.php (outside public_html).

declare(strict_types=1);

final class NotConfigured extends RuntimeException {}

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
        . '<p class="lede">' . $message . '</p><p><a class="btn btn-brass" href="/learn.html">Back to the songs</a></p></div></main>';
    exit;
}

function catalog(): array
{
    static $songs = null;
    $songs ??= json_decode((string) file_get_contents(__DIR__ . '/data/midi-songs.json'), true) ?: [];
    return $songs;
}

function findSong(mixed $id): ?array
{
    foreach (catalog() as $song) {
        if ($song['id'] === (string) $id) return $song;
    }
    return null;
}

// What the browser may see: never the stored file name.
function publicSong(array $s): array
{
    return [
        'id' => $s['id'],
        'title' => $s['title'],
        'artist' => $s['artist'],
        'description' => $s['description'],
        'youtubeId' => $s['youtubeId'] ?? ''
    ];
}

function midiConfig(string $key): string
{
    static $midi = null;
    if ($midi === null) {
        $path = __DIR__ . '/config.php';
        $midi = is_file($path) ? ((require $path)['midi'] ?? []) : [];
    }
    $value = (string) ($midi[$key] ?? '');
    if ($value === '' || str_contains($value, 'replace-with-')) throw new NotConfigured("midi.$key is not set in config.php");
    return $value;
}

$action = (string) ($_GET['action'] ?? '');

if ($action === 'songs') {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') sendJson(405, ['error' => 'Method not allowed.']);
    $cache = 'public, max-age=300';
    if (isset($_GET['id'])) {
        $song = findSong($_GET['id']);
        if (!$song) sendJson(404, ['error' => 'Song not found.']);
        sendJson(200, publicSong($song), $cache);
    }
    sendJson(200, ['songs' => array_map('publicSong', catalog())], $cache);
}

if ($action === 'download') {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') page(405, 'Method not allowed.');
    $song = findSong($_GET['id'] ?? '');
    if (!$song) page(404, "That song isn't on the list.");
    try {
        $file = basename((string) $song['file']);
        $path = rtrim(midiConfig('files_dir'), '/') . '/' . $file;
        if (!is_file($path)) page(404, "This MIDI file is being prepared and isn't uploaded yet. Please check back soon, or email info@reecemusic.com.");

        header('Content-Type: audio/midi');
        header('Content-Disposition: attachment; filename="' . $file . '"');
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: no-store');
        readfile($path);
        exit;
    } catch (Throwable $e) {
        error_log('Download failed: ' . $e->getMessage());
        page(503, "Downloads aren't available right now. Please try again in a few minutes.");
    }
}

sendJson(404, ['error' => 'Not found.']);
