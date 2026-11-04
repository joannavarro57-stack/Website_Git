## Hosting on Tasjeel (cPanel)

The site is static HTML on Tasjeel cPanel (`/home/reecemus/public_html`). `index.html` (the home page) stays at the top;
every other page is in `pages/`, and the PHP scripts are in `php/`:

- `php/contact.php` emails contact-form enquiries to info@reecemusic.com and saves mailing-list signups in MySQL (then sends a welcome email).
- `php/midi.php` serves the free MIDI downloads (see below) and counts them.
- `php/track.php` records YouTube plays and clicks; `php/admin.php` is the password-protected stats page (with `php/songs.php` and `php/videos.php` for managing songs and gallery videos); `php/db.php` is their shared database connection.

Pushing to `main` deploys through `.github/workflows/deploy.yml` (SSH upload). It needs these repository secrets:
`CPANEL_HOST`, `CPANEL_PORT`, `CPANEL_USER`, `CPANEL_SSH_KEY`, `CPANEL_KNOWN_HOSTS`.
`.cpanel.yml` does the same copy if you deploy from cPanel → Git Version Control instead.

The hero playlist is set in `js/config.js`. The Sight & Sound gallery videos are managed on the admin's YouTube page
(`php/videos.php`); they live in the `gallery_videos` table, which `data/gallery-videos.json` seeds the first time.

## Mailing list database

1. In cPanel, create a MySQL database and user, and give the user all privileges on the database.
2. In phpMyAdmin, run `database/schema.sql` in the new database.
3. Copy `config.example.php` to `config.php`, fill in the database name, user and password, and the SMTP password of the
   info@reecemusic.com mailbox (defaults: `mail.reecemusic.com`, port `465`, `ssl`).
4. Upload `config.php` into `public_html` (the top level, next to `index.html`, not into `php/`). It is private and excluded by `.gitignore`.
   Add `'admin' => ['password' => '…']` to switch on `php/admin.php`.

Until `config.php` is in place, the forms open a pre-filled email to info@reecemusic.com instead, so nothing is lost.
`tools/` holds local email-preview and SMTP diagnostic helpers; they are not deployed.

## Free MIDI and sheet music ("Play it yourself")

Pages: `pages/learn.html` (all songs) and `pages/song.html?id=…` (one song: MIDI, PDF and MusicXML downloads, YouTube tutorial, PayPal donate).

**Manage songs on the admin's Songs page** (`php/songs.php`, signed in): add, edit, reorder and delete songs, and upload or
replace each song's MIDI (`.mid`), PDF (`.pdf`) and MusicXML (`.musicxml`, `.xml` or compressed `.mxl`) files, up to 25 MB each
(or the server's PHP upload limit if lower). Visitors only see a download once its file is uploaded.

Songs are stored in the `songs` database table, so deploys never overwrite them. `data/midi-songs.json` only fills that
table the very first time; editing it afterwards changes nothing.

Uploaded files are saved as `<song id>.<extension>` in the private folder set as `midi.files_dir` in `config.php`
(default `/home/reecemus/midi-files`), outside `public_html`. They must never be in this public repo or in `public_html`;
`php/midi.php` serves and counts every download.

Donate buttons use the PayPal link in `js/config.js` (`paypal`). While it is empty, every Donate button stays hidden.
