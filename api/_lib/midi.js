// Shared logic for the MIDI store on reecemusic.com.
// Catalog: api/_data/midi-songs.json. Files: private Supabase bucket "reece-midi".
const crypto = require("crypto");
const CATALOG = require("../_data/midi-songs.json");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ntohdxudxfggsmhxhvho.supabase.co";
const BUCKET = process.env.MIDI_BUCKET || "reece-midi";
const PAID_TIERS = ["chorus", "full"];
const LINK_HOURS = 24;

function findSong(id) {
  return CATALOG.find((s) => s.id === String(id || ""));
}

// What the browser may see: never the stored file names.
function publicSong(s) {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    description: s.description,
    youtubeId: s.youtubeId || "",
    tiers: {
      free: { label: s.tiers.free.label, price: 0 },
      chorus: { label: s.tiers.chorus.label, price: s.tiers.chorus.price },
      full: { label: s.tiers.full.label, price: s.tiers.full.price }
    }
  };
}

// Absolute site URL for Stripe redirects; only trusted hosts, else reecemusic.com.
function siteUrl(req) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
  const trusted = /^(www\.)?reecemusic\.com$/.test(host) || /\.vercel\.app$/.test(host) || /^localhost(:\d+)?$/.test(host);
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  if (!trusted) return "https://reecemusic.com";
  return (host.startsWith("localhost") ? "http://" : "https://") + host;
}

// ---- download tokens (HMAC-signed, expire after LINK_HOURS) ----
function b64url(buf) { return Buffer.from(buf).toString("base64url"); }

function tokenSecret() {
  const s = process.env.DOWNLOAD_TOKEN_SECRET;
  if (!s || s.length < 16) throw Object.assign(new Error("DOWNLOAD_TOKEN_SECRET is not set"), { notConfigured: true });
  return s;
}

function signToken(payload) {
  const body = b64url(JSON.stringify({ ...payload, exp: Date.now() + LINK_HOURS * 3600 * 1000 }));
  const sig = b64url(crypto.createHmac("sha256", tokenSecret()).update(body).digest());
  return `${body}.${sig}`;
}

function verifyToken(token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = b64url(crypto.createHmac("sha256", tokenSecret()).update(body).digest());
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try { data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch (_) { return null; }
  if (!data.exp || Date.now() > data.exp) return null;
  return data;
}

// ---- Stripe (REST API, no SDK needed) ----
async function stripe(method, path, form) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw Object.assign(new Error("STRIPE_SECRET_KEY is not set"), { notConfigured: true });
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form ? new URLSearchParams(form).toString() : undefined
  });
  const data = await r.json();
  if (!r.ok) throw new Error((data && data.error && data.error.message) || `Stripe ${r.status}`);
  return data;
}

// ---- private file links (Supabase Storage signed URLs) ----
async function signedFileUrl(file, downloadName) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw Object.assign(new Error("SUPABASE_SERVICE_ROLE_KEY is not set"), { notConfigured: true });
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${encodeURIComponent(file)}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 120 })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.signedURL) throw Object.assign(new Error(`File not available: ${file}`), { missing: r.status === 400 || r.status === 404 });
  const url = `${SUPABASE_URL}/storage/v1${data.signedURL}`;
  return url + (url.includes("?") ? "&" : "?") + "download=" + encodeURIComponent(downloadName || file);
}

function sendJson(res, status, body, cache) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache || "no-store");
  res.status(status).send(JSON.stringify(body));
}

module.exports = { CATALOG, PAID_TIERS, findSong, publicSong, siteUrl, signToken, verifyToken, stripe, signedFileUrl, sendJson };
