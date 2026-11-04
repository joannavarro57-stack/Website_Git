<?php

// Admin: manage the "Play it yourself" songs and upload their MIDI, PDF and MusicXML files.
//   GET  songs.php                       → song list with add/edit forms
//   POST songs.php  action=add           → new song (title, artist, description, youtube, files[format])
//   POST songs.php  action=update&id=…   → edit details, upload or remove files
//   POST songs.php  action=move&id=…&dir=up|down, action=delete&id=…
// Files are saved as <song id>.<extension> in the private folder (midi.files_dir in config.php).

declare(strict_types=1);

require __DIR__ . '/admin-common.php';
require __DIR__ . '/catalog.php';

const MAX_FILE_BYTES = 25 * 1024 * 1024;

if (!$signedIn) redirect('admin.php');

function bytesFromIni(string $value): int
{
    $value = trim($value);
    $number = (int) $value;
    return match (strtolower(substr($value, -1))) {
        'g' => $number * 1024 ** 3,
        'm' => $number * 1024 ** 2,
        'k' => $number * 1024,
        default => $number
    };
}

// The largest file that gets through: our own cap, or the server's PHP limits if lower.
function uploadLimit(): int
{
    $limits = [MAX_FILE_BYTES, bytesFromIni((string) ini_get('upload_max_filesize')), bytesFromIni((string) ini_get('post_max_size'))];
    return min(array_filter($limits, static fn($n) => $n > 0));
}

function clip(string $text, int $length): string
{
    return function_exists('mb_substr') ? mb_substr($text, 0, $length) : substr($text, 0, $length);
}

function sizeLabel(int $bytes): string
{
    return $bytes >= 1048576 ? round($bytes / 1048576, 1) . ' MB' : max(1, (int) round($bytes / 1024)) . ' KB';
}

// Accepts a bare 11-character video ID or any usual YouTube link.
function youtubeId(string $input): string
{
    $input = trim($input);
    if ($input === '') return '';
    if (preg_match('~^[A-Za-z0-9_-]{11}$~', $input)) return $input;
    if (preg_match('~(?:youtu\.be/|[?&]v=|/embed/|/shorts/|/live/)([A-Za-z0-9_-]{11})~', $input, $m)) return $m[1];
    throw new UploadProblem('That YouTube link wasn\'t recognised. Paste the video\'s address, e.g. https://youtu.be/abc123XYZ_0');
}

// Checks the start of the file really is that kind of file, whatever its name says.
function looksLike(string $format, string $extension, string $path): bool
{
    $head = (string) file_get_contents($path, false, null, 0, 4096);
    return match ($format) {
        'midi' => str_starts_with($head, 'MThd') || str_starts_with($head, 'RIFF'),
        'pdf' => str_contains(substr($head, 0, 1024), '%PDF-'),
        'musicxml' => $extension === 'mxl'
            ? str_starts_with($head, "PK\x03\x04")
            : (str_contains($head, '<score-partwise') || str_contains($head, '<score-timewise')),
        default => false
    };
}

