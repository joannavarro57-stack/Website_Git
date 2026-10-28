// GET /api/midi/songs        → all songs
// GET /api/midi/songs?id=X   → one song
const { CATALOG, findSong, publicSong, sendJson } = require("../_lib/midi");

module.exports = function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
  const id = req.query && req.query.id;
  if (id) {
    const song = findSong(id);
    if (!song) return sendJson(res, 404, { error: "Song not found." });
    return sendJson(res, 200, publicSong(song), "public, s-maxage=300, stale-while-revalidate=86400");
  }
  return sendJson(res, 200, { songs: CATALOG.map(publicSong) }, "public, s-maxage=300, stale-while-revalidate=86400");
};
