## Hosting on Vercel (current)

The site is static HTML served by Vercel. The contact form and mailing list run as Vercel functions in `api/`:

- `api/contact.js` emails enquiries to info@reecemusic.com through the info@ mailbox.
- `api/subscribe.js` saves signups to Supabase (`reece_subscribers`, see `database/supabase-reece.sql`) and sends a welcome email.

Set these in Vercel → Project → Settings → Environment Variables, then redeploy:

| Name | Value |
| --- | --- |
| `SMTP_PASS` | Password of the info@reecemusic.com mailbox |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → service_role / secret key |
| `SMTP_HOST` | Optional, default `mail.reecemusic.com` |
| `SMTP_PORT` | Optional, default `465` |
| `SMTP_USER` | Optional, default `info@reecemusic.com` |

Until those are set, the forms open a pre-filled email to info@reecemusic.com instead, so nothing is lost.

Hero playlist and performance films are set in `js/config.js`.

## MIDI store ("Play it yourself")

Pages: `learn.html` (all songs), `song.html?id=…` (one song), `purchase-complete.html` (after Stripe).
Functions: `api/midi/songs.js`, `checkout.js`, `verify.js`, `download.js`. Songs and prices: `api/_data/midi-songs.json`.

MIDI files live in the **private** Supabase bucket `reece-midi` (never in this public repo). Upload them in
Supabase → Storage → reece-midi, named exactly as in `midi-songs.json` (e.g. `clocks-free.mid`, `clocks-chorus.mid`, `clocks-full.mid`).
Buyers get a 2-minute signed link after a free click or a verified payment.

Extra Vercel environment variables for the store:

| Name | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_…` for testing, `sk_live_…` to take real payments) |
| `DOWNLOAD_TOKEN_SECRET` | Any long random string (32+ characters) |
| `SUPABASE_SERVICE_ROLE_KEY` | Same key the mailing list uses |

To add a song: add an entry to `api/_data/midi-songs.json` (prices in cents) and upload its three files to the bucket.


# Website starter

Simple static site for editing in VS Code and uploading to cPanel (`public_html`).

## Files

- Keep the public HTML pages, `contact.php`, `robots.txt`, and `sitemap.xml` in the repository root. The cPanel deployment expects these paths.
- `css/` — stylesheets
- `js/` — site scripts
- `images/` — site imagery and video, grouped into subfolders by content
- `database/` — database schema
- `tools/` — local email preview and SMTP diagnostic helpers; these are not deployed
- `.github/` — GitHub Actions deployment workflow
- `.vscode/` — workspace editor settings

Put images in an `images` folder and link them like:

```html
<img src="images/photo.jpg" alt="Description of the photo">
```

## Local preview

In VS Code, install the Live Server extension, then right-click `index.html` → Open with Live Server.

## Upload to Tasjeel

Upload the public-site files (`index.html`, the other public HTML/PHP pages, `css/`, `js/`, `images/`, `favicon.png`, `robots.txt`, and `sitemap.xml`) into `public_html`. Keep `index.html` directly in `public_html`, not inside another folder. Do not upload `tools/` or `database/`; those are for local development and setup.

## Mailing list database

The homepage signup stores subscribers in MySQL through `contact.php`.

1. In Tasjeel cPanel, create a MySQL database and database user, then grant the user all privileges on the database.
2. Open phpMyAdmin and run `database/schema.sql` in the new database.
3. Copy `config.example.php` to `config.php` and enter the cPanel database name, user, and password. Keep `config.php` private; it is excluded by `.gitignore`.
4. Upload `config.php` to the same directory as `contact.php` on Tasjeel.

The subscriber table stores the email address, signup source, and signup timestamp. Duplicate email addresses are handled safely. Successful signups also receive an automated thank-you email from `info@reecemusic.com`.

SMTP delivery uses the `info@reecemusic.com` mailbox. In `config.php`, set the SMTP password to the mailbox password, not the MySQL password. The default Tasjeel settings are `mail.reecemusic.com`, port `465`, and `ssl`; confirm these values with Tasjeel if delivery fails.
