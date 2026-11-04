<?php

// Private stats page: mailing-list subscribers and YouTube plays/clicks on the site.
// Sign in with the password set under 'admin' in config.php.
//   GET admin.php                     → dashboard (or the sign-in form)
//   GET admin.php?export=subscribers  → subscribers as a CSV file

declare(strict_types=1);

require __DIR__ . '/db.php';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header("Content-Security-Policy: frame-ancestors 'none'");
header('Referrer-Policy: same-origin');

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Strict'
]);
session_name('reece_admin');
session_start();

function h(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

// Returns the admin password, or '' with $problem saying why the page is switched off.
function adminPassword(?string &$problem): string
{
    $path = dirname(__DIR__) . '/config.php';
    // Hosts can cache PHP files for a while; make sure a just-saved config.php is read fresh.
    if (function_exists('opcache_invalidate')) @opcache_invalidate($path, true);
    try {
        $admin = siteConfig()['admin'] ?? null;
    } catch (Throwable $error) {
        $problem = is_file($path)
            // Only the line number: the parser's message can quote the file's passwords.
            ? 'config.php has a mistake on or just before line ' . $error->getLine() . ' (often a missing comma).'
            : 'There is no config.php in public_html.';
        return '';
    }
    $password = (string) ($admin['password'] ?? '');
    if (!is_array($admin)) $problem = 'config.php in public_html has no \'admin\' section.';
    elseif ($password === '' || str_contains($password, 'replace-with-')) $problem = 'The \'admin\' password in config.php is empty or still the placeholder.';
    else return $password;
    return '';
}

$problem = null;
$password = adminPassword($problem);
$error = '';

if (isset($_GET['logout'])) {
    $_SESSION = [];
    session_destroy();
    header('Location: admin.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $password !== '' && isset($_POST['password'])) {
    if (hash_equals($password, (string) $_POST['password'])) {
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
        header('Location: admin.php');
        exit;
    }
    sleep(2); // slows down password guessing
    $error = 'That password is not right.';
}

$signedIn = $password !== '' && !empty($_SESSION['admin']);
$_SESSION['csrf'] ??= bin2hex(random_bytes(16));

// Same address in any letter case or with stray spaces counts as one subscriber.
const SAME_EMAIL = 'LOWER(TRIM(keep.email)) = LOWER(TRIM(extra.email))';

if ($signedIn && ($_POST['action'] ?? '') === 'dedupe' && hash_equals($_SESSION['csrf'], (string) ($_POST['csrf'] ?? ''))) {
    try {
        $pdo = db();
        // Keep each person's first signup (lowest id) and delete the later copies.
        $removed = $pdo->exec(
            'DELETE extra FROM mailing_list_subscribers extra JOIN mailing_list_subscribers keep'
            . ' ON ' . SAME_EMAIL . ' AND keep.id < extra.id'
        );
        // Make sure the database refuses repeats from now on (tables made by hand may lack this).
        $hasUnique = $pdo->query("SHOW INDEX FROM mailing_list_subscribers WHERE Column_name = 'email' AND Non_unique = 0")->fetch();
        if (!$hasUnique) $pdo->exec('ALTER TABLE mailing_list_subscribers ADD UNIQUE KEY uq_mailing_list_email (email)');
        $_SESSION['flash'] = $removed === 1 ? 'Removed 1 duplicate subscriber.' : "Removed {$removed} duplicate subscribers.";
    } catch (Throwable $exception) {
        error_log('Removing duplicate subscribers failed: ' . $exception->getMessage());
        $_SESSION['flash'] = 'Something went wrong while removing duplicates. The list below shows what is on it now.';
    }
    header('Location: admin.php');
    exit;
}
$flash = $_SESSION['flash'] ?? '';
unset($_SESSION['flash']);

if ($signedIn && ($_GET['export'] ?? '') === 'subscribers') {
    $rows = db()->query('SELECT email, source, subscribed_at FROM mailing_list_subscribers ORDER BY subscribed_at DESC')->fetchAll();
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="reece-music-subscribers-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['Email', 'Signed up from', 'Date']);
    foreach ($rows as $row) {
        // A leading = + - @ would run as a formula in Excel.
        $row = array_map(static fn($v) => preg_match('/^[=+\-@]/', (string) $v) ? "'" . $v : $v, $row);
        fputcsv($out, array_values($row));
    }
    fclose($out);
    exit;
}

$data = null;
$dbError = '';
if ($signedIn) {
    try {
        $pdo = db();
        $data = [
            'subscribers' => $pdo->query('SELECT email, source, subscribed_at FROM mailing_list_subscribers ORDER BY subscribed_at DESC')->fetchAll(),
            'duplicates' => (int) $pdo->query(
                'SELECT COUNT(DISTINCT extra.id) FROM mailing_list_subscribers extra JOIN mailing_list_subscribers keep'
                . ' ON ' . SAME_EMAIL . ' AND keep.id < extra.id'
            )->fetchColumn(),
            'plays' => (int) $pdo->query('SELECT COUNT(*) FROM video_clicks WHERE kind = \'play\'')->fetchColumn(),
            'videos' => $pdo->query(
                'SELECT video_id, MAX(title) AS title, COUNT(*) AS total, SUM(kind = \'play\') AS plays, SUM(kind = \'link\') AS links,'
                . ' SUM(clicked_at >= NOW() - INTERVAL 30 DAY) AS recent, MAX(clicked_at) AS last_click'
                . ' FROM video_clicks GROUP BY video_id ORDER BY total DESC, last_click DESC'
            )->fetchAll(),
            'pages' => $pdo->query('SELECT page, COUNT(*) AS total FROM video_clicks GROUP BY page ORDER BY total DESC')->fetchAll(),
            'downloads' => $pdo->query(
                'SELECT song_id, COUNT(*) AS total, SUM(downloaded_at >= NOW() - INTERVAL 30 DAY) AS recent, MAX(downloaded_at) AS last_download'
                . ' FROM midi_downloads GROUP BY song_id'
            )->fetchAll(PDO::FETCH_UNIQUE)
        ];

        // Every song in the catalog gets a row, downloaded or not; songs since removed from it still show by id.
        $songs = [];
        foreach (json_decode((string) @file_get_contents(dirname(__DIR__) . '/data/midi-songs.json'), true) ?: [] as $song) {
            $songs[$song['id']] = ['title' => $song['title'], 'artist' => $song['artist'], 'total' => 0, 'recent' => 0, 'last_download' => null];
        }
        foreach ($data['downloads'] as $id => $row) {
            $songs[$id] = array_merge($songs[$id] ?? ['title' => $id, 'artist' => 'No longer on the song list'], $row);
        }
        uasort($songs, static fn($a, $b) => [$b['total'], $a['title']] <=> [$a['total'], $b['title']]);
        $data['songs'] = $songs;
        $data['downloadTotal'] = array_sum(array_column($songs, 'total'));
    } catch (Throwable $exception) {
        error_log('Admin stats failed: ' . $exception->getMessage());
        $dbError = 'The database is unavailable. Check the database settings in config.php.';
    }
}

$pageNames = ['/' => 'Home', '/index.html' => 'Home'];
// Pages live in /pages/; clicks recorded before the move used the old top-level addresses.
foreach (['sight-and-sound' => 'Sight & Sound', 'learn' => 'Play it yourself', 'song' => 'Song pages',
          'gigs' => 'Gigs', 'shop' => 'Shop', 'about' => 'About'] as $file => $name) {
    $pageNames["/pages/$file.html"] = $name;
    $pageNames["/$file.html"] = $name;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Admin | Reece Music</title>
  <link rel="icon" type="image/png" href="../images/reece-favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=Hanken+Grotesk:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/reece.css?v=2026-11-admin-link">
  <style>
    .admin { padding: clamp(40px, 6vw, 72px) 0 96px; }
    .admin-head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 40px; }
    .admin h2 { font-size: clamp(1.6rem, 3vw, 2.2rem); margin: 56px 0 18px; }
    .admin h2 small { font-family: var(--body); font-size: 1rem; color: var(--muted); margin-left: 10px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    .stat { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 18px 20px; }
    .stat strong { display: block; font-family: var(--display); font-size: 2.4rem; line-height: 1.1; color: var(--accent); font-variant-numeric: tabular-nums; }
    .stat span { color: var(--muted); font-size: .95rem; }
    .table-scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: .98rem; }
    th, td { text-align: left; padding: 11px 16px; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--muted); font-weight: 500; font-size: .85rem; text-transform: uppercase; letter-spacing: .06em; background: var(--surface); }
    tr:last-child td { border-bottom: 0; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    td a { color: var(--accent); }
    .when { white-space: nowrap; color: var(--muted); }
    .empty-row td { color: var(--muted); text-align: center; padding: 28px; }
    .notice { background: var(--surface); border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 10px; padding: 16px 20px; max-width: 62ch; }
    .login { max-width: 380px; }
    .login label { display: block; margin: 24px 0 8px; color: var(--muted); }
    .login input { width: 100%; padding: 12px 14px; font: inherit; color: var(--mist); background: var(--surface); border: 1px solid rgba(207, 216, 220, .35); border-radius: 10px; }
    .login .btn { margin-top: 16px; }
    .error { color: #F29C9C; margin-top: 12px; }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <a class="wordmark" href="../index.html">Reece <span>Music</span></a>
      <?php if ($signedIn): ?><a class="text-link" href="admin.php?logout=1">Sign out</a><?php endif; ?>
    </div>
  </header>

  <main class="admin">
    <div class="wrap">
<?php if ($password === ''): ?>
      <h1>Admin</h1>
      <p class="notice" style="margin-top:32px">The admin page is switched off. <?= h($problem) ?><br>To switch it on, add a password to <code>public_html/config.php</code> on the server:<br><code>'admin' =&gt; ['password' =&gt; 'your-password-here'],</code></p>
<?php elseif (!$signedIn): ?>
      <form class="login" method="post" action="admin.php">
        <p class="kicker">Reece Music</p>
        <h1>Admin</h1>
        <label for="password">Password</label>
        <input id="password" type="password" name="password" autocomplete="current-password" required autofocus>
        <?php if ($error): ?><p class="error" role="alert"><?= h($error) ?></p><?php endif; ?>
        <button class="btn btn-brass" type="submit">Sign in</button>
      </form>
<?php elseif ($dbError): ?>
      <h1>Admin</h1>
      <p class="notice" style="margin-top:32px"><?= h($dbError) ?></p>
<?php else: ?>
      <div class="admin-head">
        <div>
          <p class="kicker">Reece Music</p>
          <h1>Site stats</h1>
        </div>
        <p class="muted" style="margin:0">Updated <?= h(date('j M Y, H:i')) ?> server time</p>
      </div>

      <div class="stats">
        <div class="stat"><strong><?= count($data['subscribers']) ?></strong><span>Mailing-list subscribers</span></div>
        <div class="stat"><strong><?= (int) $data['plays'] ?></strong><span>Videos played on the site</span></div>
        <div class="stat"><strong><?= (int) $data['downloadTotal'] ?></strong><span>MIDI downloads</span></div>
      </div>

      <div class="admin-head" style="margin:56px 0 18px">
        <h2 style="margin:0">Mailing-list subscribers<small><?= count($data['subscribers']) ?></small></h2>
        <?php if ($data['subscribers']): ?><a class="btn btn-ghost" href="admin.php?export=subscribers">Download CSV</a><?php endif; ?>
      </div>
<?php if ($flash): ?>
      <p class="notice" role="status" style="margin-bottom:18px"><?= h($flash) ?></p>
<?php endif; ?>
<?php if ($data['duplicates']): ?>
      <form class="notice" method="post" action="admin.php" style="margin-bottom:18px" onsubmit="return confirm('Remove <?= $data['duplicates'] ?> duplicate subscriber(s)? Each person keeps their first signup.')">
        <p style="margin:0 0 12px"><?= $data['duplicates'] === 1 ? '1 subscriber is listed twice.' : $data['duplicates'] . ' extra copies of the same email addresses are on the list.' ?> Removing them keeps each person's first signup.</p>
        <input type="hidden" name="action" value="dedupe">
        <input type="hidden" name="csrf" value="<?= h($_SESSION['csrf']) ?>">
        <button class="btn btn-brass" type="submit">Remove duplicates</button>
      </form>
<?php endif; ?>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Email</th><th>Signed up from</th><th>Date</th></tr></thead>
          <tbody>
<?php if (!$data['subscribers']): ?>
            <tr class="empty-row"><td colspan="3">No subscribers yet.</td></tr>
<?php endif; ?>
<?php foreach ($data['subscribers'] as $row): ?>
            <tr>
              <td><a href="mailto:<?= h($row['email']) ?>"><?= h($row['email']) ?></a></td>
              <td><?= h($row['source']) ?></td>
              <td class="when"><?= h(date('j M Y, H:i', strtotime($row['subscribed_at']))) ?></td>
            </tr>
<?php endforeach; ?>
          </tbody>
        </table>
      </div>

      <h2>MIDI downloads by song<small><?= count($data['songs']) ?> songs</small></h2>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Song</th><th>Artist</th><th class="num">Last 30 days</th><th class="num">Total</th><th>Last download</th></tr></thead>
          <tbody>
<?php if (!$data['songs']): ?>
            <tr class="empty-row"><td colspan="5">No songs on the list yet (data/midi-songs.json).</td></tr>
<?php endif; ?>
<?php foreach ($data['songs'] as $id => $row): ?>
            <tr>
              <td><a href="../pages/song.html?id=<?= h(rawurlencode((string) $id)) ?>" target="_blank" rel="noopener"><?= h($row['title']) ?></a></td>
              <td class="muted"><?= h($row['artist']) ?></td>
              <td class="num"><?= (int) $row['recent'] ?></td>
              <td class="num"><strong><?= (int) $row['total'] ?></strong></td>
              <td class="when"><?= $row['last_download'] ? h(date('j M Y, H:i', strtotime($row['last_download']))) : '&ndash;' ?></td>
            </tr>
<?php endforeach; ?>
          </tbody>
        </table>
      </div>

      <h2>YouTube clicks by video<small><?= count($data['videos']) ?> videos</small></h2>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Video</th><th class="num">Played here</th><th class="num">To YouTube</th><th class="num">Last 30 days</th><th class="num">Total</th><th>Last click</th></tr></thead>
          <tbody>
<?php if (!$data['videos']): ?>
            <tr class="empty-row"><td colspan="6">No clicks yet. They appear here as soon as someone plays a video or follows a YouTube link.</td></tr>
<?php endif; ?>
<?php foreach ($data['videos'] as $row): ?>
            <tr>
              <td><?php if ($row['video_id'] === 'channel'): ?>YouTube channel<?php else: ?><a href="https://www.youtube.com/watch?v=<?= h($row['video_id']) ?>" target="_blank" rel="noopener"><?= h($row['title'] !== '' ? $row['title'] : $row['video_id']) ?></a><?php endif; ?></td>
              <td class="num"><?= (int) $row['plays'] ?></td>
              <td class="num"><?= (int) $row['links'] ?></td>
              <td class="num"><?= (int) $row['recent'] ?></td>
              <td class="num"><strong><?= (int) $row['total'] ?></strong></td>
              <td class="when"><?= h(date('j M Y, H:i', strtotime($row['last_click']))) ?></td>
            </tr>
<?php endforeach; ?>
          </tbody>
        </table>
      </div>

<?php if ($data['pages']): ?>
      <h2>Clicks by page</h2>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Page</th><th class="num">Clicks</th></tr></thead>
          <tbody>
<?php
$byName = [];
foreach ($data['pages'] as $row) {
    $name = $pageNames[$row['page']] ?? $row['page'];
    $byName[$name] = ($byName[$name] ?? 0) + (int) $row['total'];
}
arsort($byName);
?>
<?php foreach ($byName as $name => $total): ?>
            <tr><td><?= h((string) $name) ?></td><td class="num"><?= $total ?></td></tr>
<?php endforeach; ?>
          </tbody>
        </table>
      </div>
<?php endif; ?>
<?php endif; ?>
    </div>
  </main>
</body>
</html>
