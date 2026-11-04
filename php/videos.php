<?php

// Admin: manage the YouTube videos in the Sight & Sound galleries.
//   GET  videos.php                       → a table of videos per gallery, with the add form
//   GET  videos.php?edit=…#video-…        → that video's row as an edit form
//   POST videos.php  action=add           → new video (youtube, gallery, title, note)
//   POST videos.php  action=update&id=…   → edit its link, gallery, title or note
//   POST videos.php  action=move&id=…&dir=up|down, action=delete&id=…

declare(strict_types=1);

require __DIR__ . '/admin-common.php';
require __DIR__ . '/video-catalog.php';

final class VideoProblem extends RuntimeException {}

if (!$signedIn) redirect('admin.php');

function clip(string $text, int $length): string
{
    return function_exists('mb_substr') ? mb_substr($text, 0, $length) : substr($text, 0, $length);
}

// Accepts a bare 11-character video ID or any usual YouTube link.
function youtubeId(string $input): string
{
    $input = trim($input);
    if (preg_match('~^[A-Za-z0-9_-]{11}$~', $input)) return $input;
    if (preg_match('~(?:youtu\.be/|[?&]v=|/embed/|/shorts/|/live/)([A-Za-z0-9_-]{11})~', $input, $m)) return $m[1];
    throw new VideoProblem($input === ''
        ? 'Paste the video\'s YouTube link, e.g. https://youtu.be/abc123XYZ_0'
        : 'That YouTube link wasn\'t recognised. Paste the video\'s address, e.g. https://youtu.be/abc123XYZ_0');
}

function videoDetails(): array
{
    $gallery = (string) ($_POST['gallery'] ?? '');
    if (!isset(GALLERIES[$gallery])) throw new VideoProblem('Choose which gallery the video goes in.');
    return [
        'youtube_id' => youtubeId((string) ($_POST['youtube'] ?? '')),
        'gallery' => $gallery,
        'title' => clip(trim((string) ($_POST['title'] ?? '')), 200),
        'note' => clip(trim((string) ($_POST['note'] ?? '')), 300)
    ];
}

function nextPosition(PDO $pdo, string $gallery): int
{
    $statement = $pdo->prepare('SELECT COALESCE(MAX(position), 0) + 1 FROM gallery_videos WHERE gallery = ?');
    $statement->execute([$gallery]);
    return (int) $statement->fetchColumn();
}

function videoName(array $video): string
{
    return $video['title'] !== '' ? '"' . $video['title'] . '"' : 'the video';
}

// ---------- form actions (each ends in a redirect, so a refresh never repeats it) ----------

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!validCsrf()) {
        flash('That form had expired. Please try again.', 'error');
        redirect('videos.php');
    }

    $action = (string) ($_POST['action'] ?? '');
    $id = (int) ($_POST['id'] ?? 0);
    $back = 'videos.php';
    try {
        $pdo = db();
        videosTable($pdo);
        $video = $id ? (galleryVideos()[$id] ?? null) : null;
        if ($action !== 'add' && !$video) throw new VideoProblem('That video is no longer on the list.');

        if ($action === 'add') {
            $back = 'videos.php#add';
            $details = videoDetails();
            $pdo->prepare('INSERT INTO gallery_videos (gallery, youtube_id, title, note, position) VALUES (?, ?, ?, ?, ?)')
                ->execute([$details['gallery'], $details['youtube_id'], $details['title'], $details['note'], nextPosition($pdo, $details['gallery'])]);
            $id = (int) $pdo->lastInsertId();
            $back = 'videos.php#video-' . $id;
            flash('Added ' . videoName($details) . ' to the end of ' . GALLERIES[$details['gallery']] . '.');
        }

        if ($action === 'update') {
            $back = 'videos.php?edit=' . $id . '#video-' . $id;
            $details = videoDetails();
            // A video moved to another gallery joins the end of it.
            $position = $details['gallery'] === $video['gallery'] ? null : nextPosition($pdo, $details['gallery']);
            $pdo->prepare('UPDATE gallery_videos SET gallery = ?, youtube_id = ?, title = ?, note = ?' . ($position ? ', position = ' . $position : '') . ' WHERE id = ?')
                ->execute([$details['gallery'], $details['youtube_id'], $details['title'], $details['note'], $id]);
            flash('Saved ' . videoName($details) . ($position ? ', now at the end of ' . GALLERIES[$details['gallery']] : '') . '.');
            $back = 'videos.php#video-' . $id;
        }

        if ($action === 'move') {
            $ids = array_keys(array_filter(galleryVideos(), static fn($v) => $v['gallery'] === $video['gallery']));
            $i = array_search($id, $ids, true);
            $j = ($_POST['dir'] ?? '') === 'up' ? $i - 1 : $i + 1;
            if (isset($ids[$j])) {
                [$ids[$i], $ids[$j]] = [$ids[$j], $ids[$i]];
                $set = $pdo->prepare('UPDATE gallery_videos SET position = ? WHERE id = ?');
                foreach ($ids as $n => $videoId) $set->execute([$n + 1, $videoId]);
            }
            $back = 'videos.php#video-' . $id;
        }

        if ($action === 'delete') {
            $pdo->prepare('DELETE FROM gallery_videos WHERE id = ?')->execute([$id]);
            $back = 'videos.php#gallery-' . $video['gallery'];
            flash('Removed ' . videoName($video) . ' from ' . GALLERIES[$video['gallery']] . '. It\'s still on YouTube.');
        }
    } catch (VideoProblem $e) {
        flash($e->getMessage(), 'error');
    } catch (Throwable $e) {
        error_log('Videos admin failed: ' . $e->getMessage());
        flash('Something went wrong, and that change may not have been saved. Please try again.', 'error');
    }
    redirect($back);
}

