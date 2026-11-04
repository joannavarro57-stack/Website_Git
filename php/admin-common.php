<?php

// Shared by the admin pages (admin.php, songs.php): sign-in, the CSRF token, flash messages and the page frame.
// Sign in with the password set under 'admin' in config.php.

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
    if (hash_equals($password, (string) $_POST['password'])) {
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
        header('Location: admin.php');
        exit;
    }
    sleep(2); // slows down password guessing
    $loginError = 'That password is not right.';
}

$signedIn = $password !== '' && !empty($_SESSION['admin']);
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
    $tabs = ['admin.php' => 'Stats', 'songs.php' => 'Songs'];
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
  <link rel="stylesheet" href="../css/reece.css?v=2026-11-frames">
  <link rel="stylesheet" href="../css/admin.css?v=2026-11-songs-2">
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
        <a href="admin.php?logout=1">Sign out</a>
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
