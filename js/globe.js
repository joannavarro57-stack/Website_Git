/*
 * Reece Music: the floating globe in the bottom corner, on every page (public pages and the PHP admin).
 * Self-contained: include it on any page with <script src="…/js/globe.js" defer></script>.
 */
(function () {
  "use strict";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function start() {
    /* ---------- floating globe: a little Earth with orbiting satellites in the corner ---------- */
    // Purely decorative (no controls, and clicks pass straight through). It turns slowly while you read and speeds up
    // as you scroll, and only animates while it's showing and the tab is open.
    (function () {
      if (document.querySelector(".page-player")) return;   // already on the page
      var el = document.createElement("div");
      el.className = "page-player";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = '<canvas class="pp-viz"></canvas>';
      document.body.appendChild(el);
      var lastY = window.scrollY, speed = 0, raf = 0;
      // It appears once you scroll a little, or straight away on a page too short to scroll that far.
      var update = function () {
        var room = document.documentElement.scrollHeight - window.innerHeight;
        el.classList.toggle("is-shown", window.scrollY > 160 || room < 240);
      };

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
      // Each satellite trails something along its orbit that fades out behind it: half of them (picked at random on
      // every visit) a plain thin line, the other half a run of music notes, a random mix of crotchets, quavers and beamed pairs.
      var GLYPHS = ["♩", "♪", "♫", "♬"], TRAIL = 10, TRAIL_GAP = 0.14, TAIL = 1.5, TAIL_STEPS = 20;
      var kinds = [];
      ORBITS.forEach(function (o) { for (var k = 0; k < o.sats; k++) kinds.push(kinds.length % 2 === 0); });
      for (var sh = kinds.length - 1; sh > 0; sh--) {
        var pick = Math.floor(Math.random() * (sh + 1)), tmp = kinds[sh]; kinds[sh] = kinds[pick]; kinds[pick] = tmp;
      }
      ORBITS.forEach(function (o) {
        o.notes = [];
        for (var k = 0; k < o.sats; k++) {
          if (!kinds.pop()) { o.notes.push(null); continue; } // a line trail
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
        // and the trail behind each one: either a fading line or a run of notes
        var near = [], far = [], nearNotes = [], farNotes = [], nearLine = [], farLine = [];
        ORBITS.forEach(function (o) {
          var r = R * o.size;
          for (var k = 0; k < o.sats; k++) {
            var th = spin * o.rate + o.offset + k * 2 * Math.PI / o.sats;
            var a = orbitPoint(o, th, r, drift), b = orbitPoint(o, th + 0.02, r, drift);
            var p = { x: cx + a.x, y: cy - a.y, z: a.z / r, angle: Math.atan2(a.y - b.y, b.x - a.x) };
            (a.z > 0 ? near : far).push(p);
            var prev = a;
            if (!o.notes[k]) for (var s = 1; s <= TAIL_STEPS; s++) {
              var c = orbitPoint(o, th - s * TAIL / TAIL_STEPS, r, drift), front = c.z > 0;
              (front ? nearLine : farLine).push({
                x1: cx + prev.x, y1: cy - prev.y, x2: cx + c.x, y2: cy - c.y,
                alpha: (front ? 0.55 : 0.2) * (1 - (s - 1) / TAIL_STEPS)
              });
              prev = c;
            }
            if (o.notes[k]) for (var j = 0; j < TRAIL; j++) {
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
      window.addEventListener("load", function () { update(); wake(); });
      setTimeout(function () { update(); wake(); }, 1500);   // pages that fill in after loading (songs, galleries)
      update();
      wake();
    })();
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
