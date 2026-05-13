// Brandbil Cheese-Catching Game
// Top-down highway, fire-truck driving toward camera. Player steers left/right
// to catch cheese wedges. Catch all of them → truck drives into Copenhagen.

(function () {
  const SECTION = document.getElementById("game");
  const CANVAS  = document.getElementById("gameCanvas");
  const HUD     = document.getElementById("gameCount");
  const START   = document.getElementById("gameStart");
  const WIN     = document.getElementById("gameWin");
  const WIN_BTN = document.getElementById("gameWinBack");
  const CLOSE   = document.getElementById("gameClose");

  if (!SECTION || !CANVAS) return; // game DOM not present

  const ctx = CANVAS.getContext("2d");

  // ───────────────────────────────────────────────────────────────────────
  // Game state. Constructed when openGame() is called; reset between runs.
  // ───────────────────────────────────────────────────────────────────────
  let state = null;
  let rafId = 0;

  // Public API — called from app.js when the user taps "DAGE TILBAGE".
  window.openCheeseGame = function (targetCatches) {
    SECTION.hidden = false;
    document.body.classList.add("game-open");
    WIN.hidden = true;
    START.style.display = "";
    state = createState(targetCatches);
    fitCanvas();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  };

  function closeGame() {
    SECTION.hidden = true;
    document.body.classList.remove("game-open");
    cancelAnimationFrame(rafId);
    state = null;
  }

  CLOSE.addEventListener("click", closeGame);
  WIN_BTN.addEventListener("click", closeGame);

  // Debug hook: ?game=N auto-opens with N cheeses to catch. Useful for screenshots.
  const __gp = new URLSearchParams(location.search).get("game");
  if (__gp !== null) {
    const n = Math.max(1, Math.min(99, parseInt(__gp, 10) || 5));
    // Defer one tick so the intro doesn't fight the game.
    setTimeout(() => window.openCheeseGame(n), 50);
  }

  // Start overlay: tap anywhere to begin.
  START.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!state) return;
    state.phase = "playing";
    state.lastSpawn = performance.now();
    START.style.display = "none";
    haptic(12);
  });

  // ───────────────────────────────────────────────────────────────────────
  // State
  // ───────────────────────────────────────────────────────────────────────
  function createState(target) {
    return {
      phase: "idle",          // idle | playing | won
      target,                 // number of cheeses needed
      caught: 0,              // cheeses caught so far
      truckX: 0.5,            // 0..1 across the road
      cheeses: [],            // { x: 0..1, y: 0..1 (from horizon), size }
      speed: 1.0,             // multiplier; grows with caught
      roadOffset: 0,          // for dashed lane line scrolling
      lastSpawn: 0,
      cssW: 0, cssH: 0, dpr: 1,
      // Win sequence
      winT: 0,                // 0..1, fills after victory
      truckScale: 1,          // grows during win
      skylineRise: 0,         // 0..1 how much the skyline has risen
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Canvas sizing (DPR-aware)
  // ───────────────────────────────────────────────────────────────────────
  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const r = SECTION.getBoundingClientRect();
    state.cssW = r.width;
    state.cssH = r.height;
    state.dpr = dpr;
    CANVAS.width  = Math.round(r.width  * dpr);
    CANVAS.height = Math.round(r.height * dpr);
    CANVAS.style.width  = r.width + "px";
    CANVAS.style.height = r.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", () => { if (state) fitCanvas(); });

  // ───────────────────────────────────────────────────────────────────────
  // Input — touch drag (continuous) + keyboard
  // ───────────────────────────────────────────────────────────────────────
  let pointerDownX = null;
  let pointerDownTruck = null;

  CANVAS.addEventListener("pointerdown", (e) => {
    if (!state || state.phase !== "playing") return;
    pointerDownX = e.clientX;
    pointerDownTruck = state.truckX;
    CANVAS.setPointerCapture(e.pointerId);
  });
  CANVAS.addEventListener("pointermove", (e) => {
    if (!state || state.phase !== "playing" || pointerDownX === null) return;
    const dx = (e.clientX - pointerDownX) / roadWidthPx();
    state.truckX = clamp(pointerDownTruck + dx, 0.05, 0.95);
  });
  function pointerUp() { pointerDownX = null; pointerDownTruck = null; }
  CANVAS.addEventListener("pointerup", pointerUp);
  CANVAS.addEventListener("pointercancel", pointerUp);

  document.addEventListener("keydown", (e) => {
    if (!state || state.phase !== "playing" || SECTION.hidden) return;
    const STEP = 0.06;
    if (e.key === "ArrowLeft"  || e.key === "a") state.truckX = clamp(state.truckX - STEP, 0.05, 0.95);
    if (e.key === "ArrowRight" || e.key === "d") state.truckX = clamp(state.truckX + STEP, 0.05, 0.95);
  });

  function roadWidthPx() { return state.cssW * 0.78; }
  function roadLeftPx()  { return state.cssW * 0.11; }

  // ───────────────────────────────────────────────────────────────────────
  // Main loop
  // ───────────────────────────────────────────────────────────────────────
  let lastNow = 0;
  function loop(now) {
    if (!state) return;
    const dt = Math.min(0.05, (now - lastNow) / 1000) || 0.016;
    lastNow = now;

    if (state.phase === "playing") updatePlaying(now, dt);
    else if (state.phase === "won") updateWin(dt);

    render();
    updateHud();
    rafId = requestAnimationFrame(loop);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Update — playing
  // ───────────────────────────────────────────────────────────────────────
  function updatePlaying(now, dt) {
    // Speed multiplier: each catch adds 12%.
    const targetSpeed = 1 + 0.12 * state.caught;
    state.speed += (targetSpeed - state.speed) * 0.08; // ease toward target

    // Scroll the lane markings.
    state.roadOffset = (state.roadOffset + 320 * state.speed * dt) % 60;

    // Cheese fall: y goes 0 (horizon) → 1 (past truck).
    const fallRate = 0.42 * state.speed; // y per second
    for (const c of state.cheeses) c.y += fallRate * dt;

    // Spawn cheeses on a cadence that shortens with caught count.
    const spawnEvery = Math.max(380, 1100 - 50 * state.caught);
    if (now - state.lastSpawn > spawnEvery) {
      spawnCheese();
      state.lastSpawn = now;
    }

    // Collision: truck is near the bottom (y ≈ 0.86). When a cheese passes
    // through that band AND is horizontally close, mark as caught.
    const TRUCK_Y = 0.86;
    const HIT_BAND_Y = 0.08;
    const HIT_X = 0.085;
    for (const c of state.cheeses) {
      if (c.caught || c.missed) continue;
      if (c.y >= TRUCK_Y - HIT_BAND_Y && c.y <= TRUCK_Y + HIT_BAND_Y) {
        if (Math.abs(c.x - state.truckX) < HIT_X) {
          c.caught = true;
          state.caught++;
          haptic(12);
          // burst a few cheese particles for delight
          c.burst = 1;
        }
      }
      if (c.y > 1.15) c.missed = true; // off screen
    }

    // Drop completed cheeses.
    state.cheeses = state.cheeses.filter((c) => !c.missed && (!c.caught || c.burst > 0));
    for (const c of state.cheeses) if (c.caught) c.burst = Math.max(0, c.burst - dt * 3);

    // Win condition.
    if (state.caught >= state.target) {
      state.phase = "won";
      state.winT = 0;
      haptic(60);
    }
  }

  function spawnCheese() {
    // Three preferred lanes, with slight jitter.
    const lanes = [0.22, 0.5, 0.78];
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    state.cheeses.push({
      x: clamp(lane + (Math.random() - 0.5) * 0.04, 0.08, 0.92),
      y: -0.05,
      burst: 0,
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Update — won (Copenhagen reveal)
  // ───────────────────────────────────────────────────────────────────────
  function updateWin(dt) {
    state.winT = Math.min(1, state.winT + dt / 2.4);
    // Ease-out scrolling.
    const t = state.winT;
    state.speed = Math.max(0, state.speed * (1 - t) + 0 * t);
    state.roadOffset = (state.roadOffset + 320 * state.speed * dt) % 60;
    // Skyline rises.
    state.skylineRise = easeOutCubic(t);
    // Truck grows / drives forward.
    state.truckScale = 1 + 0.3 * easeOutCubic(t);

    // After full transition, show the win UI.
    if (t >= 0.98 && WIN.hidden) {
      WIN.hidden = false;
    }
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  // ───────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────
  function render() {
    const W = state.cssW;
    const H = state.cssH;

    // Sky / horizon gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    sky.addColorStop(0,  "#2a0d12");
    sky.addColorStop(1,  "#7a1d2a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.55);

    // Ground
    ctx.fillStyle = "#1a0608";
    ctx.fillRect(0, H * 0.55, W, H * 0.45);

    // Distant city silhouette during win (rises from below the horizon).
    if (state.skylineRise > 0) drawSkyline(W, H, state.skylineRise);

    // Road (a trapezoid pointing to the horizon)
    drawRoad(W, H);

    // Cheeses (perspective-scaled)
    drawCheeses(W, H);

    // Truck
    drawTruck(W, H);
  }

  function drawRoad(W, H) {
    const horizonY = H * 0.55;
    const bottomY  = H;
    const topWidth = W * 0.10;
    const botWidth = W * 0.78;

    // Asphalt trapezoid
    ctx.fillStyle = "#2c1418";
    ctx.beginPath();
    ctx.moveTo(W / 2 - topWidth / 2, horizonY);
    ctx.lineTo(W / 2 + topWidth / 2, horizonY);
    ctx.lineTo(W / 2 + botWidth / 2, bottomY);
    ctx.lineTo(W / 2 - botWidth / 2, bottomY);
    ctx.closePath();
    ctx.fill();

    // Dashed centre line
    ctx.strokeStyle = "rgba(255, 240, 200, 0.85)";
    ctx.lineWidth = 6;
    ctx.setLineDash([24, 36]);
    ctx.lineDashOffset = -state.roadOffset;
    ctx.beginPath();
    ctx.moveTo(W / 2, horizonY);
    ctx.lineTo(W / 2, bottomY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Solid lane edges
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W / 2 - topWidth / 2, horizonY);
    ctx.lineTo(W / 2 - botWidth / 2, bottomY);
    ctx.moveTo(W / 2 + topWidth / 2, horizonY);
    ctx.lineTo(W / 2 + botWidth / 2, bottomY);
    ctx.stroke();
  }

  // Map a (x, y) where x is 0..1 across the road width and y is 0 (horizon)
  // to 1 (past the truck) into screen coordinates with perspective.
  function laneToScreen(x, y, W, H) {
    const horizonY = H * 0.55;
    const bottomY  = H;
    const t = clamp(y, 0, 1);
    // Vertical position: linear from horizon to bottom.
    const screenY = horizonY + (bottomY - horizonY) * t;
    // Horizontal: lanes converge toward centre at the horizon.
    const topWidth = W * 0.10;
    const botWidth = W * 0.78;
    const widthAtY = topWidth + (botWidth - topWidth) * t;
    const screenX = W / 2 + (x - 0.5) * widthAtY;
    // Sprite scale: small near horizon, big near camera.
    const scale = 0.25 + 0.95 * t;
    return { screenX, screenY, scale };
  }

  function drawCheeses(W, H) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const c of state.cheeses) {
      const p = laneToScreen(c.x, c.y, W, H);
      const size = 56 * p.scale;
      ctx.save();
      if (c.caught) {
        ctx.globalAlpha = Math.max(0, c.burst);
        ctx.translate(p.screenX, p.screenY - 24 * (1 - c.burst));
        ctx.scale(1 + 0.6 * (1 - c.burst), 1 + 0.6 * (1 - c.burst));
      } else {
        ctx.translate(p.screenX, p.screenY);
      }
      ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.fillText("🧀", 0, 0);
      ctx.restore();
    }
  }

  function drawTruck(W, H) {
    const p = laneToScreen(state.truckX, 0.86, W, H);
    const size = 96 * p.scale * state.truckScale;
    ctx.save();
    ctx.translate(p.screenX, p.screenY);
    // Subtle bounce
    const bob = Math.sin(performance.now() / 60) * 1.5;
    ctx.translate(0, bob);
    ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🚒", 0, 0);
    ctx.restore();
  }

  // ───────────────────────────────────────────────────────────────────────
  // Copenhagen skyline — procedurally drawn silhouette
  // ───────────────────────────────────────────────────────────────────────
  function drawSkyline(W, H, rise) {
    const baseY = H * 0.55;
    const peakY = H * 0.18;
    const verticalRange = (baseY - peakY) * rise;
    const y0 = baseY - verticalRange;

    // Warm sunset glow behind the skyline (only visible during win).
    const glow = ctx.createLinearGradient(0, y0 - 60, 0, baseY);
    glow.addColorStop(0,  "rgba(255, 180, 120, 0)");
    glow.addColorStop(1,  "rgba(255, 120, 90, 0.35)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, y0 - 60, W, baseY - (y0 - 60));

    // Silhouette path — a stylised Copenhagen waterfront.
    // x positions are proportional to W; y values are measured upward from baseY.
    const buildings = [
      { x: 0.05, w: 0.08, h: 0.20, type: "block" },
      { x: 0.13, w: 0.05, h: 0.45, type: "spire" },     // Christiansborg-ish
      { x: 0.20, w: 0.10, h: 0.30, type: "block" },
      { x: 0.30, w: 0.04, h: 0.60, type: "tower" },     // Rundetårn-ish
      { x: 0.35, w: 0.12, h: 0.25, type: "block" },
      { x: 0.49, w: 0.06, h: 0.75, type: "crane" },     // harbour crane
      { x: 0.56, w: 0.09, h: 0.35, type: "block" },
      { x: 0.65, w: 0.05, h: 0.55, type: "spire" },     // Nikolaj-ish
      { x: 0.71, w: 0.10, h: 0.28, type: "block" },
      { x: 0.82, w: 0.05, h: 0.65, type: "tower" },     // another tower
      { x: 0.88, w: 0.08, h: 0.22, type: "block" },
    ];

    ctx.fillStyle = "rgba(20, 6, 8, 0.95)";
    ctx.strokeStyle = "rgba(20, 6, 8, 1)";
    for (const b of buildings) {
      const x = b.x * W;
      const w = b.w * W;
      const h = b.h * verticalRange;
      const top = baseY - h;
      if (b.type === "block") {
        ctx.fillRect(x, top, w, h);
        // Window dots
        ctx.fillStyle = "rgba(255, 220, 150, 0.7)";
        for (let yy = top + 8; yy < baseY - 8; yy += 10) {
          for (let xx = x + 4; xx < x + w - 4; xx += 8) {
            if (Math.random() < 0.4) ctx.fillRect(xx, yy, 2, 3);
          }
        }
        ctx.fillStyle = "rgba(20, 6, 8, 0.95)";
      } else if (b.type === "spire") {
        ctx.fillRect(x, top, w, h);
        ctx.beginPath();
        ctx.moveTo(x - 2, top);
        ctx.lineTo(x + w / 2, top - h * 0.25);
        ctx.lineTo(x + w + 2, top);
        ctx.closePath();
        ctx.fill();
      } else if (b.type === "tower") {
        ctx.fillRect(x, top, w, h);
        // Onion dome top
        ctx.beginPath();
        ctx.arc(x + w / 2, top, w * 0.7, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
      } else if (b.type === "crane") {
        // Vertical mast
        ctx.fillRect(x + w * 0.4, top, w * 0.2, h);
        // Horizontal arm
        ctx.fillRect(x - w * 0.4, top, w * 1.4, h * 0.08);
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // HUD
  // ───────────────────────────────────────────────────────────────────────
  function updateHud() {
    if (!state) return;
    const remaining = Math.max(0, state.target - state.caught);
    const word = remaining === 1 ? "dag" : "dage";
    HUD.innerHTML = `<span class="truck">🚒</span> ${remaining} ${word} <span class="cheese">🧀</span>`;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Utils
  // ───────────────────────────────────────────────────────────────────────
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function haptic(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {} }
})();