// ---------- page ----------

$flash = takeFlash();
$byGallery = array_fill_keys(array_keys(GALLERIES), []);
$loadError = '';
try {
    foreach (galleryVideos() as $id => $video) $byGallery[$video['gallery']][$id] = $video;
} catch (Throwable $e) {
    error_log('Videos admin failed: ' . $e->getMessage());
    $loadError = 'The database is unavailable. Check the database settings in config.php.';
}
$editId = (int) ($_GET['edit'] ?? 0);

function galleryOptions(string $selected): void
{
    foreach (GALLERIES as $key => $label): ?>
                <option value="<?= h($key) ?>"<?= $key === $selected ? ' selected' : '' ?>><?= h($label) ?></option>
<?php endforeach;
}

pageStart('YouTube', 'videos.php', true);
?>
      <div class="admin-head">
        <div>
          <p class="kicker">Sight &amp; Sound</p>
          <h1>YouTube videos</h1>
        </div>
        <a class="text-link" href="../pages/sight-and-sound.html" target="_blank" rel="noopener">View the galleries on the site</a>
      </div>

<?php if ($flash): ?>
      <p class="notice<?= $flash['kind'] === 'error' ? ' is-error' : '' ?>" role="status" style="margin-bottom:24px"><?= h($flash['message']) ?></p>
<?php endif; ?>

<?php if ($loadError): ?>
      <p class="notice is-error"><?= h($loadError) ?></p>
<?php else: ?>
      <details class="card song-card is-new" id="add">
        <summary><h3>Add a video</h3></summary>
        <form method="post" action="videos.php">
          <?= csrfField() ?>
          <input type="hidden" name="action" value="add">
          <div class="field-grid">
            <label class="field field-wide"><span>YouTube link</span><input type="text" name="youtube" required placeholder="https://youtu.be/…"></label>
            <label class="field"><span>Gallery</span><select name="gallery" required>
<?php galleryOptions(''); ?>
            </select></label>
            <label class="field"><span>Title (optional)</span><input type="text" name="title" maxlength="200" placeholder="e.g. Adele - Skyfall"></label>
            <label class="field field-wide"><span>Note under the title (optional)</span><input type="text" name="note" maxlength="300"></label>
          </div>
          <p class="hint">New videos go to the end of their gallery. Use Move up to bring one forward.</p>
          <div class="card-actions"><button class="btn btn-brass" type="submit">Add video</button></div>
        </form>
      </details>

<?php foreach ($byGallery as $gallery => $videos): $last = count($videos) - 1; ?>
      <h2 id="gallery-<?= h($gallery) ?>"><?= h(GALLERIES[$gallery]) ?><small><?= count($videos) ?> <?= count($videos) === 1 ? 'video' : 'videos' ?>, in the order visitors see them</small></h2>
      <div class="table-scroll">
        <table class="video-table">
          <thead><tr><th class="num">#</th><th>Video</th><th>Note</th><th>YouTube</th><th class="num"><span class="visually-hidden">Actions</span></th></tr></thead>
          <tbody>
