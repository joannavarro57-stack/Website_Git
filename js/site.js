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

  /* ---------- gallery titles: on touchscreens the laser-sword rule lights while the title is on screen ---------- */
  // Desktops light it on hover in CSS; phones can't hover, so it runs whenever the title is in view instead.
  if (!reduceMotion && "IntersectionObserver" in window && window.matchMedia("(hover: none)").matches) {
    var saber = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle("is-lit", e.isIntersecting); });
    }, { rootMargin: "-10% 0px -10% 0px" });
    document.querySelectorAll(".video-set-title").forEach(function (t) { saber.observe(t); });
  }

  /* ---------- floating globe: a little Earth with orbiting satellites in the corner ---------- */
  // Purely decorative (no controls, and clicks pass straight through). It turns slowly while you read and speeds up
  // as you scroll, and only animates while it's showing and the tab is open.
  (function () {
    if (document.querySelectorAll("main > section").length < 2) return;
    var el = document.createElement("div");
    el.className = "page-player";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<canvas class="pp-viz"></canvas>';
    document.body.appendChild(el);
    var lastY = window.scrollY, speed = 0, raf = 0;
    var update = function () { el.classList.toggle("is-shown", window.scrollY > 160); };

    // The visualizer: a small Earth with satellites circling it on crossing orbits, after Reece's constellation
    // picture. The orbits are real 3D circles at steep, varied tilts (like a GPS constellation), so satellites fly
    // over the poles and all around the sphere, and each orbit's plane slowly drifts round. The Earth is a wire mesh.
    // Satellites pass behind the see-through globe and come round in front of it; the scene fades out at both sides, so it has no edge.
    var viz = el.querySelector(".pp-viz"), ctx = viz.getContext && viz.getContext("2d"), vw = 0, vh = 0, lvl = 0.3;
    var spin = 0, turn = 0;
    var VIEW = -0.32; // the camera looks down on the globe a little
    var ORBITS = [55, 55, 55, 55, 55, 55, 85, 20].map(function (deg, i) {
      return { incline: deg * Math.PI / 180, node: i * Math.PI / 3 + (i > 5 ? 0.8 : 0), size: 1.32 + (i % 3) * 0.14, sats: i > 5 ? 2 : 3, offset: i * 1.1, rate: 1 + (i % 3) * 0.18 };
    });
    // a point on an orbit, as screen x/y plus depth (z > 0 is the side facing you)
    var orbitPoint = function (o, th, r, drift) {
      var x = r * Math.cos(th), y0 = r * Math.sin(th);
      var y = y0 * Math.cos(o.incline), z = y0 * Math.sin(o.incline);
      var node = o.node + drift, X = x * Math.cos(node) + z * Math.sin(node), Z = -x * Math.sin(node) + z * Math.cos(node);
      return { x: X, y: y * Math.cos(VIEW) - Z * Math.sin(VIEW), z: y * Math.sin(VIEW) + Z * Math.cos(VIEW) };
    };
    // fixed, so the sky and the continents look the same on every visit
    var STARS = [], LAND;
    for (var n = 0; n < 24; n++) STARS.push([(n * 0.618) % 1, (n * 0.377 + 0.13) % 1, n * 1.7]);
    // rough coastlines as [longitude, latitude] in degrees, traced on the mesh: plenty at this size to read as the Earth
    LAND = [
      [[-168, 66], [-156, 71], [-130, 70], [-95, 72], [-80, 73], [-62, 60], [-55, 52], [-66, 45], [-75, 35], [-81, 25], [-97, 26], [-97, 18], [-87, 15], [-83, 9], [-79, 8], [-92, 15], [-105, 20], [-117, 32], [-124, 40], [-124, 48], [-135, 58], [-152, 58], [-165, 62]],
      [[-52, 60], [-42, 60], [-22, 70], [-20, 82], [-45, 83], [-60, 78], [-55, 70]],
      [[-80, 9], [-72, 12], [-60, 10], [-50, 0], [-35, -6], [-39, -15], [-48, -26], [-58, -38], [-65, -42], [-68, -55], [-74, -50], [-72, -35], [-71, -18], [-81, -5]],
      [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [3, 51], [8, 54], [10, 58], [5, 62], [15, 69], [28, 71], [40, 68], [30, 60], [30, 46], [28, 41], [22, 37], [15, 40], [12, 44], [5, 43], [-5, 36]],
      [[28, 41], [36, 36], [35, 30], [43, 13], [52, 17], [58, 24], [66, 25], [72, 20], [77, 8], [80, 15], [88, 22], [92, 20], [98, 16], [100, 3], [104, 1], [106, 10], [109, 21], [117, 24], [122, 30], [121, 40], [127, 39], [130, 43], [141, 46], [142, 53], [136, 55], [150, 60], [160, 62], [163, 70], [180, 69], [180, 72], [140, 74], [110, 77], [80, 73], [68, 70], [55, 69], [44, 67], [40, 68], [30, 60], [30, 46]],
      [[-17, 15], [-17, 21], [-10, 30], [-6, 36], [10, 37], [20, 32], [32, 31], [34, 28], [43, 12], [51, 12], [40, -5], [40, -15], [35, -24], [27, -34], [19, -35], [13, -20], [12, -6], [9, 4], [-8, 4], [-14, 10]],
      [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -26], [150, -37], [141, -38], [135, -35], [129, -32], [115, -35], [113, -26]],
      [[44, -12], [50, -15], [49, -25], [44, -24]],
      [[130, 31], [140, 35], [142, 41], [140, 44], [136, 36]],
      [[-6, 50], [2, 51], [-3, 58], [-6, 56]]
    ];
    var GLOBE_TILT = 0.38; // the north pole leans towards you
    var sizeViz = function () {
      var r = viz.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      vw = r.width; vh = r.height;
      viz.width = Math.round(vw * dpr); viz.height = Math.round(vh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    var satellite = function (x, y, angle, scale, alpha) {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = alpha;
      ctx.fillStyle = "#6FB4E6"; // solar panels
      ctx.fillRect(-7.5 * scale, -1.6 * scale, 5 * scale, 3.2 * scale);
      ctx.fillRect(2.5 * scale, -1.6 * scale, 5 * scale, 3.2 * scale);
      ctx.fillStyle = "#E9C46A"; // gold body
      ctx.fillRect(-2.2 * scale, -2.2 * scale, 4.4 * scale, 4.4 * scale);
      ctx.restore();
    };
    // Each satellite trails a thin line along its orbit that fades out behind it, with a few music notes sitting on
    // the line like a stave: a random mix of crotchets, quavers and beamed pairs, picked afresh on every visit.
    var GLYPHS = ["♩", "♪", "♫", "♬"], TRAIL = 3, TRAIL_GAP = 0.42, TAIL = 1.5, TAIL_STEPS = 20;
    ORBITS.forEach(function (o) {
      o.notes = [];
      for (var k = 0; k < o.sats; k++) {
        var line = [];
        for (var j = 0; j < TRAIL; j++) line.push(GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);
        o.notes.push(line);
      }
    });
    var note = function (n) {
      ctx.globalAlpha = n.alpha;
      ctx.font = Math.round(n.size) + 'px "Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols 2", "DejaVu Sans", serif';
      ctx.fillText(n.glyph, n.x, n.y);
    };
    var segment = function (s) {
      ctx.globalAlpha = s.alpha;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    };
    var drawViz = function (dt, level, t) {
      if (!ctx) return;
      if (!vw) sizeViz();
      if (!vw) return;
      var cx = vw / 2, cy = vh / 2, R = Math.min(vh * 0.27, 64), drift = turn * 1.5;
      spin += dt * (0.00007 + level * level * 0.0005);
      turn += dt * (0.00012 + level * level * 0.0008);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, vw, vh);
      STARS.forEach(function (s) {
        ctx.fillStyle = "rgba(207, 216, 220, " + (0.3 + 0.25 * Math.sin(t / 700 + s[2])).toFixed(2) + ")";
        ctx.fillRect(s[0] * vw, s[1] * vh, 1, 1);
      });

      // where every satellite is, and whether it's on the near or far side of the globe
      // and the trail behind each one: a fading line with notes on it
      var near = [], far = [], nearNotes = [], farNotes = [], nearLine = [], farLine = [];
      ORBITS.forEach(function (o) {
        var r = R * o.size;
        for (var k = 0; k < o.sats; k++) {
          var th = spin * o.rate + o.offset + k * 2 * Math.PI / o.sats;
          var a = orbitPoint(o, th, r, drift), b = orbitPoint(o, th + 0.02, r, drift);
          var p = { x: cx + a.x, y: cy - a.y, z: a.z / r, angle: Math.atan2(a.y - b.y, b.x - a.x) };
          (a.z > 0 ? near : far).push(p);
          var prev = a;
          for (var s = 1; s <= TAIL_STEPS; s++) {
            var c = orbitPoint(o, th - s * TAIL / TAIL_STEPS, r, drift), front = c.z > 0;
            (front ? nearLine : farLine).push({
              x1: cx + prev.x, y1: cy - prev.y, x2: cx + c.x, y2: cy - c.y,
              alpha: (front ? 0.55 : 0.2) * (1 - (s - 1) / TAIL_STEPS)
            });
            prev = c;
          }
          for (var j = 0; j < TRAIL; j++) {
            var q = orbitPoint(o, th - (j + 1) * TRAIL_GAP, r, drift), d = q.z / r;
            (q.z > 0 ? nearNotes : farNotes).push({
              x: cx + q.x, y: cy - q.y, glyph: o.notes[k][j],
              size: (q.z > 0 ? 8 + 2.5 * d : 6.5 + 1.2 * (1 + d)), alpha: (q.z > 0 ? 0.9 : 0.32) * (1 - j / (TRAIL + 1))
            });
          }
        }
      });
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineCap = "round";

      // far halves of the trails and the satellites on them, then the globe over them
      ctx.strokeStyle = "#CFECF0"; ctx.lineWidth = 0.8;
      farLine.forEach(segment);
      ctx.fillStyle = "#CFECF0";
      farNotes.forEach(note);
      ctx.globalAlpha = 1;
      far.forEach(function (p) { satellite(p.x, p.y, p.angle, 0.62 + 0.18 * (1 + p.z), 0.5); });

      // The Earth as a see-through wire mesh: lines of latitude and longitude with the coastlines traced on top.
      // The far side shows faintly through the sphere, the near side glows, and the whole mesh turns.
      var spinLon = turn * 1.2;
      var globePoint = function (lon, lat, out) {
        var la = lat * Math.PI / 180, lo = lon * Math.PI / 180 + spinLon;
        var x = Math.cos(la) * Math.sin(lo), y = Math.sin(la), z = Math.cos(la) * Math.cos(lo);
        var Y = y * Math.cos(GLOBE_TILT) - z * Math.sin(GLOBE_TILT), Z = y * Math.sin(GLOBE_TILT) + z * Math.cos(GLOBE_TILT);
        out.x = cx + x * R; out.y = cy - Y * R; out.front = Z >= 0;
        return out;
      };
      var pt = {};
      // adds to the current path the parts of a line (count points from at(i) as [lon, lat]) on one side of the sphere
      var trace = function (count, at, front) {
        var on = false;
        for (var i = 0; i < count; i++) {
          var ll = at(i);
          globePoint(ll[0], ll[1], pt);
          var ok = pt.front === front;
          if (ok && on) ctx.lineTo(pt.x, pt.y); else if (ok) ctx.moveTo(pt.x, pt.y);
          on = ok;
        }
      };
      var mesh = function (front) {
        ctx.beginPath();
        for (var mer = -180; mer < 180; mer += 15) trace(31, function (i) { return [mer, -90 + i * 6]; }, front);
        for (var par = -75; par <= 75; par += 15) trace(61, function (i) { return [-180 + i * 6, par]; }, front);
        ctx.strokeStyle = front ? "rgba(140, 230, 238, .5)" : "rgba(118, 219, 227, .13)";
        ctx.lineWidth = front ? 0.8 : 0.6;
        ctx.stroke();
      };
      var coasts = function (front) {
        ctx.beginPath();
        LAND.forEach(function (l) { trace(l.length + 1, function (i) { return l[i % l.length]; }, front); });
        ctx.strokeStyle = front ? "rgba(225, 252, 255, .9)" : "rgba(162, 232, 238, .16)";
        ctx.lineWidth = front ? 1.1 : 0.7;
        ctx.stroke();
      };
      // a faint glow inside, so the mesh reads as a ball of light
      var core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.45);
      core.addColorStop(0, "rgba(118, 219, 227, .14)"); core.addColorStop(0.68, "rgba(118, 219, 227, .07)"); core.addColorStop(1, "rgba(118, 219, 227, 0)");
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.45, 0, 2 * Math.PI); ctx.fill();
      mesh(false); coasts(false);
      mesh(true); coasts(true);
      // glowing nodes where the near lines cross
      ctx.fillStyle = "rgba(220, 252, 255, .85)";
      for (var nm = -180; nm < 180; nm += 30) {
        for (var np = -60; np <= 60; np += 30) {
          globePoint(nm, np, pt);
          if (pt.front) ctx.fillRect(pt.x - 0.8, pt.y - 0.8, 1.6, 1.6);
        }
      }
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(162, 232, 238, .6)"; ctx.lineWidth = 1.2; ctx.stroke();

      // near halves of the trails and their satellites, in front of the globe
      ctx.strokeStyle = "#E1FCFF"; ctx.lineWidth = 1;
      nearLine.forEach(segment);
      ctx.fillStyle = "#E1FCFF";
      nearNotes.forEach(note);
      ctx.globalAlpha = 1;
      near.sort(function (a, b) { return a.z - b.z; });
      near.forEach(function (p) { satellite(p.x, p.y, p.angle, 0.8 + 0.25 * p.z, 1); });

      // fade out both sides, so the scene floats with no edge
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "destination-in";
      var fade = ctx.createLinearGradient(0, 0, vw, 0);
      fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(0.16, "#000"); fade.addColorStop(0.84, "#000"); fade.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, vw, vh);
    };

    var last = 0;
    var tick = function (t) {
      var dt = last ? Math.min(64, t - last) : 16;
      last = t;
      var y = window.scrollY;
      speed = speed * 0.88 + Math.abs(y - lastY) / dt * 0.12;
      lastY = y;
      // a slow idle orbit that speeds up with scrolling, eased so it never jumps
      lvl += (Math.min(1, 0.42 + speed / 1.4) - lvl) * 0.06;
      drawViz(dt, lvl, t);
      if (!reduceMotion && !document.hidden && el.classList.contains("is-shown")) raf = requestAnimationFrame(tick);
      else { raf = 0; last = 0; }
    };
    var wake = function () { if (!raf) raf = requestAnimationFrame(tick); };

    window.addEventListener("scroll", function () { update(); wake(); }, { passive: true });
    window.addEventListener("resize", function () { vw = 0; update(); wake(); });
    document.addEventListener("visibilitychange", wake);
    update();
    wake();
  })();

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