// Saves one uploaded file for a song and returns its stored name, or null when nothing was chosen.
function storeUpload(string $format, string $songId, ?string $oldFile): ?string
{
    $upload = $_FILES['files']['error'][$format] ?? UPLOAD_ERR_NO_FILE;
    if ($upload === UPLOAD_ERR_NO_FILE) return null;
    $label = FORMATS[$format]['label'];
    if ($upload === UPLOAD_ERR_INI_SIZE || $upload === UPLOAD_ERR_FORM_SIZE) {
        throw new UploadProblem("The {$label} file is too big. The limit is " . sizeLabel(uploadLimit()) . '.');
    }
    if ($upload !== UPLOAD_ERR_OK) throw new UploadProblem("The {$label} file didn't upload completely. Please try again.");

    $tmp = $_FILES['files']['tmp_name'][$format];
    $name = (string) $_FILES['files']['name'][$format];
    $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    $allowed = array_keys(FORMATS[$format]['types']);
    if (!in_array($extension, $allowed, true)) {
        throw new UploadProblem("\"{$name}\" isn't a {$label} file. Use a ." . implode(', .', $allowed) . ' file.');
    }
    if (filesize($tmp) > MAX_FILE_BYTES) throw new UploadProblem("The {$label} file is too big. The limit is " . sizeLabel(uploadLimit()) . '.');
    if (!looksLike($format, $extension, $tmp)) throw new UploadProblem("\"{$name}\" doesn't look like a real {$label} file. Please check it opens on your computer.");

    $dir = filesDir();
    if (!is_dir($dir) && !@mkdir($dir, 0750, true)) throw new UploadProblem("The private files folder ({$dir}) doesn't exist and couldn't be created.");
    $file = $songId . '.' . $extension;
    // Write next to the target, then swap it in, so a visitor never downloads half a file.
    $partial = $dir . '/.' . $file . '.' . bin2hex(random_bytes(4));
    if (!move_uploaded_file($tmp, $partial) || !rename($partial, $dir . '/' . $file)) {
        @unlink($partial);
        throw new UploadProblem("The {$label} file couldn't be saved in {$dir}. Check that folder exists and PHP can write to it.");
    }
    if ($oldFile && basename($oldFile) !== $file) @unlink($dir . '/' . basename($oldFile));
    return $file;
}

function songDetails(): array
{
    $title = trim((string) ($_POST['title'] ?? ''));
    $artist = trim((string) ($_POST['artist'] ?? ''));
    if ($title === '' || $artist === '') throw new UploadProblem('Every song needs a title and an artist.');
    return [
        'title' => clip($title, 200),
        'artist' => clip($artist, 200),
        'description' => clip(trim((string) ($_POST['description'] ?? '')), 2000),
        'youtube_id' => youtubeId((string) ($_POST['youtube'] ?? ''))
    ];
}

