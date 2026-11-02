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

  /* ---------- recorded performances: one 3D carousel per gallery ---------- */
  var galleries = document.querySelectorAll("[data-video-gallery]");
  if (galleries.length) {
    var vids = (cfg.videos || []).filter(function (v) { return v && /^[A-Za-z0-9_-]{11}$/.test(v.youtube || ""); });
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
        }
      });
      stage.appendChild(fig);
      return fig;
    });

    if (set.length > 1) {
      var nav = document.createElement("div");
      nav.className = "carousel-nav";
      nav.innerHTML = '<button class="carousel-arrow" type="button" data-step="-1" aria-label="Previous video"><span aria-hidden="true">&#8249;</span></button>' +
        '<div class="carousel-dots">' + set.map(function (v, i) {
          return '<button type="button" data-go="' + i + '" aria-label="Show video ' + (i + 1) + (v.title ? ": " + escapeHtml(v.title) : "") + '"></button>';
        }).join("") + "</div>" +
        '<button class="carousel-arrow" type="button" data-step="1" aria-label="Next video"><span aria-hidden="true">&#8250;</span></button>';
      host.appendChild(nav);
      nav.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        if (b.hasAttribute("data-step")) go(active + Number(b.getAttribute("data-step")));
        else go(Number(b.getAttribute("data-go")));
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
      host.querySelectorAll(".carousel-dots button").forEach(function (b, i) {
        b.setAttribute("aria-current", i === active ? "true" : "false");
      });
    }
    layout();
  }

  /* ---------- Play it yourself: free MIDI, YouTube tutorial, PayPal donation ---------- */
  var songHref = function (id) { return "song.html?id=" + encodeURIComponent(id); };
  var safeYt = function (id) { return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : ""; };
  var paypal = /^https:\/\/(www\.)?(paypal\.com|paypal\.me)\//.test(cfg.paypal || "") ? cfg.paypal : "";
  var donateBtn = function (cls) {
    return paypal ? '<a class="btn ' + cls + '" href="' + escapeHtml(paypal) + '" target="_blank" rel="noopener">Donate via PayPal</a>' : "";
  };

  // Any static [data-donate] link takes the PayPal address from config.js, and stays hidden until one is set.
  document.querySelectorAll("[data-donate]").forEach(function (a) {
    if (paypal) { a.href = paypal; a.target = "_blank"; a.rel = "noopener"; a.hidden = false; }
    else a.hidden = true;
  });

  var midiLists = document.querySelectorAll("[data-midi-list]");
  if (midiLists.length) {
    fetch("/midi.php?action=songs", { headers: { Accept: "application/json" } })
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
              '<span class="song-prices">Free MIDI' + (safeYt(s.youtubeId) ? " · Video tutorial" : "") + "</span>" +
              '<div class="btn-row"><a class="btn btn-brass" href="' + songHref(s.id) + '">Get the MIDI</a></div>' +
            "</article>";
          }).join("");
        });
      })
      .catch(function () {
        midiLists.forEach(function (list) { list.innerHTML = '<p class="muted">Songs couldn\'t load just now. Refresh the page to try again.</p>'; });
      });
  }

  var songRoot = document.querySelector("[data-song-page]");
  if (songRoot) {
    var songId = new URLSearchParams(location.search).get("id");
    var notFound = function () {
      songRoot.innerHTML = '<section class="page-hero" style="border:0;min-height:50vh"><div class="wrap"><h1>Song not found</h1>' +
        '<p class="lede">That song isn\'t on the list. Browse them all instead.</p><p><a class="btn btn-brass" href="learn.html">See all songs</a></p></div></section>';
    };
    if (!songId) notFound();
    else fetch("/midi.php?action=songs&id=" + encodeURIComponent(songId))
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (s) {
        document.title = s.title + " by " + s.artist + " | Play It Yourself | Reece Music";
        var yt = safeYt(s.youtubeId);
        var video = yt
          ? '<div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/' + yt + '?rel=0" title="' + escapeHtml(s.title) + ' tutorial" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>'
          : '<div class="empty"><div class="vinyl-mini" aria-hidden="true"></div><div><h3>Tutorial video coming soon</h3><p>The MIDI file is ready to download now.</p></div></div>';
        songRoot.innerHTML =
          '<section class="page-hero"><div class="wrap">' +
            '<a class="text-link" href="learn.html">All songs</a>' +
            '<h1 style="margin-top:24px">' + escapeHtml(s.title) + "</h1>" +
            '<p class="lede">' + escapeHtml(s.artist) + ". " + escapeHtml(s.description) + "</p>" +
          "</div></section>" +
          '<section class="section"><div class="wrap song-layout">' +
            '<div class="song-video">' + video + "</div>" +
            '<div><ul class="tiers">' +
              '<li class="is-featured"><div><strong>MIDI file</strong><span class="muted">The full arrangement, for your own keyboard</span></div><span class="tier-price">Free</span>' +
                '<a class="btn btn-brass" href="/midi.php?action=download&amp;id=' + encodeURIComponent(s.id) + '">Download MIDI</a></li>' +
              (yt ? '<li><div><strong>Video tutorial</strong><span class="muted">Reece plays it through, step by step</span></div>' +
                '<a class="btn btn-ghost" href="https://www.youtube.com/watch?v=' + yt + '" target="_blank" rel="noopener">Watch on YouTube</a></li>' : "") +
              (paypal ? '<li><div><strong>Support Reece</strong><span class="muted">If the file helps, a donation keeps new ones coming</span></div>' +
                donateBtn("btn-ghost") + "</li>" : "") +
            "</ul></div></div></section>";
      })
      .catch(notFound);
  }

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
