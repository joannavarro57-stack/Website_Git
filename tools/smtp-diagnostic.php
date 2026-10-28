<?php
$config = require __DIR__ . '/../config.php';
$smtp = $config['smtp'] ?? [];

$host = (string) ($smtp['host'] ?? '');
$port = (int) ($smtp['port'] ?? 465);
$encryption = (string) ($smtp['encryption'] ?? 'ssl');
$username = (string) ($smtp['username'] ?? '');
$password = (string) ($smtp['password'] ?? '');
$from = (string) ($smtp['from'] ?? $username);

if ($host === '' || $username === '' || $password === '') {
    echo "Missing SMTP config\n";
    exit(1);
}

$transport = $encryption === 'ssl' ? 'ssl://' : 'tcp://';
$socket = @stream_socket_client($transport . $host . ':' . $port, $errno, $errstr, 20);
if (!$socket) {
    echo "Connection failed: {$errstr} ({$errno})\n";
    exit(1);
}

stream_set_timeout($socket, 20);

function readResponse($socket) {
    $response = '';
    while (($line = fgets($socket, 512)) !== false) {
        $response .= $line;
        if (isset($line[3]) && $line[3] === ' ') {
            break;
        }
    }
    return $response;
}

function expect($socket, $expectedCodes, $label) {
    $response = readResponse($socket);
    echo $label . ": " . trim($response) . "\n";
    $code = (int) substr($response, 0, 3);
    return in_array($code, $expectedCodes, true);
}

$ok = expect($socket, [220], '220 banner');
if (!$ok) { fclose($socket); exit(1); }

fwrite($socket, "EHLO reecemusic.com\r\n");
$ok = expect($socket, [250], 'EHLO');
if (!$ok) { fclose($socket); exit(1); }

fwrite($socket, "AUTH LOGIN\r\n");
$ok = expect($socket, [334], 'AUTH LOGIN');
if (!$ok) { fclose($socket); exit(1); }

fwrite($socket, base64_encode($username) . "\r\n");
$ok = expect($socket, [334], 'USERNAME RESPONSE');
if (!$ok) { fclose($socket); exit(1); }

fwrite($socket, base64_encode($password) . "\r\n");
$ok = expect($socket, [235], 'PASSWORD RESPONSE');
if (!$ok) { fclose($socket); exit(1); }

echo "SMTP authentication succeeded.\n";

echo "Using sender: {$from}\n";

fwrite($socket, "MAIL FROM:<{$from}>\r\n");
$ok = expect($socket, [250], 'MAIL FROM');
if (!$ok) { fclose($socket); exit(1); }

fwrite($socket, "RCPT TO:<info@reecemusic.com>\r\n");
$ok = expect($socket, [250, 251], 'RCPT TO');
if (!$ok) { fclose($socket); exit(1); }

fwrite($socket, "QUIT\r\n");
readResponse($socket);
fclose($socket);

echo "SMTP envelope test passed.\n";