// ---------- form actions (each ends in a redirect, so a refresh never repeats it) ----------

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // A request bigger than post_max_size arrives with every field empty, so check that before anything else.
    if (!$_POST && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
        flash('Those files are too big to upload together. The limit is ' . sizeLabel(uploadLimit()) . ' in total; try one file at a time.', 'error');
        redirect('songs.php');
    }
    if (!validCsrf()) {
        flash('That form had expired. Please try again.', 'error');
        redirect('songs.php');
    }

    $action = (string) ($_POST['action'] ?? '');
    $id = (string) ($_POST['id'] ?? '');
    $back = 'songs.php';
    try {
        $pdo = db();
        songsTable($pdo);
        $song = $id !== '' ? findSong($id) : null;
        if ($action !== 'add' && !$song) throw new UploadProblem('That song no longer exists.');

        if ($action === 'add') {
            $details = songDetails();
            $id = slug($details['title'], $pdo);
            $position = (int) $pdo->query('SELECT COALESCE(MAX(position), 0) + 1 FROM songs')->fetchColumn();
            $pdo->prepare('INSERT INTO songs (id, title, artist, description, youtube_id, position) VALUES (?, ?, ?, ?, ?, ?)')
                ->execute([$id, $details['title'], $details['artist'], $details['description'], $details['youtube_id'], $position]);
            $saved = [];
            try {
                foreach (array_keys(FORMATS) as $format) {
                    $file = storeUpload($format, $id, null);
                    if ($file === null) continue;
                    $pdo->prepare("UPDATE songs SET {$format}_file = ? WHERE id = ?")->execute([$file, $id]);
                    $saved[] = FORMATS[$format]['label'];
                }
            } catch (UploadProblem $e) {
                $back = 'songs.php?open=' . rawurlencode($id) . '#song-' . rawurlencode($id);
                throw new UploadProblem("\"{$details['title']}\" was added, but: " . $e->getMessage());
            }
            flash("Added \"{$details['title']}\"" . ($saved ? ' with its ' . implode(', ', $saved) . '.' : '. Upload its files whenever they\'re ready.'));
        }

        if ($action === 'update') {
            $back = 'songs.php?open=' . rawurlencode($id) . '#song-' . rawurlencode($id);
            $details = songDetails();
            $oldId = $id;
            $id = followTitle($pdo, $song, $details['title']);
            if ($id !== $oldId) {
                $song = findSong($id);
                $back = 'songs.php?open=' . rawurlencode($id) . '#song-' . rawurlencode($id);
            }
            $pdo->prepare('UPDATE songs SET title = ?, artist = ?, description = ?, youtube_id = ? WHERE id = ?')
                ->execute([$details['title'], $details['artist'], $details['description'], $details['youtube_id'], $id]);
            $changes = [];
            foreach (array_keys(FORMATS) as $format) {
                $old = $song['files'][$format] ?? null;
                try {
                    $file = storeUpload($format, $id, $old);
                } catch (UploadProblem $e) {
                    $done = $changes ? ', ' . implode(', ', $changes) : '';
                    throw new UploadProblem("Saved the details of \"{$details['title']}\"{$done}, but: " . $e->getMessage());
                }
                if ($file !== null) {
                    $pdo->prepare("UPDATE songs SET {$format}_file = ? WHERE id = ?")->execute([$file, $id]);
                    $changes[] = 'uploaded the ' . FORMATS[$format]['label'];
                } elseif ($old && !empty($_POST['remove'][$format])) {
                    $pdo->prepare("UPDATE songs SET {$format}_file = NULL WHERE id = ?")->execute([$id]);
                    @unlink(filesDir() . '/' . basename($old));
                    $changes[] = 'removed the ' . FORMATS[$format]['label'];
                }
            }
            flash("Saved \"{$details['title']}\"" . ($changes ? ' and ' . implode(', ', $changes) : '') . '.');
        }

        if ($action === 'move') {
            $ids = array_keys(catalog());
            $i = array_search($id, $ids, true);
            $j = ($_POST['dir'] ?? '') === 'up' ? $i - 1 : $i + 1;
            if (isset($ids[$j])) {
                [$ids[$i], $ids[$j]] = [$ids[$j], $ids[$i]];
                $set = $pdo->prepare('UPDATE songs SET position = ? WHERE id = ?');
                foreach ($ids as $n => $songId) $set->execute([$n + 1, $songId]);
            }
            $back = 'songs.php#song-' . rawurlencode($id);
        }

        if ($action === 'delete') {
            foreach ($song['files'] as $file) {
                try {
                    @unlink(filesDir() . '/' . basename($file));
                } catch (NotConfigured $e) {
                }
            }
            $pdo->prepare('DELETE FROM songs WHERE id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM song_aliases WHERE song_id = ?')->execute([$id]);
            flash("Deleted \"{$song['title']}\" and its files. Its download counts stay on the Stats page.");
        }
    } catch (UploadProblem $e) {
        flash($e->getMessage(), 'error');
    } catch (NotConfigured $e) {
        flash('Files can\'t be uploaded until the private folder is set: add \'midi\' => [\'files_dir\' => \'/home/reecemus/midi-files\'] to config.php.', 'error');
    } catch (Throwable $e) {
        error_log('Songs admin failed: ' . $e->getMessage());
        flash('Something went wrong, and that change may not have been saved. Please try again.', 'error');
    }
    redirect($back);
}

// ---------- page ----------

$flash = takeFlash();
$songs = [];
$loadError = '';
$addressProblems = [];
try {
    // Songs renamed before ids followed titles catch up here, so every address matches its title.
    $pdo = db();
    foreach (catalog() as $song) {
        try {
            followTitle($pdo, $song, $song['title']);
        } catch (Throwable $e) {
            error_log('Updating the address of "' . $song['title'] . '" failed: ' . $e->getMessage());
            $addressProblems[] = '"' . $song['title'] . '" still has the address ?id=' . $song['id'] . ' ('
                . ($e instanceof UploadProblem ? $e->getMessage() : 'the database refused the change: ' . $e->getMessage()) . ')';
        }
    }
    $songs = catalog();
} catch (Throwable $e) {
    error_log('Songs admin failed: ' . $e->getMessage());
    $loadError = 'The database is unavailable. Check the database settings in config.php.';
}
try {
    $dir = filesDir();
    $dirProblem = is_dir($dir) ? (is_writable($dir) ? '' : "PHP can't write to the private files folder ({$dir}), so uploads will fail.") : '';
} catch (NotConfigured $e) {
    $dirProblem = 'Uploads are off until the private files folder is set in config.php: \'midi\' => [\'files_dir\' => \'/home/reecemus/midi-files\'].';
}
$open = (string) ($_GET['open'] ?? '');
$accept = static fn(string $format) => implode(',', array_map(static fn($e) => '.' . $e, array_keys(FORMATS[$format]['types'])));

