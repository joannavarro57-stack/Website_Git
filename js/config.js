/*
 * Reece Music — site settings.
 * Change the hero playlist or the recorded performances here; every page reads this file.
 */
window.REECE = {
  // Hero "On rotation" player. Paste any Spotify link: playlist, album, artist or track.
  // Currently Reece's artist profile — swap in his playlist link when ready.
  spotify: "https://open.spotify.com/artist/3hjMpg8KlYuYGQAbB1alcu",

  email: "info@reecemusic.com",

  // Donate buttons on the MIDI pages. Paste Reece's PayPal link, e.g. "https://www.paypal.com/donate/?hosted_button_id=…"
  // or "https://paypal.me/…". Leave empty to hide every Donate button.
  paypal: "",

  // Recorded performances on the Sight & Sound page, shown in three galleries.
  // youtube: the 11-character video ID (the part after "youtu.be/" or "v=").
  // gallery: "piano", "ukulele", "electronica" or "original" (Original Music). title and note are optional.
  videos: [
    { gallery: "piano", youtube: "bRUzXkX8eEs", title: "Ambient piano", note: "Expressive, intimate arrangements." },
    { gallery: "piano", youtube: "vrkOTYjy8oI", title: "Played by ear" },
    { gallery: "ukulele", youtube: "dDXQ_UBIzpI", title: "Open-air ukulele", note: "Warm, rhythmic and spacious." },
    { gallery: "electronica", youtube: "PUKPWZ648mM", title: "Pulse and texture", note: "Electronic soundscapes." },
    { gallery: "electronica", youtube: "zxy67QAVSzk", title: "Layered light" }
  ]
};
