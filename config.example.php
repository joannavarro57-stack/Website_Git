<?php

return [
    'database' => [
        'host' => 'localhost',
        'name' => 'reecemus_subscriber_list',
        'user' => 'reecemus_admin',
        'password' => 'replace-with-cpanel-password',
        'charset' => 'utf8mb4'
    ],
    'smtp' => [
        'host' => 'mail.reecemusic.com',
        'port' => 465,
        'encryption' => 'ssl',
        'username' => '_mainaccount@reecemusic.com',
        'password' => 'replace-with-cpanel-password',
        'from' => 'info@reecemusic.com'
    ],
    // Free MIDI downloads (midi.php)
    'midi' => [
        'files_dir' => '/home/reecemus/midi-files'               // private folder outside public_html
    ]
];
