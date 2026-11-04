<?php

// Shared by the admin pages (admin.php, songs.php, videos.php, users.php): sign-in, the CSRF token, flash messages and
// the page frame. Sign in with an email and password added on the Users page, or with no email and the main password
// set under 'admin' in config.php.

declare(strict_types=1);

require_once __DIR__ . '/db.php';

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    http_response_code(404);
    exit;
}

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

// Returns the admin password, or '' with $problem saying why the admin is switched off.
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

// People who can sign in besides the main config.php password, added on the Users page.
function adminUsersTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS admin_users ('
        . 'id INT UNSIGNED NOT NULL AUTO_INCREMENT,'
        . 'name VARCHAR(100) NOT NULL,'
        . 'email VARCHAR(254) NOT NULL,'
        . 'password_hash VARCHAR(255) NOT NULL,'
        . 'created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,'
        . 'last_login TIMESTAMP NULL DEFAULT NULL,'
        . 'PRIMARY KEY (id),'
        . 'UNIQUE KEY uq_admin_users_email (email)'
        . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

$problem = null;
$password = adminPassword($problem);
$loginError = '';

if (isset($_GET['logout'])) {
    $_SESSION = [];
    session_destroy();
    header('Location: admin.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $password !== '' && isset($_POST['password'])) {
    $loginEmail = strtolower(trim((string) ($_POST['email'] ?? '')));
    $given = (string) $_POST['password'];
    $user = null;
    if ($loginEmail === '') {
        if (hash_equals($password, $given)) $user = ['id' => 0, 'name' => 'Main admin'];
    } else {
        try {
            $pdo = db();
            adminUsersTable($pdo);
            $find = $pdo->prepare('SELECT id, name, password_hash FROM admin_users WHERE email = ?');
            $find->execute([$loginEmail]);
            $row = $find->fetch();
            // Checked even when no one has that email, so an unknown email takes as long as a wrong password.
            $matches = password_verify($given, $row['password_hash'] ?? '$2y$10$tb9sbzKn8M.MLehZ1Sd1Bu0fUEPjGnAxXmuQwieuO2j.gazUFweea');
            if ($row && $matches) {
                $user = ['id' => (int) $row['id'], 'name' => $row['name']];
                $pdo->prepare('UPDATE admin_users SET last_login = NOW() WHERE id = ?')->execute([$user['id']]);
            }
        } catch (Throwable $error) {
            error_log('Admin sign-in by email failed: ' . $error->getMessage());
            $loginError = 'Signing in with an email isn\'t working right now. Leave the email empty to use the main password.';
        }
    }
    if ($user) {
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
        $_SESSION['admin_user'] = $user['id'];
        $_SESSION['admin_name'] = $user['name'];
        header('Location: songs.php');
        exit;
    }
    if ($loginError === '') {
        sleep(2); // slows down password guessing
        $loginError = $loginEmail === '' ? 'That password is not right.' : 'That email and password don\'t match.';
    }
}

$signedIn = $password !== '' && !empty($_SESSION['admin']);
// Someone removed on the Users page is signed out on their next click.
if ($signedIn && (int) ($_SESSION['admin_user'] ?? 0) > 0) {
    try {
        $still = db()->prepare('SELECT 1 FROM admin_users WHERE id = ?');
        $still->execute([(int) $_SESSION['admin_user']]);
        $signedIn = (bool) $still->fetchColumn();
    } catch (Throwable $error) {
        error_log('Admin user check failed: ' . $error->getMessage());
        $signedIn = false;
    }
    if (!$signedIn) $_SESSION = [];
}
$_SESSION['csrf'] ??= bin2hex(random_bytes(16));

function csrfField(): string
{
    return '<input type="hidden" name="csrf" value="' . h($_SESSION['csrf']) . '">';
}

function validCsrf(): bool
{
    return hash_equals($_SESSION['csrf'], (string) ($_POST['csrf'] ?? ''));
}

// One message carried across a redirect. $kind is 'ok' or 'error'.
function flash(string $message, string $kind = 'ok'): void
{
    $_SESSION['flash'] = ['message' => $message, 'kind' => $kind];
}

function takeFlash(): ?array
{
    $flash = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return is_array($flash) ? $flash : null;
}

function redirect(string $to): void
{
    header('Location: ' . $to);
    exit;
}

function pageStart(string $title, string $active, bool $signedIn): void
{
    $tabs = ['songs.php' => 'Songs', 'videos.php' => 'YouTube', 'admin.php' => 'Stats', 'users.php' => 'Users'];
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title><?= h($title) ?> | Reece Music admin</title>
  <link rel="icon" type="image/png" href="../images/reece-favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;1,400&family=Hanken+Grotesk:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/reece.css?v=2026-11-saber-once">
  <link rel="stylesheet" href="../css/admin.css?v=2026-11-users">
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <a class="wordmark" href="../index.html">Reece <span>Music</span></a>
<?php if ($signedIn): ?>
      <nav class="admin-nav" aria-label="Admin">
<?php foreach ($tabs as $href => $label): ?>
        <a href="<?= $href ?>"<?= $href === $active ? ' aria-current="page"' : '' ?>><?= $label ?></a>
<?php endforeach; ?>
        <a href="admin.php?logout=1" title="Signed in as <?= h($_SESSION['admin_name'] ?? 'Main admin') ?>">Sign out</a>
      </nav>
<?php endif; ?>
    </div>
  </header>

  <main class="admin">
    <div class="wrap">
<?php
}

function pageEnd(): void
{
    ?>
    </div>
  </main>
</body>
</html>
<?php
}
