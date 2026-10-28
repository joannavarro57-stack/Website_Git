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