function fileRow(array $song, string $format, callable $accept): void
{
    $file = $song['files'][$format] ?? null;
    $path = storedFile($song, $format);
    $label = FORMATS[$format]['label'];
    ?>
          <div class="file-row">
            <strong><?= h($label) ?></strong>
            <div>
<?php if ($path): ?>
              <p class="status" style="margin:0 0 8px"><?= h(basename($path)) ?> · <?= sizeLabel((int) filesize($path)) ?> · uploaded <?= h(date('j M Y', (int) filemtime($path))) ?></p>
<?php elseif ($file): ?>
              <p class="status is-missing" style="margin:0 0 8px">Expected <?= h($file) ?>, but it isn't in the files folder. Upload it here.</p>
<?php else: ?>
              <p class="status" style="margin:0 0 8px">Not uploaded. Visitors won't see a <?= h($label) ?> download.</p>
<?php endif; ?>
              <div class="controls">
                <input type="file" name="files[<?= $format ?>]" accept="<?= h($accept($format)) ?>" aria-label="<?= h(($file ? 'Replace ' : 'Upload ') . $label) ?>">
<?php if ($file): ?>
                <label class="remove"><input type="checkbox" name="remove[<?= $format ?>]" value="1"> Remove</label>
<?php endif; ?>
              </div>
            </div>
          </div>
<?php
}

pageStart('Songs', 'songs.php', true);
?>
      <div class="admin-head">
        <div>
          <p class="kicker">Play it yourself</p>
          <h1>Songs</h1>
        </div>
        <a class="text-link" href="../pages/learn.html" target="_blank" rel="noopener">View the song list on the site</a>
      </div>

<?php if ($flash): ?>
      <p class="notice<?= $flash['kind'] === 'error' ? ' is-error' : '' ?>" role="status" style="margin-bottom:24px"><?= h($flash['message']) ?></p>
<?php endif; ?>
<?php foreach ($addressProblems as $addressProblem): ?>
      <p class="notice is-error" style="margin-bottom:24px"><?= h($addressProblem) ?></p>
<?php endforeach; ?>
<?php if ($dirProblem): ?>
      <p class="notice is-error" style="margin-bottom:24px"><?= h($dirProblem) ?></p>
<?php endif; ?>

<?php if ($loadError): ?>
      <p class="notice is-error"><?= h($loadError) ?></p>
<?php else: ?>
      <details class="card song-card is-new"<?= !$songs ? ' open' : '' ?>>
        <summary><h3>Add a song</h3></summary>
        <form method="post" action="songs.php" enctype="multipart/form-data">
          <?= csrfField() ?>
          <input type="hidden" name="action" value="add">
          <div class="field-grid">
            <label class="field"><span>Title</span><input type="text" name="title" required maxlength="200"></label>
            <label class="field"><span>Artist</span><input type="text" name="artist" required maxlength="200"></label>
            <label class="field field-wide"><span>Short description</span><textarea name="description" maxlength="2000" placeholder="What makes it worth learning, e.g. 'The iconic piano riff, broken down for beginners.'"></textarea></label>
            <label class="field field-wide"><span>YouTube tutorial (optional)</span><input type="text" name="youtube" placeholder="https://youtu.be/…"></label>
          </div>
          <div class="files">
<?php foreach (array_keys(FORMATS) as $format): ?>
            <div class="file-row">
              <strong><?= h(FORMATS[$format]['label']) ?></strong>
              <div class="controls"><input type="file" name="files[<?= $format ?>]" accept="<?= h($accept($format)) ?>" aria-label="<?= h(FORMATS[$format]['label']) ?>"></div>
            </div>
