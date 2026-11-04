<?php
// Free downloads for reecemusic.com ("Play it yourself"): MIDI and sheet music (PDF, MusicXML) per song.
//   GET  midi.php?action=songs[&id=X]                                  → song list, or one song
//   GET  midi.php?action=download&id=<id>[&format=midi|pdf|musicxml]  → one of that song's files (MIDI by default)
// Catalog: data/midi-songs.json. Files: the private folder set in config.php (outside public_html).

declare(strict_types=1);

final class NotConfigured extends RuntimeException {}

// What each song can offer. The catalog names a file per format under "files"; its extension picks the content type.
const FORMATS = [
    'midi' => ['label' => 'MIDI', 'types' => ['mid' => 'audio/midi', 'midi' => 'audio/midi']],
    'pdf' => ['label' => 'PDF sheet music', 'types' => ['pdf' => 'application/pdf']],
    'musicxml' => ['label' => 'MusicXML sheet music', 'types' => [
        'musicxml' => 'application/vnd.recordare.musicxml+xml',
        'xml' => 'application/vnd.recordare.musicxml+xml',
        'mxl' => 'application/vnd.recordare.musicxml'
    ]]
];

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

function catalog(): array
{
    static $songs = null;
    $songs ??= json_decode((string) file_get_contents(dirname(__DIR__) . '/data/midi-songs.json'), true) ?: [];
    return $songs;
}

function findSong(mixed $id): ?array
{
    foreach (catalog() as $song) {
        if ($song['id'] === (string) $id) return $song;
    }
    return null;
}

// format => stored file name. Older entries name only their MIDI, as "file".
function songFiles(array $s): array
{
    $files = (array) ($s['files'] ?? []);
    if (!isset($files['midi']) && !empty($s['file'])) $files['midi'] = $s['file'];
    return array_intersect_key(array_filter($files), FORMATS);
}

// What the browser may see: never the stored file names.
function publicSong(array $s): array
{
    return [
        'id' => $s['id'],
        'title' => $s['title'],
        'artist' => $s['artist'],
        'description' => $s['description'],
        'youtubeId' => $s['youtubeId'] ?? '',
        'formats' => array_keys(array_intersect_key(FORMATS, songFiles($s)))  // in FORMATS order
    ];
}

function midiConfig(string $key): string
{
    static $midi = null;
    if ($midi === null) {
        $path = dirname(__DIR__) . '/config.php';
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
    $format = (string) ($_GET['format'] ?? 'midi');
    $file = basename((string) (songFiles($song)[$format] ?? ''));
    if (!isset(FORMATS[$format]) || $file === '') page(404, "This song doesn't have that download.");
    $label = FORMATS[$format]['label'];
    $type = FORMATS[$format]['types'][strtolower(pathinfo($file, PATHINFO_EXTENSION))] ?? null;
    if ($type === null) {
        error_log("Catalog file {$file} for {$song['id']} is not a {$format} file.");
        page(404, "This {$label} file isn't available. Please email info@reecemusic.com.");
    }
    try {
        $path = rtrim(midiConfig('files_dir'), '/') . '/' . $file;
        if (!is_file($path)) page(404, "This {$label} file is being prepared and isn't uploaded yet. Please check back soon, or email info@reecemusic.com.");

        // Count it for admin.php. Stats must never stop the download, so errors are only logged.
        if (!preg_match('/bot|crawl|spider|slurp|preview|headless/i', (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''))) {
            try {
                require_once __DIR__ . '/db.php';
                db()->prepare('INSERT INTO midi_downloads (song_id, format) VALUES (?, ?)')->execute([$song['id'], $format]);
            } catch (Throwable $e) {
                error_log('Download could not be counted: ' . $e->getMessage());
            }
        }

        header('Content-Type: ' . $type);
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
