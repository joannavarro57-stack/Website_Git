// GET /api/midi/download?free=<songId>   → free preview
// GET /api/midi/download?token=<token>   → paid file (token from /api/midi/verify, valid 24 h)
// Redirects to a 2-minute signed link for the file in the private Supabase bucket.
const { PAID_TIERS, findSong, verifyToken, signedFileUrl } = require("../_lib/midi");

function page(res, status, message) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Download | Reece Music</title><link rel="stylesheet" href="/css/reece.css">
<main class="section"><div class="wrap"><h1 style="font-size:2.4rem;margin-bottom:16px">Download unavailable</h1>
<p class="lede">${message}</p><p><a class="btn btn-brass" href="/learn.html">Back to the songs</a></p></div></main>`);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return page(res, 405, "Method not allowed.");
  const q = req.query || {};
  let song, tier;

  try {
    if (q.free) {
      song = findSong(q.free);
      tier = "free";
      if (!song) return page(res, 404, "That song isn't in the store.");
    } else {
      let data = null;
      try { data = verifyToken(q.token); } catch (e) { if (!e.notConfigured) throw e; }
      if (!data) return page(res, 401, "This download link has expired or isn't valid. Links last 24 hours after purchase. Email info@reecemusic.com with your receipt and Reece will send a new one.");
      song = findSong(data.songId);
      tier = data.tier;
      if (!song || !PAID_TIERS.includes(tier)) return page(res, 404, "That song isn't in the store anymore. Email info@reecemusic.com with your receipt.");
    }

    const file = song.tiers[tier].file;
    const url = await signedFileUrl(file, file);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Location", url);
    return res.status(302).send("");
  } catch (err) {
    console.error("Download failed:", err.message);
    if (err.missing) return page(res, 404, "This MIDI file is being prepared and isn't uploaded yet. Please check back soon, or email info@reecemusic.com.");
    return page(res, 503, "Downloads aren't available right now. Please try again in a few minutes.");
  }
};
