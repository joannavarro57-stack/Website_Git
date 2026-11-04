(function () {
  "use strict";
  var cfg = window.REECE || {};
  var email = cfg.email || "info@reecemusic.com";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- sections sweep in each time they're loaded or scrolled into view ---------- */
  // A section plays its entrance once it's a little way up the screen, and resets only after it has left the
  // screen completely, so a section at the edge never flickers between the two.
  if (!reduceMotion && "IntersectionObserver" in window) {
    var revealIn = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) e.target.classList.add("is-in"); });
    }, { rootMargin: "0px 0px -15% 0px" });
    var revealOut = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (!e.isIntersecting) e.target.classList.remove("is-in"); });
    });
    document.querySelectorAll("main > section:not(.hero)").forEach(function (s) {
      s.classList.add("reveal");
      revealIn.observe(s);
      revealOut.observe(s);
    });
  }

  /* ---------- mobile menu ---------- */
  var menuBtn = document.querySelector(".menu-btn");
  var nav = document.getElementById("site-nav");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.textContent = open ? "Close" : "Menu";
    });
  }

  /* ---------- hero piano loop: plays forward, then in reverse ---------- */
  document.querySelectorAll("[data-pingpong]").forEach(function (box) {
    var fwd = box.querySelector("video[data-forward]");
    var rev = box.querySelector("video[data-reverse]");
    if (!fwd || !rev) return;
    if (reduceMotion) { fwd.removeAttribute("autoplay"); fwd.pause(); return; }
    fwd.addEventListener("ended", function () {
      rev.currentTime = 0; rev.classList.add("is-active");
      rev.play().catch(function () {});
    });
    rev.addEventListener("ended", function () {
      rev.classList.remove("is-active");
      fwd.currentTime = 0; fwd.play().catch(function () {});
    });
  });

  /* ---------- Spotify: record spins while music plays ---------- */
  var sleeve = document.querySelector(".sleeve");
  var host = document.getElementById("spotify-embed");
  if (sleeve && host && cfg.spotify) {
    var m = cfg.spotify.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|artist|track|show|episode)\/([A-Za-z0-9]+)/);
    var vinyl = document.querySelector(".vinyl");
    var status = sleeve.querySelector(".sleeve-status");
    var openLink = sleeve.querySelector("[data-spotify-open]");
    if (openLink) openLink.href = cfg.spotify;
    var say = function (t) { if (status) status.textContent = t; };

    var setPlaying = function (playing) {
      sleeve.classList.toggle("is-playing", playing);
      if (vinyl) vinyl.classList.toggle("is-spinning", playing);
      say(playing ? "Now playing" : "Press play");
    };

    var done = false;            // a player is on screen
    var timers = [];
    var finish = function () { done = true; host.classList.remove("is-loading"); timers.forEach(clearTimeout); };

    // Plain Spotify embed: no play/pause events, but works whenever the player API is slow or blocked.
    var plainEmbed = function () {
      if (!m || (done && host.querySelector("iframe"))) return;
      var f = document.createElement("iframe");
      f.src = "https://open.spotify.com/embed/" + m[1] + "/" + m[2] + "?utm_source=generator&theme=0";
      f.height = "152"; f.title = "Reece Music on Spotify";
      f.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
      f.addEventListener("load", function () { say("Press play"); });
      host.innerHTML = ""; host.appendChild(f);
      finish();
    };

    var withApi = function () {
      if (done) return;
      var api = window.__spotify && window.__spotify.api;
      if (!api) return plainEmbed();
      var mount = document.createElement("div");
      host.innerHTML = ""; host.appendChild(mount);
      api.createController(mount, { uri: "spotify:" + m[1] + ":" + m[2], width: "100%", height: 152 }, function (ctrl) {
        ctrl.addListener("ready", function () { finish(); say("Press play"); });
        ctrl.addListener("playback_update", function (e) {
          setPlaying(!!(e && e.data && !e.data.isPaused && !e.data.isBuffering));
        });
      });
      timers.push(setTimeout(function () { if (!done) plainEmbed(); }, 8000));   // player never got ready
    };

    if (m) {
      host.classList.add("is-loading");
      host.innerHTML = '<div class="player-loading"><span class="player-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Loading Spotify…</div>';
      say("Loading…");
      timers.push(setTimeout(function () { if (!done) plainEmbed(); }, 7000));    // player script never arrived
      var sp = window.__spotify;
      if (sp && (sp.api || sp.failed)) withApi();
      else if (sp) sp.waiters.push(withApi);
      else {                                                                     // page without the early loader
        window.__spotify = { api: null, failed: false, waiters: [withApi] };
        window.onSpotifyIframeApiReady = function (api) { window.__spotify.api = api; withApi(); };
        var s = document.createElement("script");
        s.src = "https://open.spotify.com/embed/iframe-api/v1"; s.async = true; s.onerror = plainEmbed;
        document.body.appendChild(s);
      }
    }
  }

  document.querySelectorAll("[data-spotify-link]").forEach(function (a) { if (cfg.spotify) a.href = cfg.spotify; });

  /* ---------- recorded performances: one 3D carousel per gallery ---------- */
  // The videos are managed on the admin's YouTube page and come from the database.
  var galleries = document.querySelectorAll("[data-video-gallery]"), galleryVideos = [];
  if (galleries.length) {
    fetch("/php/gallery.php", { headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (data) { showGalleries((data && data.videos) || []); })
      .catch(function () { showGalleries([]); });
  }

  function showGalleries(list) {
    var vids = galleryVideos = list.filter(function (v) { return v && /^[A-Za-z0-9_-]{11}$/.test(v.youtube || ""); });
    if (!vids.length) document.getElementById("video-empty").hidden = false;
    galleries.forEach(function (host) {
      var name = host.getAttribute("data-video-gallery");
      var set = vids.filter(function (v) { return v.gallery === name; });
      var note = host.getAttribute("data-empty-note");
      host.closest(".video-set").hidden = !set.length && !note;
      if (set.length) buildCarousel(host, set);
      else if (note) { host.className = "video-soon"; host.innerHTML = '<div class="vinyl-mini" aria-hidden="true"></div><p>' + escapeHtml(note) + "</p>"; }
    });
  }

  function buildCarousel(host, set) {
    var titleEl = host.closest(".video-set").querySelector(".video-set-title");
    var label = (titleEl ? titleEl.textContent.trim() : "Reece Music") + " performances";
    host.className = "carousel" + (set.length === 1 ? " is-single" : "");
    host.setAttribute("role", "region");
    host.setAttribute("aria-roledescription", "carousel");
    host.setAttribute("aria-label", label);
    host.innerHTML = '<div class="carousel-stage"></div>';
    var stage = host.firstChild, active = 0;

    var thumb = function (v) {
      return '<img src="https://i.ytimg.com/vi/' + v.youtube + '/hqdefault.jpg" alt="" loading="lazy">' +
        '<button class="video-play" type="button" aria-label="Play ' + escapeHtml(v.title || "performance") + '"><span></span></button>';
    };
    var cards = set.map(function (v, i) {
      var fig = document.createElement("figure");
      fig.className = "video carousel-card";
      fig.setAttribute("role", "group");
      fig.setAttribute("aria-roledescription", "slide");
      fig.setAttribute("aria-label", (i + 1) + " of " + set.length + (v.title ? ": " + v.title : ""));
      fig.innerHTML = '<div class="video-frame">' + thumb(v) + "</div>" +
        (v.title || v.note ? "<figcaption>" + (v.title ? "<strong>" + escapeHtml(v.title) + "</strong>" : "") +
          (v.note ? '<span class="muted">' + escapeHtml(v.note) + "</span>" : "") + "</figcaption>" : "");
      fig.addEventListener("click", function (e) {
        if (i !== active) { e.preventDefault(); go(i); return; }
        if (e.target.closest(".video-play")) {
          fig.querySelector(".video-frame").innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + v.youtube +
            '?autoplay=1&rel=0" title="' + escapeHtml(v.title || "Reece Music performance") +
            '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
          fig.classList.add("is-playing");
          trackVideo(v.youtube, "play");
        }
      });
      stage.appendChild(fig);
      return fig;
    });

    if (set.length > 1) {
      var nav = document.createElement("div");
      nav.className = "carousel-nav";
      nav.innerHTML = '<button class="carousel-arrow" type="button" data-step="-1" aria-label="Previous video"><span aria-hidden="true">&#8249;</span></button>' +
        '<span class="carousel-count" aria-live="polite"></span>' +
        '<button class="carousel-arrow" type="button" data-step="1" aria-label="Next video"><span aria-hidden="true">&#8250;</span></button>';
      host.appendChild(nav);
      nav.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        if (b.hasAttribute("data-step")) go(active + Number(b.getAttribute("data-step")));
      });
      host.tabIndex = 0;
      host.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { e.preventDefault(); go(active - 1); }
        if (e.key === "ArrowRight") { e.preventDefault(); go(active + 1); }
      });
      var x0 = null;
      stage.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      stage.addEventListener("touchend", function (e) {
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
      });
    }

    function go(i) {
      var n = set.length;
      i = ((i % n) + n) % n;
      if (i !== active && cards[active].classList.contains("is-playing")) {   // stop the video we move away from
        cards[active].querySelector(".video-frame").innerHTML = thumb(set[active]);
        cards[active].classList.remove("is-playing");
      }
      active = i;
      layout();
    }

    function layout() {
      var n = set.length;
      cards.forEach(function (card, i) {
        var d = i - active;
        if (n > 2) { if (d > n / 2) d -= n; if (d < -n / 2) d += n; }       // wrap so neighbours sit on both sides
        var a = Math.abs(d);
        card.style.setProperty("--d", d);
        card.style.setProperty("--a", a);
        card.style.zIndex = String(10 - a);
        card.classList.toggle("is-active", d === 0);
        card.classList.toggle("is-far", a > 2);
        card.setAttribute("aria-hidden", d === 0 ? "false" : "true");
        card.querySelectorAll("button, iframe").forEach(function (el) { el.tabIndex = d === 0 ? 0 : -1; });
      });
      var count = host.querySelector(".carousel-count");
      if (count) count.textContent = (active + 1) + " / " + n;
    }
    layout();
  }

  /* ---------- Play it yourself: free MIDI and sheet music, YouTube tutorial, PayPal donation ---------- */
  var songHref = function (id) { return "song.html?id=" + encodeURIComponent(id); };
  var safeYt = function (id) { return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : ""; };
  // The downloads a song can offer, in the order midi.php lists them.
  var DOWNLOADS = {
    midi: { short: "MIDI", title: "MIDI file", note: "The full arrangement, for your own keyboard", button: "Download MIDI" },
    pdf: { short: "PDF", title: "Sheet music (PDF)", note: "Print it, or read it on a tablet", button: "Download PDF" },
    musicxml: { short: "MusicXML", title: "Sheet music (MusicXML)", note: "Open and edit it in MuseScore, Sibelius, Finale or Dorico", button: "Download MusicXML" }
  };
  // Only the files that are actually uploaded; a song can be listed before they are.
  var songFormats = function (s) {
    return (s.formats || []).filter(function (f) { return DOWNLOADS[f]; });
  };
  var paypal = /^https:\/\/(www\.)?(paypal\.com|paypal\.me)\//.test(cfg.paypal || "") ? cfg.paypal : "";
  // songId and format say which file the donor gets afterwards. Until a PayPal link is set in config.js,
  // the button opens the payment simulation below instead, so the whole flow can be tried.
  var donateBtn = function (cls, songId, format) {
    return paypal ? '<a class="btn ' + cls + '" href="' + escapeHtml(paypal) + '" target="_blank" rel="noopener">Donate via PayPal</a>'
      : '<button class="btn ' + cls + '" type="button" data-donate-demo data-song="' + escapeHtml(songId || "") + '" data-format="' + escapeHtml(format || "") + '">Donate via PayPal</button>';
  };

  // Any static [data-donate] link takes the PayPal address from config.js, and stays hidden until one is set.
  document.querySelectorAll("[data-donate]").forEach(function (a) {
    if (paypal) { a.href = paypal; a.target = "_blank"; a.rel = "noopener"; a.hidden = false; }
    else a.hidden = true;
  });

  var midiLists = document.querySelectorAll("[data-midi-list]");
  if (midiLists.length) {
    fetch("/php/midi.php?action=songs", { headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (data) {
        var songs = (data && data.songs) || [];
        midiLists.forEach(function (list) {
          if (!songs.length) { list.innerHTML = '<p class="muted">New songs are on the way. Check back soon.</p>'; return; }
          list.innerHTML = songs.map(function (s) {
            var yt = safeYt(s.youtubeId);
            // The tutorial shows as a thumbnail; the YouTube player only loads when it's played, so a long list stays fast.
            return '<article class="record">' +
              (yt ? '<div class="video-frame record-video" data-yt="' + yt + '" data-title="' + escapeHtml(s.title) + ' tutorial">' +
                  '<img src="https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg" alt="" loading="lazy">' +
                  '<button class="video-play" type="button" aria-label="Play the ' + escapeHtml(s.title) + ' tutorial"><span></span></button></div>'
                : '<div class="disc" aria-hidden="true"></div>') +
              "<h3>" + escapeHtml(s.title) + "</h3>" +
              '<span class="muted song-artist">' + escapeHtml(s.artist) + "</span>" +
              "<p>" + escapeHtml(s.description) + "</p>" +
              '<span class="song-prices">' + (songFormats(s).length
                ? "Free " + songFormats(s).map(function (f) { return DOWNLOADS[f].short; }).join(" · ")
                : "Files coming soon") +
                (safeYt(s.youtubeId) ? " · Video tutorial" : "") + "</span>" +
              '<div class="btn-row"><a class="btn btn-brass record-link" href="' + songHref(s.id) + '">Learn Tutorial</a></div>' +
            "</article>";
          }).join("");
          list.addEventListener("click", function (e) {
            var play = e.target.closest(".record-video .video-play");
            if (!play) return;
            var box = play.parentNode, id = box.getAttribute("data-yt");
            box.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0" title="' + escapeHtml(box.getAttribute("data-title")) +
              '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
            trackVideo(id, "play", box.getAttribute("data-title"));
          });
        });
      })
      .catch(function () {
        midiLists.forEach(function (list) { list.innerHTML = '<p class="muted">Songs couldn\'t load just now. Refresh the page to try again.</p>'; });
      });
  }

  var songRoot = document.querySelector("[data-song-page]");
  if (songRoot) {
    var songParams = new URLSearchParams(location.search);
    var songId = songParams.get("id");
    var notFound = function () {
      songRoot.innerHTML = '<section class="page-hero" style="border:0;min-height:50vh"><div class="wrap"><h1>Song not found</h1>' +
        '<p class="lede">That song isn\'t on the list. Browse them all instead.</p><p><a class="btn btn-brass" href="learn.html">See all songs</a></p></div></section>';
    };
    if (!songId) notFound();
    else fetch("/php/midi.php?action=songs&id=" + encodeURIComponent(songId))
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (s) {
        // A link from before the song was renamed shows its current address instead.
        // The thank-you details from a donation are dropped too, so a refresh doesn't download the file again.
        if ((s.id !== songId || songParams.has("donated")) && history.replaceState) history.replaceState(null, "", "?id=" + encodeURIComponent(s.id) + location.hash);
        document.title = s.title + " by " + s.artist + " | Play It Yourself | Reece Music";
        var yt = safeYt(s.youtubeId);
        var video = yt
          ? '<div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/' + yt + '?rel=0" title="' + escapeHtml(s.title) + ' tutorial" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>'
          : '<div class="empty"><div class="vinyl-mini" aria-hidden="true"></div><div><h3>Tutorial video coming soon</h3><p>' +
            (songFormats(s).length ? "The files are ready to download now." : "Check back soon for the files and the video.") + "</p></div></div>";
        var downloads = songFormats(s).map(function (f, i) {
          var d = DOWNLOADS[f];
          return "<li" + (i === 0 ? ' class="is-featured"' : "") + "><div><strong>" + d.title + '</strong><span class="muted">' + d.note + "</span></div>" +
            '<span class="tier-side"><span class="tier-price">Free</span><span class="tier-or">or</span></span>' +
            '<a class="btn btn-ghost" href="/php/midi.php?action=download&amp;id=' + encodeURIComponent(s.id) +
              "&amp;format=" + f + '">' + d.button + "</a>" + donateBtn("btn-ghost", s.id, f) + "</li>";
        }).join("") || '<li><div><strong>Downloads coming soon</strong><span class="muted">The MIDI and sheet music for this song are on the way</span></div></li>' +
          '<li><div><strong>Support Reece</strong><span class="muted">A donation keeps new songs coming</span></div><div class="btn-row">' + donateBtn("btn-ghost", s.id) + "</div></li>";
        songRoot.innerHTML =
          '<section class="page-hero"><div class="wrap">' +
            '<a class="text-link" href="learn.html">All songs</a>' +
            '<h1 style="margin-top:24px">' + escapeHtml(s.title) + "</h1>" +
            '<p class="lede">' + escapeHtml(s.artist) + ". " + escapeHtml(s.description) + "</p>" +
          "</div></section>" +
          '<section class="section"><div class="wrap song-layout">' +
            '<div class="song-video">' + video + "</div>" +
            '<div><ul class="tiers">' + downloads + "</ul></div></div></section>";
        thankDonor(s);
      })
      .catch(notFound);
  }

  // Back from a donation (PayPal's return address, or the simulation below): thank them and start the file
  // they donated for, with a link in case the browser blocks the automatic download.
  function thankDonor(s) {
    if (!songParams.has("donated")) return;
    var format = songParams.get("donated");
    var file = DOWNLOADS[format] && songFormats(s).indexOf(format) !== -1 ? DOWNLOADS[format] : null;
    var href = file && "/php/midi.php?action=download&id=" + encodeURIComponent(s.id) + "&format=" + format;
    var amount = (songParams.get("amount") || "").replace(/[^0-9.]/g, "");
    var box = document.createElement("div");
    box.className = "donate-thanks";
    box.setAttribute("role", "status");
    box.innerHTML = "<strong>Thank you" + (amount ? " for your $" + escapeHtml(amount) + " donation" : " for your donation") + "!</strong>" +
      (file ? "<p>Your " + escapeHtml(file.title) + ' download has started. If it hasn&rsquo;t, <a href="' + href + '">download it here</a>.</p>'
        : "<p>It keeps new songs and tutorials coming.</p>");
    songRoot.querySelector(".page-hero .wrap").appendChild(box);
    if (href) {
      var a = document.createElement("a");
      a.href = href; a.hidden = true;
      document.body.appendChild(a); a.click(); a.remove();
    }
  }

  /* ---------- donation simulation (until a PayPal link is set in config.js) ---------- */
  // Stands in for PayPal's checkout so the flow can be tried end to end: pick an amount, "pay", then come back
  // to the song page the way PayPal's return address will (?donated=<format>), where the file downloads.
  var payDemo = null;
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-donate-demo]");
    if (!b) return;
    if (!payDemo) {
      payDemo = document.createElement("dialog");
      payDemo.className = "lightbox pay-demo";
      payDemo.setAttribute("aria-label", "Donation (simulation)");
      document.body.appendChild(payDemo);
      payDemo.addEventListener("click", function (ev) {
        if (ev.target === payDemo || ev.target.closest("[data-close]")) { payDemo.close(); return; }
        var pick = ev.target.closest("[data-amount]");
        if (pick) {
          payDemo.querySelectorAll("[data-amount]").forEach(function (x) { x.setAttribute("aria-checked", String(x === pick)); });
          payDemo.querySelector("[data-pay]").textContent = "Donate $" + pick.getAttribute("data-amount");
          return;
        }
        var pay = ev.target.closest("[data-pay]");
        if (!pay) return;
        var amount = payDemo.querySelector('[aria-checked="true"]').getAttribute("data-amount");
        pay.disabled = true;
        payDemo.querySelector(".pay-status").textContent = "Processing payment…";
        setTimeout(function () {
          var format = payDemo.getAttribute("data-format");
          location.href = "song.html?id=" + encodeURIComponent(payDemo.getAttribute("data-song")) +
            (format ? "&donated=" + encodeURIComponent(format) : "&donated=") + "&amount=" + amount;
        }, 1400);
      });
    }
    var format = b.getAttribute("data-format");
    payDemo.setAttribute("data-song", b.getAttribute("data-song"));
    payDemo.setAttribute("data-format", format);
    payDemo.innerHTML = '<div class="lightbox-inner">' +
      '<button class="lightbox-close" type="button" aria-label="Close" data-close>&times;</button>' +
      '<p class="pay-flag">Simulation · no money is taken</p>' +
      "<h3>Support Reece</h3>" +
      '<p class="muted">' + (DOWNLOADS[format] ? "After donating, your " + escapeHtml(DOWNLOADS[format].title) + " downloads straight away." : "Every donation keeps new songs coming.") +
        " This window stands in for PayPal's checkout until it's connected.</p>" +
      '<div class="pay-amounts" role="radiogroup" aria-label="Amount">' +
        [3, 5, 10, 20].map(function (a) { return '<button type="button" role="radio" aria-checked="' + (a === 5) + '" data-amount="' + a + '">$' + a + "</button>"; }).join("") +
      "</div>" +
      '<div class="btn-row"><button class="btn btn-brass" type="button" data-pay>Donate $5</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div>' +
      '<p class="pay-status muted" aria-live="polite"></p>' +
    "</div>";
    payDemo.showModal();
  });

  /* ---------- discourage saving artwork (the watermark is baked into the files) ---------- */
  document.addEventListener("contextmenu", function (e) {
    if (e.target.closest && e.target.closest(".art-frame, .lightbox")) e.preventDefault();
  });
  document.addEventListener("dragstart", function (e) {
    if (e.target.closest && e.target.closest(".art-frame, .lightbox")) e.preventDefault();
  });

  /* ---------- digital art viewer ---------- */
  var box = document.getElementById("art-viewer");
  if (box && typeof box.showModal === "function") {
    var bImg = box.querySelector("img");
    var bTitle = box.querySelector("h3");
    var bPrice = box.querySelector("[data-price]");
    var bBuy = box.querySelector("[data-buy]");
    var artType = box.getAttribute("data-art-type") || "digital artwork";
    document.querySelectorAll("[data-art]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var t = btn.getAttribute("data-title");
        bImg.src = btn.getAttribute("data-art");
        bImg.alt = t + ", " + artType + " by Reece Music";
        bTitle.textContent = t;
        bPrice.textContent = btn.getAttribute("data-price");
        bBuy.href = buyLink(t, btn.getAttribute("data-price"));
        box.showModal();
      });
    });
    box.querySelector(".lightbox-close").addEventListener("click", function () { box.close(); });
    box.addEventListener("click", function (e) { if (e.target === box) box.close(); });
  }
  document.querySelectorAll("[data-buy-title]").forEach(function (a) {
    a.href = buyLink(a.getAttribute("data-buy-title"), a.getAttribute("data-buy-price"));
  });

  function buyLink(title, price) {
    return "mailto:" + email + "?subject=" + encodeURIComponent("Digital artwork: " + title) +
      "&body=" + encodeURIComponent("Hi Reece,\n\nI'd like to buy \"" + title + "\" (" + price + ").\n\nName:\nEmail:\n\nThanks!");
  }

  /* ---------- forms: contact.php when available, otherwise a pre-filled email ---------- */
  document.querySelectorAll("form[data-form]").forEach(function (form) {
    var statusEl = form.querySelector(".form-status");
    var kind = form.getAttribute("data-form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector("button[type=submit]");
      var data = new FormData(form);
      if (data.get("topic")) data.set("message", "Enquiry: " + data.get("topic") + "\n\n" + (data.get("message") || ""));
      say(kind === "subscribe" ? "Adding you…" : "Sending…");
      if (btn) btn.disabled = true;
      fetch(form.getAttribute("action"), { method: "POST", body: new URLSearchParams(data), headers: { Accept: "application/json" } })
        .then(function (res) {
          var type = res.headers.get("content-type") || "";
          if (type.indexOf("application/json") === -1) throw new Error("no-backend");
          return res.json().then(function (json) { return { ok: res.ok, json: json }; });
        })
        .then(function (r) {
          if (r.ok && r.json.success) {
            form.reset();
            say(kind !== "subscribe" ? "Message sent. Reece will reply by email."
              : r.json.alreadySubscribed ? "You're already on the mailing list with this email. No need to sign up again."
              : "You're on the list. Check your inbox for a welcome email.");
          } else if (r.json && /not configured/i.test(r.json.error || "")) {
            throw new Error("no-backend");
          } else {
            say((r.json && r.json.error) || "That didn't go through. Email " + email + " instead.");
          }
        })
        .catch(function () { mailFallback(data); })
        .finally(function () { if (btn) btn.disabled = false; });
    });

    function say(t) { if (statusEl) statusEl.textContent = t; }

    function mailFallback(data) {
      var subject, body;
      if (kind === "subscribe") {
        subject = "Add me to the Reece Music mailing list";
        body = "Please add " + (data.get("email") || "") + " to the mailing list.";
      } else {
        var topic = data.get("topic");
        subject = (topic ? topic + " enquiry" : "Website enquiry") + " from " + (data.get("name") || "");
        body = (data.get("message") || "") + "\n\n" + (data.get("name") || "") + "\n" + (data.get("email") || "");
      }
      window.location.href = "mailto:" + email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      say("Your email app should open with the message ready to send.");
    }
  });

  /* ---------- YouTube stats for admin.php: plays on the site and clicks through to YouTube ---------- */
  function trackVideo(id, kind, title) {
    if (!navigator.sendBeacon) return;
    var known = galleryVideos.filter(function (v) { return v.youtube === id; })[0];
    var data = new FormData();
    data.append("video", id);
    data.append("kind", kind);
    data.append("title", (known && known.title) || title || "");
    data.append("page", location.pathname);
    navigator.sendBeacon("/php/track.php", data);
  }

  // Clicks inside a YouTube player can't be seen directly, but the player takes focus when it's clicked.
  // Gallery players are counted by their own play button (they load with autoplay=1).
  var countedPlayers = [];
  setInterval(function () {
    var f = document.activeElement;
    if (!f || f.tagName !== "IFRAME" || countedPlayers.indexOf(f) !== -1) return;
    countedPlayers.push(f);
    var m = /youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/.exec(f.src);
    if (m && !/autoplay=1/.test(f.src)) trackVideo(m[1], "play", f.title);
  }, 500);

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href*="youtube.com"], a[href*="youtu.be"]');
    if (!a) return;
    var m = /(?:[?&]v=|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(a.href);
    trackVideo(m ? m[1] : "channel", "link", m ? a.getAttribute("data-title") || a.textContent.trim() : "YouTube channel");
  });

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
