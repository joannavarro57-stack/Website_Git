## Hosting on Tasjeel (cPanel)

The site is static HTML on Tasjeel cPanel (`/home/reecemus/public_html`). `index.html` (the home page) stays at the top;
every other page is in `pages/`, and the PHP scripts are in `php/`:

- `php/contact.php` emails contact-form enquiries to info@reecemusic.com and saves mailing-list signups in MySQL (then sends a welcome email).
- `php/midi.php` serves the free MIDI downloads (see below) and counts them.
- `php/track.php` records YouTube plays and clicks; `php/admin.php` is the password-protected stats page; `php/db.php` is their shared database connection.

Pushing to `main` deploys through `.github/workflows/deploy.yml` (SSH upload). It needs these repository secrets:
`CPANEL_HOST`, `CPANEL_PORT`, `CPANEL_USER`, `CPANEL_SSH_KEY`, `CPANEL_KNOWN_HOSTS`.
`.cpanel.yml` does the same copy if you deploy from cPanel → Git Version Control instead.

Hero playlist and recorded performances are set in `js/config.js`.

## Mailing list database

1. In cPanel, create a MySQL database and user, and give the user all privileges on the database.
2. In phpMyAdmin, run `database/schema.sql` in the new database.
3. Copy `config.example.php` to `config.php`, fill in the database name, user and password, and the SMTP password of the
   info@reecemusic.com mailbox (defaults: `mail.reecemusic.com`, port `465`, `ssl`).
4. Upload `config.php` into `public_html` (the top level, next to `index.html`, not into `php/`). It is private and excluded by `.gitignore`.
   Add `'admin' => ['password' => '…']` to switch on `php/admin.php`.

Until `config.php` is in place, the forms open a pre-filled email to info@reecemusic.com instead, so nothing is lost.
`tools/` holds local email-preview and SMTP diagnostic helpers; they are not deployed.

## Free MIDI ("Play it yourself")

Pages: `pages/learn.html` (all songs) and `pages/song.html?id=…` (one song: MIDI download, YouTube tutorial, PayPal donate).
Songs: `data/midi-songs.json` (the `data/` folder is blocked from the web by its `.htaccess`).
Each song has an `id`, `title`, `artist`, `description`, `youtubeId` (the 11-character video ID) and `file`.

MIDI files must never be in this public repo or in `public_html`. Upload them to the private folder set as
`midi.files_dir` in `config.php` (default `/home/reecemus/midi-files`), named exactly as `file` in `midi-songs.json`.

Donate buttons use the PayPal link in `js/config.js` (`paypal`). While it is empty, every Donate button stays hidden.

To add a song: add an entry to `data/midi-songs.json` and upload its MIDI file to the private folder.
