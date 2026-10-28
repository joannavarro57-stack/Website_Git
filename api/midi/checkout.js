// POST /api/midi/checkout  { id, tier }  → { url } of a Stripe Checkout page
const { PAID_TIERS, findSong, siteUrl, stripe, sendJson } = require("../_lib/midi");

function readBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "string") { try { return JSON.parse(b); } catch (_) { return Object.fromEntries(new URLSearchParams(b)); } }
  return b;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  const { id, tier } = readBody(req);
  const song = findSong(id);
  if (!song) return sendJson(res, 404, { error: "Song not found." });
  if (!PAID_TIERS.includes(tier)) return sendJson(res, 400, { error: "Choose the chorus or the full song." });

  const t = song.tiers[tier];
  const base = siteUrl(req);
  try {
    const session = await stripe("POST", "/checkout/sessions", {
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(t.price),
      "line_items[0][price_data][product_data][name]": `${song.title} (${t.label})`,
      "line_items[0][price_data][product_data][description]": `By ${song.artist}. Includes the video tutorial.`,
      "metadata[songId]": song.id,
      "metadata[tier]": tier,
      success_url: `${base}/purchase-complete.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/song.html?id=${encodeURIComponent(song.id)}`
    });
    return sendJson(res, 200, { url: session.url });
  } catch (err) {
    console.error("Checkout failed:", err.message);
    if (err.notConfigured) return sendJson(res, 503, { error: "Payments aren't switched on yet. Please try again later." });
    return sendJson(res, 502, { error: "Checkout couldn't start. Please try again." });
  }
};
