// POST /api/contact — emails a website enquiry to Reece.
const { SITE_EMAIL, smtpConfigured, sendMail, json, readBody, field, EMAIL_RE, escapeHtml, emailShell } = require("./_lib/shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });

  const body = readBody(req);
  // Honeypot: real visitors never fill the hidden "website" field.
  if (field(body, "website", 200)) return json(res, 200, { success: true });

  const name = field(body, "name", 120).replace(/[\r\n]+/g, " ");
  const email = field(body, "email", 254);
  const message = field(body, "message", 5000);

  if (!name || !message || !EMAIL_RE.test(email)) {
    return json(res, 422, { error: "Please add your name, a valid email address and a message." });
  }
  if (!smtpConfigured()) return json(res, 503, { error: "Email delivery is not configured yet." });

  const text = `Name: ${name}\nEmail: ${email}\n\n${message}\n`;
  const html = emailShell(
    `<p style="margin:0 0 6px;color:#97A9C9;">New enquiry from reecemusic.com</p>` +
    `<p style="margin:0 0 4px;"><strong>${escapeHtml(name)}</strong> · <a href="mailto:${escapeHtml(email)}" style="color:#C9A86A;">${escapeHtml(email)}</a></p>` +
    `<p style="margin:18px 0 0;white-space:pre-wrap;">${escapeHtml(message)}</p>`
  );

  try {
    await sendMail({ to: SITE_EMAIL, subject: `New website enquiry from ${name}`, text, html, replyTo: `${name} <${email}>` });
  } catch (err) {
    console.error("Contact email failed:", err && err.message);
    return json(res, 502, { error: `The message couldn't be sent. Please email ${SITE_EMAIL} directly.` });
  }
  return json(res, 200, { success: true });
};
