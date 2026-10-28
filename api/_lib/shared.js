// Shared helpers for the Reece Music Vercel functions.
// Files in folders starting with "_" are not exposed as routes by Vercel.
const nodemailer = require("nodemailer");

const SITE_EMAIL = process.env.CONTACT_TO || "info@reecemusic.com";

function smtpConfigured() {
  return Boolean(process.env.SMTP_PASS);
}

function transport() {
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "mail.reecemusic.com",
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER || SITE_EMAIL,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendMail({ to, subject, text, html, replyTo }) {
  const from = process.env.SMTP_USER || SITE_EMAIL;
  await transport().sendMail({ from: `Reece Music <${from}>`, to, subject, text, html, replyTo });
}

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(JSON.stringify(body));
}

// Accepts urlencoded, JSON or an already-parsed object.
function readBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "string") {
    try { return JSON.parse(b); } catch (_) { return Object.fromEntries(new URLSearchParams(b)); }
  }
  return b;
}

function field(body, name, max) {
  return String(body[name] == null ? "" : body[name]).trim().slice(0, max);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Branded email shell: midnight blue and brass, matching the site.
function emailShell(innerHtml) {
  return `<!doctype html><html><body style="margin:0;background:#0B1630;font-family:Arial,Helvetica,sans-serif;color:#ECE8DF;">
<div style="max-width:560px;margin:0 auto;padding:36px 20px;">
  <div style="padding:0 0 18px;border-bottom:1px solid #C9A86A;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#ECE8DF;">Reece <em style="color:#C9A86A;">Williams</em></div>
  <div style="padding:28px 0;font-size:16px;line-height:1.6;color:#ECE8DF;">${innerHtml}</div>
  <p style="margin:0;padding-top:18px;border-top:1px solid #1D3A6B;font-size:13px;color:#97A9C9;">Reece Music · Abu Dhabi · <a href="https://reecemusic.com" style="color:#C9A86A;">reecemusic.com</a></p>
</div></body></html>`;
}

module.exports = { SITE_EMAIL, smtpConfigured, sendMail, json, readBody, field, EMAIL_RE, escapeHtml, emailShell };
