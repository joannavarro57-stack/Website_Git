// POST /api/subscribe — saves a mailing-list signup in Supabase and sends a welcome email.
const { SITE_EMAIL, smtpConfigured, sendMail, json, readBody, field, EMAIL_RE, escapeHtml, emailShell } = require("./_lib/shared");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ntohdxudxfggsmhxhvho.supabase.co";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });

  const body = readBody(req);
  if (field(body, "website", 200)) return json(res, 200, { success: true });

  const email = field(body, "email", 254).toLowerCase();
  const source = field(body, "source", 40).replace(/[^a-zA-Z0-9_-]/g, "") || "website";
  if (!EMAIL_RE.test(email)) return json(res, 422, { error: "Please enter a valid email address." });

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return json(res, 503, { error: "Mailing list storage is not configured yet." });

  let isNew = true;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reece_subscribe`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_source: source })
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
    isNew = (await r.json()) === true;
  } catch (err) {
    console.error("Mailing list save failed:", err && err.message);
    return json(res, 502, { error: `We couldn't add you just now. Please try again, or email ${SITE_EMAIL}.` });
  }

  // Emails are best effort: the signup is already saved.
  if (smtpConfigured() && isNew) {
    try {
      await sendMail({
        to: SITE_EMAIL,
        subject: "New mailing list signup",
        text: `Email: ${email}\nSource: ${source}\n`,
        html: emailShell(`<p style="margin:0;">New mailing list signup: <strong>${escapeHtml(email)}</strong> (${escapeHtml(source)})</p>`)
      });
      await sendMail({
        to: email,
        subject: "You're on the Reece Music mailing list",
        text: "Thanks for joining the Reece Music mailing list.\n\nYou'll hear first about new gigs and recordings, and nothing else.\n\nReece\nhttps://reecemusic.com\n",
        html: emailShell(
          `<h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:28px;line-height:1.2;">Thanks for joining the list</h1>` +
          `<p style="margin:0 0 22px;color:#97A9C9;">You'll hear first about new gigs and recordings, and nothing else.</p>` +
          `<a href="https://reecemusic.com/gigs.html" style="display:inline-block;background:#C9A86A;color:#0B1630;text-decoration:none;padding:12px 24px;border-radius:999px;">See upcoming gigs</a>`
        )
      });
    } catch (err) {
      console.error("Mailing list emails failed:", err && err.message);
    }
  }

  return json(res, 200, { success: true });
};
