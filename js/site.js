(function () {
  "use strict";
  var cfg = window.REECE || {};
  var email = cfg.email || "info@reecemusic.com";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

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

    var setPlaying = function (playing) {
      sleeve.classList.toggle("is-playing", playing);
      if (vinyl) vinyl.classList.toggle("is-spinning", playing);
      if (status) status.textContent = playing ? "Now playing" : "Press play";
    };

    var plainEmbed = function () {
      if (!m || host.querySelector("iframe")) return;
      var f = document.createElement("iframe");
      f.src = "https://open.spotify.com/embed/" + m[1] + "/" + m[2] + "?utm_source=generator&theme=0";
      f.height = "152"; f.loading = "lazy"; f.title = "Reece Music on Spotify";
      f.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
      host.innerHTML = ""; host.appendChild(f);
    };

    if (m) {
      var fallbackTimer = setTimeout(plainEmbed, 6000);
      window.onSpotifyIframeApiReady = function (IFrameAPI) {
        clearTimeout(fallbackTimer);
        if (host.querySelector("iframe")) return;
        var mount = document.createElement("div");
        host.innerHTML = ""; host.appendChild(mount);
        IFrameAPI.createController(mount, { uri: "spotify:" + m[1] + ":" + m[2], width: "100%", height: 152 }, function (ctrl) {
          ctrl.addListener("playback_update", function (e) {
            setPlaying(!!(e && e.data && !e.data.isPaused && !e.data.isBuffering));
          });
        });
      };
      var s = document.createElement("script");
      s.src = "https://open.spotify.com/embed/iframe-api/v1";
      s.async = true;
      s.onerror = plainEmbed;
      document.body.appendChild(s);
    }
  }

  document.querySelectorAll("[data-spotify-link]").forEach(function (a) { if (cfg.spotify) a.href = cfg.spotify; });

  /* ---------- performance films ---------- */
  var videoGrid = document.getElementById("video-grid");
  if (videoGrid) {
    var vids = (cfg.videos || []).filter(function (v) { return v && v.youtube; });
    if (!vids.length) {
      document.getElementById("video-empty").hidden = false;
    } else {
      vids.forEach(function (v) {
        var fig = document.createElement("figure");
        fig.className = "video";
        fig.innerHTML =
          '<div class="video-frame">' +
            '<img src="https://i.ytimg.com/vi/' + v.youtube + '/hqdefault.jpg" alt="" loading="lazy">' +
            '<button class="video-play" type="button" aria-label="Play ' + escapeHtml(v.title) + '"><span></span></button>' +
          "</div>" +
          "<figcaption><strong>" + escapeHtml(v.title) + "</strong>" +
          (v.note ? '<span class="muted">' + escapeHtml(v.note) + "</span>" : "") + "</figcaption>";
        fig.querySelector(".video-play").addEventListener("click", function () {
          var frame = fig.querySelector(".video-frame");
          frame.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + v.youtube +
            '?autoplay=1&rel=0" title="' + escapeHtml(v.title) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
        });
        videoGrid.appendChild(fig);
      });
    }
  }

  /* ---------- MIDI store: song lists, song page, purchase page ---------- */
  var money = function (c) { return c == null ? "" : "$" + (c / 100).toFixed(c % 100 ? 2 : 0); };
  var songHref = function (id) { return "song.html?id=" + encodeURIComponent(id); };
  var safeYt = function (id) { return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : ""; };

  var midiLists = document.querySelectorAll("[data-midi-list]");
  if (midiLists.length) {
    fetch("/api/midi/songs", { headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (data) {
        var songs = (data && data.songs) || [];
        midiLists.forEach(function (list) {
          if (!songs.length) { list.innerHTML = '<p class="muted">New songs are on the way. Check back soon.</p>'; return; }
          list.innerHTML = songs.map(function (s) {
            return '<article class="record">' +
              '<div class="disc" aria-hidden="true"></div>' +
              "<h3>" + escapeHtml(s.title) + "</h3>" +
              '<span class="muted song-artist">' + escapeHtml(s.artist) + "</span>" +
              "<p>" + escapeHtml(s.description) + "</p>" +
              '<span class="song-prices">Free preview, ' + money(s.tiers.chorus.price) + " chorus, " + money(s.tiers.full.price) + " full song</span>" +
              '<div class="btn-row"><a class="btn btn-brass" href="' + songHref(s.id) + '">Get the MIDI</a></div>' +
            "</article>";
          }).join("");
        });
      })
      .catch(function () {
        midiLists.forEach(function (list) { list.innerHTML = '<p class="muted">Songs couldn\'t load just now. Refresh the page to try again.</p>'; });
      });
  }

  function startCheckout(id, tier, btn, statusEl) {
    btn.disabled = true;
    statusEl.textContent = "Opening secure checkout…";
    fetch("/api/midi/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, tier: tier }) })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.url) { window.location.href = data.url; return; }
        statusEl.textContent = (data && data.error) || "Checkout couldn't start. Please try again.";
        btn.disabled = false;
      })
      .catch(function () { statusEl.textContent = "Checkout couldn't start. Check your connection and try again."; btn.disabled = false; });
  }

  var songRoot = document.querySelector("[data-song-page]");
  if (songRoot) {
    var songId = new URLSearchParams(location.search).get("id");
    var notFound = function () {
      songRoot.innerHTML = '<section class="page-hero" style="border:0;min-height:50vh"><div class="wrap"><h1>Song not found</h1>' +
        '<p class="lede">That song isn\'t in the store. Browse the full list instead.</p><p><a class="btn btn-brass" href="learn.html">See all songs</a></p></div></section>';
    };
    if (!songId) notFound();
    else fetch("/api/midi/songs?id=" + encodeURIComponent(songId))
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (s) {
        document.title = s.title + " by " + s.artist + " | Play It Yourself | Reece Music";
        var yt = safeYt(s.youtubeId);
        var video = yt
          ? '<div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/' + yt + '?rel=0" title="' + escapeHtml(s.title) + ' tutorial" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>'
          : '<div class="empty"><div class="vinyl-mini" aria-hidden="true"></div><div><h3>Tutorial video coming soon</h3><p>It comes with the chorus and full-song MIDI files once it\'s ready.</p></div></div>';
        songRoot.innerHTML =
          '<section class="page-hero"><div class="wrap">' +
            '<a class="text-link" href="learn.html">All songs</a>' +
            '<h1 style="margin-top:24px">' + escapeHtml(s.title) + "</h1>" +
            '<p class="lede">' + escapeHtml(s.artist) + ". " + escapeHtml(s.description) + "</p>" +
          "</div></section>" +
          '<section class="section"><div class="wrap song-layout">' +
            '<div class="song-video">' + video + "</div>" +
            '<div><ul class="tiers">' +
              '<li><div><strong>' + escapeHtml(s.tiers.free.label) + '</strong><span class="muted">A short excerpt to try</span></div><span class="tier-price">Free</span>' +
                '<a class="btn btn-ghost" href="/api/midi/download?free=' + encodeURIComponent(s.id) + '">Download preview</a></li>' +
              '<li><div><strong>' + escapeHtml(s.tiers.chorus.label) + '</strong><span class="muted">The chorus, with tutorial</span></div><span class="tier-price">' + money(s.tiers.chorus.price) + "</span>" +
                '<button class="btn btn-ghost" type="button" data-tier="chorus">Buy chorus</button></li>' +
              '<li class="is-featured"><div><strong>' + escapeHtml(s.tiers.full.label) + '</strong><span class="muted">The whole song, with tutorial</span></div><span class="tier-price">' + money(s.tiers.full.price) + "</span>" +
                '<button class="btn btn-brass" type="button" data-tier="full">Buy full song</button></li>' +
            "</ul>" +
            '<p class="form-status form-note" role="status" aria-live="polite"></p>' +
            '<p class="form-note">After payment you get an instant download link, valid for 24 hours. Digital downloads can\'t be refunded once downloaded.</p>' +
          "</div></div></section>";
        var statusEl = songRoot.querySelector(".form-status");
        songRoot.querySelectorAll("button[data-tier]").forEach(function (btn) {
          btn.addEventListener("click", function () { startCheckout(s.id, btn.getAttribute("data-tier"), btn, statusEl); });
        });
      })
      .catch(notFound);
  }

  var purchaseRoot = document.querySelector("[data-purchase-page]");
  if (purchaseRoot) {
    var sid = new URLSearchParams(location.search).get("session_id");
    var fail = function (msg) {
      purchaseRoot.innerHTML = "<h1>We couldn't confirm your download</h1>" +
        '<p class="lede">' + escapeHtml(msg) + "</p>" +
        '<div class="btn-row" style="margin-top:28px"><a class="btn btn-brass" href="mailto:' + email + '?subject=' + encodeURIComponent("MIDI download") + '">Email Reece</a>' +
        '<a class="btn btn-ghost" href="learn.html">Back to the songs</a></div>';
    };
    if (!sid) fail("This page needs a payment reference. If you've paid, email info@reecemusic.com with your receipt.");
    else fetch("/api/midi/verify?session_id=" + encodeURIComponent(sid))
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        if (!x.ok) return fail((x.d && x.d.error) || "Something went wrong.");
        var d = x.d, yt = safeYt(d.youtubeId);
        purchaseRoot.innerHTML = "<h1>Thank you</h1>" +
          '<p class="lede">Your ' + escapeHtml(d.tier) + " for " + escapeHtml(d.title) + " is ready.</p>" +
          '<div class="btn-row" style="margin-top:28px"><a class="btn btn-brass" href="' + escapeHtml(d.downloadUrl) + '">Download MIDI</a>' +
          (yt ? '<a class="btn btn-ghost" href="https://www.youtube.com/watch?v=' + yt + '" target="_blank" rel="noopener">Watch the tutorial</a>' : "") + "</div>" +
          '<p class="form-note" style="margin-top:20px">Bookmark this page if you want to download the file again later.</p>' +
          '<p style="margin-top:28px"><a class="text-link" href="learn.html">Browse more songs</a></p>';
      })
      .catch(function () { fail("Check your connection and refresh this page. Your payment is safe."); });
  }

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
            say(kind === "subscribe" ? "You're on the list. Check your inbox for a welcome email." : "Message sent. Reece will reply by email.");
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

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