<?php if (!$videos): ?>
            <tr class="empty-row"><td colspan="5">No videos in this gallery yet.<?= $gallery === 'original' ? ' Until there are, the site shows a "coming soon" note here.' : ' It stays hidden on the site until one is added.' ?></td></tr>
<?php endif; ?>
<?php $n = 0; foreach ($videos as $id => $video): $form = 'edit-' . $id; ?>
            <tr id="video-<?= $id ?>"<?= $id === $editId ? ' class="is-editing"' : '' ?>>
              <td class="num muted"><?= $n + 1 ?></td>
<?php if ($id === $editId): ?>
              <td>
                <form id="<?= $form ?>" method="post" action="videos.php"><?= csrfField() ?><input type="hidden" name="action" value="update"><input type="hidden" name="id" value="<?= $id ?>"></form>
                <label class="visually-hidden" for="<?= $form ?>-title">Title</label>
                <input id="<?= $form ?>-title" form="<?= $form ?>" type="text" name="title" maxlength="200" value="<?= h($video['title']) ?>" placeholder="Title" autofocus>
              </td>
              <td><label class="visually-hidden" for="<?= $form ?>-note">Note</label><input id="<?= $form ?>-note" form="<?= $form ?>" type="text" name="note" maxlength="300" value="<?= h($video['note']) ?>" placeholder="Note (optional)"></td>
              <td class="video-edit-link">
                <label class="visually-hidden" for="<?= $form ?>-youtube">YouTube link</label>
                <input id="<?= $form ?>-youtube" form="<?= $form ?>" type="text" name="youtube" required value="<?= h('https://youtu.be/' . $video['youtube']) ?>">
                <label class="visually-hidden" for="<?= $form ?>-gallery">Gallery</label>
                <select id="<?= $form ?>-gallery" form="<?= $form ?>" name="gallery" required>
<?php galleryOptions($video['gallery']); ?>
                </select>
              </td>
              <td class="num">
                <div class="row-actions">
                  <button class="btn btn-brass btn-small" form="<?= $form ?>" type="submit">Save</button>
                  <a class="btn btn-ghost btn-small" href="videos.php#video-<?= $id ?>">Cancel</a>
                </div>
              </td>
<?php else: ?>
              <td>
                <div class="video-cell">
                  <img class="video-thumb" src="https://i.ytimg.com/vi/<?= h($video['youtube']) ?>/default.jpg" alt="" loading="lazy" width="64" height="36">
                  <span><?= $video['title'] !== '' ? h($video['title']) : '<span class="muted">Untitled</span>' ?></span>
                </div>
              </td>
              <td class="muted"><?= $video['note'] !== '' ? h($video['note']) : '&ndash;' ?></td>
              <td><a href="https://www.youtube.com/watch?v=<?= h($video['youtube']) ?>" target="_blank" rel="noopener"><?= h($video['youtube']) ?></a></td>
              <td class="num">
                <div class="row-actions">
<?php foreach (['up' => ['↑', 'Move up'], 'down' => ['↓', 'Move down']] as $way => [$arrow, $text]): $off = ($way === 'up' && $n === 0) || ($way === 'down' && $n === $last); ?>
                  <form method="post" action="videos.php"><?= csrfField() ?><input type="hidden" name="action" value="move"><input type="hidden" name="id" value="<?= $id ?>"><input type="hidden" name="dir" value="<?= $way ?>"><button class="btn btn-ghost btn-small btn-icon" type="submit" title="<?= $text ?>" aria-label="<?= $text ?>"<?= $off ? ' disabled' : '' ?>><?= $arrow ?></button></form>
<?php endforeach; ?>
                  <a class="btn btn-ghost btn-small" href="videos.php?edit=<?= $id ?>#video-<?= $id ?>">Edit</a>
                  <form method="post" action="videos.php" onsubmit="return confirm(<?= h(json_encode('Remove ' . videoName($video) . ' from ' . GALLERIES[$gallery] . '? It stays on YouTube.')) ?>)">
                    <?= csrfField() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= $id ?>">
                    <button class="btn btn-danger btn-small" type="submit">Remove</button>
                  </form>
                </div>
              </td>
<?php endif; ?>
            </tr>
<?php $n++; endforeach; ?>
          </tbody>
        </table>
      </div>
<?php endforeach; ?>
<?php endif; ?>
<?php pageEnd(); ?>
