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

  /* ---------- painting viewer ---------- */
  var box = document.getElementById("art-viewer");
  if (box && typeof box.showModal === "function") {
    var bImg = box.querySelector("img");
    var bTitle = box.querySelector("h3");
    var bPrice = box.querySelector("[data-price]");
    var bBuy = box.querySelector("[data-buy]");
    var artType = box.getAttribute("data-art-type") || "painting";
    document.querySelectorAll("[data-art]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var t = btn.getAttribute("data-title");
        bImg.src = btn.getAttribute("data-art");
        bImg.alt = t + ", " + artType + " by Reece Music";
        bTitle.textContent = t;
        bPrice.textContent = btn.getAttribute("data-price");
        bBuy.href = buyLink(t, btn.getAttribute("data-price"), artType);
        box.showModal();
      });
    });
    box.querySelector(".lightbox-close").addEventListener("click", function () { box.close(); });
    box.addEventListener("click", function (e) { if (e.target === box) box.close(); });
  }
  document.querySelectorAll("[data-buy-title]").forEach(function (a) {
    a.href = buyLink(a.getAttribute("data-buy-title"), a.getAttribute("data-buy-price"));
  });

  function buyLink(title, price, artType) {
    var isDigital = artType === "digital artwork";
    var details = isDigital ? "Name:\nEmail:" : "Name:\nCity / delivery address:";
    return "mailto:" + email + "?subject=" + encodeURIComponent((isDigital ? "Digital artwork: " : "Painting: ") + title) +
      "&body=" + encodeURIComponent("Hi Reece,\n\nI'd like to buy \"" + title + "\" (" + price + ").\n\n" + details + "\n\nThanks!");
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