<?php endforeach; ?>
          </div>
          <p class="hint">All files are optional and can be added later. Up to <?= sizeLabel(uploadLimit()) ?> each. MusicXML can be .musicxml, .xml or compressed .mxl.</p>
          <div class="card-actions"><button class="btn btn-brass" type="submit">Add song</button></div>
        </form>
      </details>

      <h2>On the site<small><?= count($songs) ?> <?= count($songs) === 1 ? 'song' : 'songs' ?>, in the order visitors see them</small></h2>
<?php if (!$songs): ?>
      <p class="muted">No songs yet. Add the first one above.</p>
<?php endif; ?>
<?php $last = count($songs) - 1; $n = 0; ?>
<?php foreach ($songs as $id => $song): ?>
      <details class="card song-card" id="song-<?= h($id) ?>"<?= $open === $id ? ' open' : '' ?>>
        <summary>
          <h3><?= h($song['title']) ?><small><?= h($song['artist']) ?></small></h3>
          <span class="badges">
<?php foreach (array_keys(FORMATS) as $format): $here = storedFile($song, $format) !== null; $named = isset($song['files'][$format]); ?>
            <span class="badge<?= $here ? ' is-on' : ($named ? ' is-missing' : '') ?>" title="<?= h(FORMATS[$format]['label'] . ($here ? ': uploaded' : ($named ? ': file missing' : ': not uploaded'))) ?>"><?= $format === 'musicxml' ? 'XML' : strtoupper($format) ?></span>
<?php endforeach; ?>
<?php if ($song['youtubeId']): ?>
            <span class="badge is-on" title="Has a YouTube tutorial">Video</span>
<?php endif; ?>
          </span>
        </summary>

        <form method="post" action="songs.php" enctype="multipart/form-data">
          <?= csrfField() ?>
          <input type="hidden" name="action" value="update">
          <input type="hidden" name="id" value="<?= h($id) ?>">
          <div class="field-grid">
            <label class="field"><span>Title</span><input type="text" name="title" required maxlength="200" value="<?= h($song['title']) ?>"></label>
            <label class="field"><span>Artist</span><input type="text" name="artist" required maxlength="200" value="<?= h($song['artist']) ?>"></label>
            <label class="field field-wide"><span>Short description</span><textarea name="description" maxlength="2000"><?= h($song['description']) ?></textarea></label>
            <label class="field field-wide"><span>YouTube tutorial (optional)</span><input type="text" name="youtube" placeholder="https://youtu.be/…" value="<?= $song['youtubeId'] ? h('https://youtu.be/' . $song['youtubeId']) : '' ?>"></label>
          </div>
          <div class="files">
<?php foreach (array_keys(FORMATS) as $format) fileRow($song, $format, $accept); ?>
          </div>
          <p class="hint">Choosing a new file replaces the old one. Up to <?= sizeLabel(uploadLimit()) ?> each.</p>
          <div class="card-actions">
            <button class="btn btn-brass" type="submit">Save changes</button>
            <a class="text-link" href="../pages/song.html?id=<?= h(rawurlencode($id)) ?>" target="_blank" rel="noopener">View on the site</a>
          </div>
        </form>

        <div class="card-actions">
<?php foreach (['up' => 'Move up', 'down' => 'Move down'] as $way => $text): if (($way === 'up' && $n === 0) || ($way === 'down' && $n === $last)) continue; ?>
          <form method="post" action="songs.php"><?= csrfField() ?><input type="hidden" name="action" value="move"><input type="hidden" name="id" value="<?= h($id) ?>"><input type="hidden" name="dir" value="<?= $way ?>"><button class="btn btn-ghost btn-small" type="submit"><?= $text ?></button></form>
<?php endforeach; ?>
          <span class="spacer"></span>
          <form method="post" action="songs.php" onsubmit="return confirm(<?= h(json_encode('Delete "' . $song['title'] . '" and all its files? This can\'t be undone.')) ?>)">
            <?= csrfField() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= h($id) ?>">
            <button class="btn btn-danger btn-small" type="submit">Delete song</button>
          </form>
        </div>
      </details>
<?php $n++; endforeach; ?>
<?php endif; ?>
<?php pageEnd(); ?>
