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

  // Recorded performances on the Sight & Sound page, shown in four galleries.
  // youtube: the 11-character video ID (the part after "youtu.be/" or "v=").
  // gallery: "piano", "ukulele", "electronica" or "original". title and note are optional.
  videos: [
    { gallery: "piano", youtube: "fPFPu1xN2Xg", title: "Movin' To The Sun - Hugel, Ultra Naté" },
    { gallery: "piano", youtube: "0FJ1TPl5kfU", title: "Take a Look Around - Limp Bizkit" },
    { gallery: "piano", youtube: "sePxQMQZF0E", title: "Black Friday - Tom Odell" },
    { gallery: "piano", youtube: "4P-d6qtDMNA", title: "Chezile - Beanie" },
    { gallery: "piano", youtube: "1aA725C_N4o", title: "BØRNS - Past Lives" },
    { gallery: "piano", youtube: "hx3DWZSira8", title: "Hold On To The Light - Jack Johnson + HG" },
    { gallery: "piano", youtube: "MoQPfHQbc1M", title: "To Build A Home" },
    { gallery: "piano", youtube: "_ixYRHcOlbk", title: "Cigarettes After Sex - K" },
    { gallery: "piano", youtube: "fFY1TMulYpw", title: "Purple Disco Machine - Substitution" },
    { gallery: "piano", youtube: "1SJ9VKaDRO4", title: "Purple Disco Machine - Hypnotized" },
    { gallery: "piano", youtube: "6Pft0Oawo0U", title: "Hand Covers Bruise" },
    { gallery: "piano", youtube: "VI47ZKYzL1c", title: "OPM - Heaven is a Halfpipe" },
    { gallery: "piano", youtube: "cSj4ARDTsD8", title: "Abide With Me" },
    { gallery: "piano", youtube: "vrkOTYjy8oI", title: "Hermanos Gutiérrez - Esperanza" },
    { gallery: "piano", youtube: "hidiKGnKpjs", title: "ROSÉ & Bruno Mars - APT." },
    { gallery: "piano", youtube: "c7WBjY002iY", title: "Jain - Makeba" },
    { gallery: "piano", youtube: "bRUzXkX8eEs", title: "Emile Mosseri - Jacob and the Stone" },
    { gallery: "piano", youtube: "q-NxJZJL9ME", title: "Shouse - Won't Forget You" },
    { gallery: "piano", youtube: "cFH72YkSxqc", title: "CYRIL - Stumblin' In" },
    { gallery: "piano", youtube: "fZPeIvF4-lE", title: "Adele - Skyfall" },
    { gallery: "piano", youtube: "GjM-ShpvXxE", title: "Vengaboys - Boom Boom" },
    { gallery: "piano", youtube: "QXZxWHGJWQo", title: "Oasis - Don't Look Back in Anger" },
    { gallery: "piano", youtube: "gdIFjkYNCHo", title: "World, Hold On - Bob Sinclar" },
    { gallery: "piano", youtube: "7nAmH0RgmhI", title: "The XX - I Dare You" },
    { gallery: "ukulele", youtube: "C1qdpjTe6JI", title: "Bahamas - Caught Me Thinkin'" },
    { gallery: "ukulele", youtube: "puTOcIrfm40", title: "Silver Dagger" },
    { gallery: "ukulele", youtube: "iYre0IP5xqs", title: "Fleet Foxes - Blue Ridge Mountains" },
    { gallery: "ukulele", youtube: "SQGY4T_UAr4", title: "Fleet Foxes - Montezuma" },
    { gallery: "ukulele", youtube: "SA3VTt9Pp6I", title: "Ukulele and Piano instrumental - C, F, G7" },
    { gallery: "ukulele", youtube: "HkZG-XqtOtg", title: "A Sunday in Frimley" },
    { gallery: "ukulele", youtube: "a6kgyYDvmzc", title: "Stranger Nights (Benny Benassi)" },
    { gallery: "ukulele", youtube: "m4eSgITYN4Q", title: "Bad Moon Rising" },
    { gallery: "ukulele", youtube: "GEbyk3Kghuo", title: "Silver Dagger, take two" },
    { gallery: "ukulele", youtube: "4UigMeLLW5I", title: "Drunken Sailor" },
    { gallery: "ukulele", youtube: "0p3udQs-Zy8", title: "El Paso" },
    { gallery: "ukulele", youtube: "4IZLnAEUp7g", title: "Fluorescent Adolescent" },
    { gallery: "electronica", youtube: "4SVvJ1Y5OWs", title: "Justin Bieber - Sorry" },
    { gallery: "electronica", youtube: "2Cpok1Ip7ww", title: "Justin Bieber - Let Me Love You" },
    { gallery: "electronica", youtube: "_nUPBHDqBh0", title: "Bahamas - Lost in the Light" },
    { gallery: "electronica", youtube: "CiOyj_zNivk", title: "Sivu - Better Man than He" },
    { gallery: "electronica", youtube: "sESWtbuIx7E", title: "Lockdown Blues" },
    { gallery: "electronica", youtube: "BytoLvB93iI", title: "Metronomy - The Bay" },
    { gallery: "electronica", youtube: "hNkWRMF2Oss", title: "Blues Run the Game - Jackson C. Frank" },
    { gallery: "electronica", youtube: "3v3Z2h6WbZU", title: "Folsom Prison Blues" },
    { gallery: "electronica", youtube: "Lf7mfdA2cq8", title: "Fleet Foxes - Montezuma, feat. The EarthTroll" },
    { gallery: "electronica", youtube: "M0DQ6-GT62M", title: "Shakira - She Wolf" },
    { gallery: "original", youtube: "IiJ1zjP5UAw", title: "Winter of Discontent" },
    { gallery: "original", youtube: "w8N_jbIoLfM", title: "Shift in the Paradigm" },
    { gallery: "original", youtube: "42gNJS6yjCA", title: "Greenwood" },
    { gallery: "original", youtube: "9JW64GlTcQ4", title: "Arabella Blues" },
    { gallery: "original", youtube: "zxy67QAVSzk", title: "Distorted Blues" },
    { gallery: "original", youtube: "dDXQ_UBIzpI", title: "Crazy Ukulele Blues!" },
    { gallery: "original", youtube: "59MZmvksXQQ", title: "Galactic Mystery" },
    { gallery: "original", youtube: "Szz8WDXxd7Q", title: "Abu Dhabi Sunset 1" }
  ]
};
