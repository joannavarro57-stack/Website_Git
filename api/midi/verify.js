// GET /api/midi/verify?session_id=cs_...  → purchase details and a 24-hour download link
const { PAID_TIERS, findSong, signToken, stripe, sendJson } = require("../_lib/midi");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
  const sessionId = String((req.query && req.query.session_id) || "");
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return sendJson(res, 400, { error: "Missing payment reference." });

  try {
    const session = await stripe("GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (session.payment_status !== "paid") return sendJson(res, 402, { error: "This payment hasn't completed." });
    const { songId, productId, tier } = session.metadata || {};
    const song = findSong(songId || productId);
    if (!song || !PAID_TIERS.includes(tier)) return sendJson(res, 404, { error: "We couldn't match this payment to a song." });

    const token = signToken({ songId: song.id, tier, sessionId });
    return sendJson(res, 200, {
      title: song.title,
      artist: song.artist,
      tier: song.tiers[tier].label,
      youtubeId: song.youtubeId || "",
      songUrl: `/song.html?id=${encodeURIComponent(song.id)}`,
      downloadUrl: `/api/midi/download?token=${encodeURIComponent(token)}`
    });
  } catch (err) {
    console.error("Verify failed:", err.message);
    if (err.notConfigured) return sendJson(res, 503, { error: "We couldn't prepare your download just now. Email info@reecemusic.com with your receipt and Reece will send your file." });
    return sendJson(res, 502, { error: "We couldn't confirm the payment just now. Refresh to try again." });
  }
};
