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
// A problem worth showing the admin as it is, such as a file that couldn't be saved or renamed.
final class UploadProblem extends RuntimeException {}

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
    // A song's old ids after its title changed, so links shared before the change still open it.
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS song_aliases ('
        . 'old_id VARCHAR(100) NOT NULL,'
        . 'song_id VARCHAR(100) NOT NULL,'
        . 'PRIMARY KEY (old_id)'
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
// The first call in each request also brings any song whose id no longer matches its title in line with it.
function catalog(): array
{
    static $synced = false;
    $pdo = db();
    songsTable($pdo);
    $songs = loadSongs($pdo);
    if ($synced) return $songs;
    $synced = true;
    $changed = false;
    foreach ($songs as $song) {
        try {
            $changed = followTitle($pdo, $song, $song['title']) !== $song['id'] || $changed;
        } catch (Throwable $e) {
            error_log('Updating the address of "' . $song['title'] . '" failed: ' . $e->getMessage());
        }
    }
    return $changed ? loadSongs($pdo) : $songs;
}

function loadSongs(PDO $pdo): array
{
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

// "Für Elise" → "fur-elise": spell accented letters plainly before dropping everything else.
function slugBase(string $title): string
{
    // Some iconv builds spell ü as "u or u", so drop those marks too.
    $ascii = function_exists('iconv') ? (string) @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $title) : $title;
    $ascii = str_replace(['"', "'", '`', '^', '~'], '', $ascii);
    $base = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($ascii)), '-');
    return substr($base !== '' ? $base : 'song', 0, 60);
}

// A free id for this title: "fur-elise", or "fur-elise-2" when that's taken by another song.
function slug(string $title, PDO $pdo, string $except = ''): string
{
    $base = slugBase($title);
    $check = $pdo->prepare('SELECT 1 FROM songs WHERE id = ? AND id <> ?');
    for ($id = $base, $n = 2; ; $id = $base . '-' . $n++) {
        $check->execute([$id, $except]);
        if (!$check->fetch()) return $id;
    }
}

// Keeps a song's id (its web address and file names) in step with its title. Download counts move with it.
// Returns the id the song has afterwards.
function followTitle(PDO $pdo, array $song, string $title): string
{
    $id = $song['id'];
    $base = slugBase($title);
    if ($id === $base || preg_match('/^' . preg_quote($base, '/') . '-\d+$/', $id)) return $id;
    $newId = slug($title, $pdo, $id);

    $renamed = [];   // [from, to] paths, so a failure can put them back
    $columns = [];
    try {
        $dir = filesDir();
        foreach ($song['files'] as $format => $file) {
            $newFile = $newId . '.' . strtolower(pathinfo($file, PATHINFO_EXTENSION));
            $columns[$format] = $newFile;
            $from = $dir . '/' . basename($file);
            if (is_file($from)) {
                if (!rename($from, $dir . '/' . $newFile)) throw new UploadProblem("A file couldn't be renamed to match the new title, so the title wasn't changed.");
                $renamed[] = [$from, $dir . '/' . $newFile];
            }
        }
    } catch (NotConfigured $e) {
        foreach ($song['files'] as $format => $file) $columns[$format] = $newId . '.' . strtolower(pathinfo($file, PATHINFO_EXTENSION));
    } catch (UploadProblem $e) {
        foreach ($renamed as [$from, $to]) @rename($to, $from);
        throw $e;
    }

    try {
        $pdo->beginTransaction();
        $sets = ['id = ?'];
        $values = [$newId];
        foreach ($columns as $format => $file) {
            $sets[] = "{$format}_file = ?";
            $values[] = $file;
        }
        $values[] = $id;
        $pdo->prepare('UPDATE songs SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($values);
        $pdo->prepare('UPDATE midi_downloads SET song_id = ? WHERE song_id = ?')->execute([$newId, $id]);
        // The old address keeps working, and so do any addresses it had before that.
        $pdo->prepare('UPDATE song_aliases SET song_id = ? WHERE song_id = ?')->execute([$newId, $id]);
        $pdo->prepare('INSERT INTO song_aliases (old_id, song_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE song_id = VALUES(song_id)')->execute([$id, $newId]);
        $pdo->prepare('DELETE FROM song_aliases WHERE old_id = ?')->execute([$newId]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        foreach ($renamed as [$from, $to]) @rename($to, $from);
        throw $e;
    }
    return $newId;
}

// Finds a song by its id, or by an id it had before its title changed.
function findSong(mixed $id): ?array
{
    $songs = catalog();
    $id = (string) $id;
    if (isset($songs[$id])) return $songs[$id];
    $alias = db()->prepare('SELECT song_id FROM song_aliases WHERE old_id = ?');
    $alias->execute([$id]);
    return $songs[(string) $alias->fetchColumn()] ?? null;
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
