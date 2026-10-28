// GET /api/midi-songs — the song list from Reece's MIDI store, for the Gigs page.
// Read on the server so the store doesn't need to allow cross-site requests.
const STORE = (process.env.MIDI_STORE_URL || "https://midi-reece.vercel.app").replace(/\/+$/, "");

function cents(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") {
    res.status(405).send(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const r = await fetch(`${STORE}/api/products`, { signal: controller.signal, headers: { Accept: "application/json" } });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`Store answered ${r.status}`);
    const list = await r.json();
    if (!Array.isArray(list)) throw new Error("Unexpected store response");

    const songs = list.slice(0, 24).map((p) => ({
      id: String(p.id || ""),
      title: String(p.title || "").slice(0, 120),
      artist: String(p.artist || "").slice(0, 120),
      description: String(p.description || "").slice(0, 300),
      chorus: cents(p.tiers && p.tiers.chorus && p.tiers.chorus.price),
      full: cents(p.tiers && p.tiers.full && p.tiers.full.price),
      url: `${STORE}/song.html?id=${encodeURIComponent(String(p.id || ""))}`
    })).filter((s) => s.id && s.title);

    // Cache at Vercel's edge for 10 minutes; serve a stale copy while refreshing.
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
    res.status(200).send(JSON.stringify({ store: STORE, songs }));
  } catch (err) {
    console.error("MIDI store unavailable:", err && err.message);
    res.setHeader("Cache-Control", "no-store");
    res.status(502).send(JSON.stringify({ store: STORE, songs: [], error: "MIDI store unavailable" }));
  }
};
