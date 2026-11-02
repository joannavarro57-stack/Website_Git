<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

function sendSmtpEmail(array $smtp, string $to, string $subject, string $textBody, string $htmlBody): bool
{
    $host = (string) ($smtp['host'] ?? '');
    $port = (int) ($smtp['port'] ?? 465);
    $encryption = (string) ($smtp['encryption'] ?? 'ssl');
    $username = (string) ($smtp['username'] ?? '');
    $password = (string) ($smtp['password'] ?? '');
    $from = (string) ($smtp['from'] ?? $username);

    if ($host === '' || $username === '' || $password === '' || str_contains($password, 'replace-with-')) {
        error_log('SMTP is not configured with a real mailbox password.');
        return false;
    }

    $transport = $encryption === 'ssl' ? 'ssl://' : 'tcp://';
    $socket = @stream_socket_client($transport . $host . ':' . $port, $errorNumber, $errorMessage, 15);

    if (!is_resource($socket)) {
        error_log("SMTP connection failed: {$errorMessage} ({$errorNumber})");
        return false;
    }

    stream_set_timeout($socket, 15);

    $readResponse = static function () use ($socket): string {
        $response = '';
        while (($line = fgets($socket, 512)) !== false) {
            $response .= $line;
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        return $response;
    };

    $sendCommand = static function (string $command) use ($socket, $readResponse): string {
        fwrite($socket, $command . "\r\n");
        return $readResponse();
    };

    $expect = static function (string $response, array $codes): bool {
        $code = (int) substr($response, 0, 3);
        return in_array($code, $codes, true);
    };

    $valid = $expect($readResponse(), [220]);
    $valid = $valid && $expect($sendCommand('EHLO reecemusic.com'), [250]);
    if (!$valid || $encryption === 'tls' && !$expect($sendCommand('STARTTLS'), [220])) {
        fclose($socket);
        return false;
    }

    if ($encryption === 'tls') {
        $cryptoEnabled = stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        $valid = $cryptoEnabled && $expect($sendCommand('EHLO reecemusic.com'), [250]);
    }

    $valid = $valid && $expect($sendCommand('AUTH LOGIN'), [334]);
    $valid = $valid && $expect($sendCommand(base64_encode($username)), [334]);
    $valid = $valid && $expect($sendCommand(base64_encode($password)), [235]);
    $valid = $valid && $expect($sendCommand('MAIL FROM:<' . $from . '>'), [250]);
    $valid = $valid && $expect($sendCommand('RCPT TO:<' . $to . '>'), [250, 251]);
    $valid = $valid && $expect($sendCommand('DATA'), [354]);

    if (!$valid) {
        error_log('SMTP authentication or envelope validation failed for ' . $username . ' while sending to ' . $to . '.');
        fclose($socket);
        return false;
    }

    $boundary = '=_reece_music_' . bin2hex(random_bytes(12));
    $headers = [
        'From: Reece Music <' . $from . '>',
        'Reply-To: ' . $from,
        'To: ' . $to,
        'Subject: ' . $subject,
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"'
    ];
    $message = implode("\r\n", $headers) . "\r\n\r\n"
        . '--' . $boundary . "\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n"
        . $textBody . "\r\n"
        . '--' . $boundary . "\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n"
        . $htmlBody . "\r\n"
        . '--' . $boundary . "--\r\n.";

    fwrite($socket, $message . "\r\n");
    $sent = $expect($readResponse(), [250]);
    $sendCommand('QUIT');
    fclose($socket);
    return $sent;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

$name = trim((string) ($_POST['name'] ?? ''));
$email = trim((string) ($_POST['email'] ?? ''));
$message = trim((string) ($_POST['message'] ?? ''));
$website = trim((string) ($_POST['website'] ?? ''));
$human = ($_POST['human'] ?? '') === 'yes';
$mailingList = ($_POST['mailing-list'] ?? '') === 'yes';
$source = trim((string) ($_POST['source'] ?? 'homepage'));

if ($website !== '') {
    echo json_encode(['success' => true]);
    exit;
}

if ($mailingList) {
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(422);
        echo json_encode(['error' => 'Please provide a valid email address.']);
        exit;
    }

    $source = preg_replace('/[^a-zA-Z0-9_-]/', '', $source) ?: 'homepage';
    $configPath = __DIR__ . '/config.php';

    if (!is_file($configPath)) {
        http_response_code(500);
        echo json_encode(['error' => 'Mailing list storage is not configured yet.']);
        exit;
    }

    try {
        $config = require $configPath;
        $database = $config['database'];
        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=%s',
            $database['host'],
            $database['name'],
            $database['charset'] ?? 'utf8mb4'
        );
        $pdo = new PDO($dsn, $database['user'], $database['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]);
        $statement = $pdo->prepare(
            'INSERT INTO mailing_list_subscribers (email, source) VALUES (:email, :source) '
            . 'ON DUPLICATE KEY UPDATE source = VALUES(source)'
        );
        $statement->execute(['email' => $email, 'source' => $source]);
    } catch (Throwable $error) {
        error_log('Mailing list signup failed: ' . $error->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'The mailing-list database is unavailable. Check that the table exists and that the database user has access.']);
        exit;
    }

    $smtp = $config['smtp'] ?? [];

    $subject = 'New mailing list signup';
    $body = "Email: {$email}\n";
    $notificationSent = sendSmtpEmail($smtp, 'info@reecemusic.com', $subject, $body, nl2br(htmlspecialchars($body, ENT_QUOTES, 'UTF-8')));
    if (!$notificationSent) {
        error_log('Mailing list signup notification email could not be sent.');
    }

    $welcomeSubject = 'Thanks for joining the Reece Music mailing list';
    $welcomeText = "Thank you for signing up to Reece Music mailing list!\n\n"
        . "Reece Music\n"
        . "info@reecemusic.com\n";
    $welcomeHtml = '<!doctype html>'
        . '<html><body style="margin:0;background:#CFD8DC;color:#04050E;font-family:Arial,sans-serif;">'
        . '<div style="max-width:600px;margin:0 auto;padding:36px 20px;">'
        . '<div style="background:#04050E;padding:28px 30px;border-bottom:4px solid #B39DDB;">'
        . '<img src="https://reecemusic.com/images/reece-logo.jpg" alt="Reece Music" width="64" height="64" style="display:inline-block;vertical-align:middle;width:64px;height:64px;border-radius:50%;">'
        . '<span style="display:inline-block;vertical-align:middle;margin-left:14px;color:#B39DDB;font-size:32px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Reece Music</span>'
        . '</div>'
        . '<div style="background:#FFFFFF;padding:36px 30px;">'
        . '<h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:700;">Thank you for signing up to Reece Music mailing list!</h1>'
        . '</div>'
        . '<p style="margin:18px 0 0;color:#1A237E;font-size:13px;line-height:1.5;text-align:center;">Reece Music · <a href="mailto:info@reecemusic.com" style="color:#1A237E;">info@reecemusic.com</a></p>'
        . '</div></body></html>';
    $welcomeSent = sendSmtpEmail($smtp, $email, $welcomeSubject, $welcomeText, $welcomeHtml);
    if (!$welcomeSent) {
        error_log('Mailing list welcome email could not be sent to ' . $email . '.');
        http_response_code(502);
        echo json_encode(['error' => 'Your email was added to the mailing list, but the confirmation email could not be delivered. Please contact info@reecemusic.com.']);
        exit;
    }

    echo json_encode(['success' => true]);
    exit;
}

if ($name === '' || $email === '' || $message === '' || !$human || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['error' => 'Please provide a valid name, email address, and message.']);
    exit;
}

$name = str_replace(["\r", "\n"], ' ', $name);
$subject = 'New website enquiry from ' . $name;
$body = "Name: {$name}\nEmail: {$email}\n\nMessage:\n{$message}\n";
if (!is_file(__DIR__ . '/config.php')) {
    http_response_code(500);
    echo json_encode(['error' => 'Email delivery is not configured yet.']);
    exit;
}

$config = require __DIR__ . '/config.php';
$smtp = $config['smtp'] ?? [];
$htmlBody = nl2br(htmlspecialchars($body, ENT_QUOTES, 'UTF-8'));

if (!sendSmtpEmail($smtp, 'info@reecemusic.com', $subject, $body, $htmlBody)) {
    http_response_code(500);
    echo json_encode(['error' => 'The message could not be sent.']);
    exit;
}

echo json_encode(['success' => true]);
