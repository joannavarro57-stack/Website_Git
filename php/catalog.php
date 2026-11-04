<?php

// The "Play it yourself" song list, shared by midi.php (downloads) and songs.php (managing songs in the admin).
// Songs live in the `songs` table, so deploys never overwrite what the admin changed; data/midi-songs.json only
// seeds the table the first time. Files sit in the private folder set as midi.files_dir in config.php.

declare(strict_types=1);

require_once __DIR__ . '/db.php';

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    http_response_code(404);
    exit;
}

// What each song can offer. The stored file's extension picks the content type.
const FORMATS = [
    'midi' => ['label' => 'MIDI', 'types' => ['mid' => 'audio/midi', 'midi' => 'audio/midi']],
    'pdf' => ['label' => 'PDF sheet music', 'types' => ['pdf' => 'application/pdf']],
    'musicxml' => ['label' => 'MusicXML sheet music', 'types' => [
        'musicxml' => 'application/vnd.recordare.musicxml+xml',
        'xml' => 'application/vnd.recordare.musicxml+xml',
        'mxl' => 'application/vnd.recordare.musicxml'
    ]]
];

final class NotConfigured extends RuntimeException {}

function filesDir(): string
{
    $dir = (string) (siteConfig()['midi']['files_dir'] ?? '');
    if ($dir === '' || str_contains($dir, 'replace-with-')) throw new NotConfigured('midi.files_dir is not set in config.php');
    return rtrim($dir, '/');
}

// Creates the songs table the first time, filled from data/midi-songs.json.
function songsTable(PDO $pdo): void
{
    static $ready = false;
    if ($ready) return;
    $exists = (bool) $pdo->query("SHOW TABLES LIKE 'songs'")->fetch();
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS songs ('
        . 'id VARCHAR(100) NOT NULL,'
        . 'title VARCHAR(200) NOT NULL,'
        . 'artist VARCHAR(200) NOT NULL,'
        . 'description TEXT NOT NULL,'
        . 'youtube_id VARCHAR(11) NOT NULL DEFAULT \'\','
        . 'midi_file VARCHAR(255) NULL,'
        . 'pdf_file VARCHAR(255) NULL,'
        . 'musicxml_file VARCHAR(255) NULL,'
        . 'position INT UNSIGNED NOT NULL DEFAULT 0,'
        . 'created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,'
        . 'PRIMARY KEY (id)'
        . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    if (!$exists) {
        $seed = json_decode((string) @file_get_contents(dirname(__DIR__) . '/data/midi-songs.json'), true) ?: [];
        $insert = $pdo->prepare(
            'INSERT IGNORE INTO songs (id, title, artist, description, youtube_id, midi_file, pdf_file, musicxml_file, position)'
            . ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($seed as $i => $s) {
            $files = (array) ($s['files'] ?? []);
            $insert->execute([
                $s['id'], $s['title'], $s['artist'], $s['description'] ?? '', $s['youtubeId'] ?? '',
                $files['midi'] ?? ($s['file'] ?? null), $files['pdf'] ?? null, $files['musicxml'] ?? null, $i + 1
            ]);
        }
    }
    $ready = true;
}

// All songs in display order, as id => [title, artist, description, youtubeId, files => [format => file name]].
function catalog(): array
{
    $pdo = db();
    songsTable($pdo);
    $songs = [];
    foreach ($pdo->query('SELECT * FROM songs ORDER BY position, created_at') as $row) {
        $songs[$row['id']] = [
            'id' => $row['id'],
            'title' => $row['title'],
            'artist' => $row['artist'],
            'description' => $row['description'],
            'youtubeId' => $row['youtube_id'],
            'files' => array_filter(['midi' => $row['midi_file'], 'pdf' => $row['pdf_file'], 'musicxml' => $row['musicxml_file']])
        ];
    }
    return $songs;
}

function findSong(mixed $id): ?array
{
    return catalog()[(string) $id] ?? null;
}

// Where a song's file for one format is, or null when it isn't on the server (yet).
function storedFile(array $song, string $format): ?string
{
    $file = basename((string) ($song['files'][$format] ?? ''));
    if ($file === '') return null;
    try {
        $path = filesDir() . '/' . $file;
    } catch (NotConfigured $e) {
        return null;
    }
    return is_file($path) ? $path : null;
}
