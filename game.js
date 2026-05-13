// Brandbil Game — moving truck on a highway catches fire-trucks in soap
// bubbles. Catch them all → truck drives into a recognisable Copenhagen
// skyline. Berlin exit ramps spawn occasionally: pick the wrong lane and the
// truck is forced off, ending the run — reset to zero.

(function () {
  const SECTION  = document.getElementById("game");
  const CANVAS   = document.getElementById("gameCanvas");
  const HUD      = document.getElementById("gameCount");
  const HUD_ROOT = document.getElementById("gameHud");
  const START    = document.getElementById("gameStart");
  const WIN      = document.getElementById("gameWin");
  const WIN_BTN  = document.getElementById("gameWinBack");
  const CLOSE    = document.getElementById("gameClose");

  if (!SECTION || !CANVAS) return;

  const ctx = CANVAS.getContext("2d");
  let state = null;
  let rafId = 0;

  // ───────────────────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────────────────
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

  START.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!state) return;
    state.phase = "playing";
    state.lastSpawn = performance.now();
    state.lastObstacleSpawn = performance.now() - 1500; // first obstacle in ~2 s
    state.lastObstacleSide = null;
    START.style.display = "none";
    haptic(12);
  });

  // Debug hooks: ?game=N auto-opens with N targets. ?autostart=1 also skips
  // the start overlay (useful for headless screenshots).
  const __qp = new URLSearchParams(location.search);
  const __gp = __qp.get("game");
  if (__gp !== null) {
    const n = Math.max(1, Math.min(99, parseInt(__gp, 10) || 5));
    setTimeout(() => {
      window.openCheeseGame(n);
      if (__qp.get("autostart")) {
        setTimeout(() => {
          if (state && state.phase === "idle") {
            state.phase = "playing";
            state.lastSpawn = performance.now();
            state.lastObstacleSpawn = performance.now() + 1500;
            START.style.display = "none";
          }
        }, 100);
      }
    }, 50);
  }

  // ───────────────────────────────────────────────────────────────────────
  // State
  // ───────────────────────────────────────────────────────────────────────
  function createState(target) {
    return {
      phase: "idle",            // idle | playing | losing | resetting | won
      target,
      caught: 0,
      truckX: 0.5,
      truckRot: 0,              // for lose animation
      targets: [],              // soap-bubble firetrucks
      obstacles: [],            // berlin exit ramps
      poofs: [],                // particle bursts
      speed: 1.0,
      roadOffset: 0,
      lastSpawn: 0,
      lastObstacleSpawn: 0,
      cssW: 0, cssH: 0, dpr: 1,
      winT: 0,
      truckScale: 1,
      skylineRise: 0,
      loseT: 0,
      loseSide: 0,              // -1 left, +1 right (which way truck exits)
      resetT: 0,
      hudPulse: 0,              // 1 right after a catch, fades to 0
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Canvas sizing
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
  // Input
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
  const pointerUp = () => { pointerDownX = null; pointerDownTruck = null; };
  CANVAS.addEventListener("pointerup", pointerUp);
  CANVAS.addEventListener("pointercancel", pointerUp);

  document.addEventListener("keydown", (e) => {
    if (!state || state.phase !== "playing" || SECTION.hidden) return;
    const STEP = 0.06;
    if (e.key === "ArrowLeft"  || e.key === "a") state.truckX = clamp(state.truckX - STEP, 0.05, 0.95);
    if (e.key === "ArrowRight" || e.key === "d") state.truckX = clamp(state.truckX + STEP, 0.05, 0.95);
  });

  function roadWidthPx() { return state.cssW * 0.78; }

  // ───────────────────────────────────────────────────────────────────────
  // Main loop
  // ───────────────────────────────────────────────────────────────────────
  let lastNow = 0;
  function loop(now) {
    if (!state) return;
    const dt = Math.min(0.05, (now - lastNow) / 1000) || 0.016;
    lastNow = now;

    if (state.phase === "playing") updatePlaying(now, dt);
    else if (state.phase === "losing") updateLosing(dt);
    else if (state.phase === "resetting") updateResetting(dt);
    else if (state.phase === "won") updateWin(dt);

    updateParticles(dt);
    render();
    updateHud();
    rafId = requestAnimationFrame(loop);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Playing
  // ───────────────────────────────────────────────────────────────────────
  function updatePlaying(now, dt) {
    const targetSpeed = 1 + 0.12 * state.caught;
    state.speed += (targetSpeed - state.speed) * 0.08;

    state.roadOffset = (state.roadOffset + 320 * state.speed * dt) % 60;

    const fallRate = 0.42 * state.speed;
    for (const t of state.targets)   t.y += fallRate * dt;
    for (const o of state.obstacles) o.y += fallRate * dt;

    // Spawn targets.
    const spawnEvery = Math.max(380, 1100 - 50 * state.caught);
    if (now - state.lastSpawn > spawnEvery) {
      spawnTarget();
      state.lastSpawn = now;
    }

    // Spawn obstacles — more frequent, alternating sides. Only one at a time.
    const obstacleEvery = Math.max(2000, 3800 - 200 * state.caught);
    if (now - state.lastObstacleSpawn > obstacleEvery && state.obstacles.length === 0) {
      spawnObstacle();
      state.lastObstacleSpawn = now;
    }

    // Target collision (in the truck's hit-band).
    const TRUCK_Y = 0.86;
    const HIT_BAND_Y = 0.08;
    const HIT_X = 0.085;
    for (const t of state.targets) {
      if (t.caught || t.missed) continue;
      if (t.y >= TRUCK_Y - HIT_BAND_Y && t.y <= TRUCK_Y + HIT_BAND_Y) {
        if (Math.abs(t.x - state.truckX) < HIT_X) {
          t.caught = true;
          state.caught++;
          haptic(15);
          spawnPoof(t.x, t.y);
          pulseHud();
        }
      }
      if (t.y > 1.15) t.missed = true;
    }
    state.targets = state.targets.filter((t) => !t.missed && !t.caught);

    // Obstacle collision: when the ramp reaches the truck's Y, if the truck
    // is on the same side, it's forced off.
    for (const o of state.obstacles) {
      if (o.triggered) continue;
      if (o.y >= TRUCK_Y - 0.04) {
        o.triggered = true;
        const truckOnLeft  = state.truckX < 0.5;
        const truckOnRight = state.truckX > 0.5;
        if ((o.side === "left" && truckOnLeft) || (o.side === "right" && truckOnRight)) {
          state.phase = "losing";
          state.loseT = 0;
          state.loseSide = o.side === "left" ? -1 : +1;
          haptic(60);
        }
      }
    }
    state.obstacles = state.obstacles.filter((o) => o.y < 1.2);

    if (state.caught >= state.target) {
      state.phase = "won";
      state.winT = 0;
      haptic(60);
    }
  }

  function spawnTarget() {
    const lanes = [0.22, 0.5, 0.78];
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    state.targets.push({
      x: clamp(lane + (Math.random() - 0.5) * 0.04, 0.08, 0.92),
      y: -0.05,
      phase: Math.random() * Math.PI * 2,   // hover phase
    });
  }

  function spawnObstacle() {
    // 60% chance to alternate from the last spawn; otherwise pick randomly.
    let side;
    if (state.lastObstacleSide && Math.random() < 0.6) {
      side = state.lastObstacleSide === "left" ? "right" : "left";
    } else {
      side = Math.random() < 0.5 ? "left" : "right";
    }
    state.obstacles.push({
      side,
      y: -0.05,
      triggered: false,
    });
    state.lastObstacleSide = side;
  }

  function spawnPoof(x, y) {
    const parts = [];
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 90;
      parts.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 1, // 1 → 0
        size: 4 + Math.random() * 5,
        hue: 200 + Math.random() * 60, // bluey-white bubble bits
      });
    }
    state.poofs.push({ parts, ringT: 0 });
  }

  function pulseHud() {
    state.hudPulse = 1.0;
    if (HUD_ROOT) {
      HUD_ROOT.classList.remove("pulse");
      void HUD_ROOT.offsetWidth;
      HUD_ROOT.classList.add("pulse");
      setTimeout(() => HUD_ROOT.classList.remove("pulse"), 480);
    }
  }

  function updateParticles(dt) {
    for (const p of state.poofs) {
      p.ringT = Math.min(1, p.ringT + dt * 3);
      for (const part of p.parts) {
        part.x += part.vx * dt * 0.0008; // x/y are normalized 0..1
        part.y += part.vy * dt * 0.0008;
        part.vy += 80 * dt * 0.0008;
        part.life -= dt * 1.6;
      }
    }
    state.poofs = state.poofs.filter((p) => p.parts.some((part) => part.life > 0));
  }

  // ───────────────────────────────────────────────────────────────────────
  // Losing — truck curves off onto the ramp, then we reset.
  // ───────────────────────────────────────────────────────────────────────
  function updateLosing(dt) {
    state.loseT = Math.min(1, state.loseT + dt / 1.6);
    const t = state.loseT;
    // Truck slides toward the loseSide, rotating, and gradually drops out of frame.
    state.truckX = clamp(state.truckX + state.loseSide * dt * 0.55, 0.0, 1.0);
    state.truckRot = state.loseSide * easeInQuad(t) * 1.3; // radians
    state.speed = Math.max(0, state.speed * (1 - t * 0.5));
    state.roadOffset = (state.roadOffset + 320 * state.speed * dt) % 60;

    if (t >= 1) {
      state.phase = "resetting";
      state.resetT = 0;
      haptic(40);
    }
  }

  function updateResetting(dt) {
    state.resetT = Math.min(1, state.resetT + dt / 1.4);
    if (state.resetT >= 1) {
      // Wipe progress and show start screen again.
      state.caught = 0;
      state.targets = [];
      state.obstacles = [];
      state.poofs = [];
      state.speed = 1.0;
      state.truckX = 0.5;
      state.truckRot = 0;
      state.phase = "idle";
      START.style.display = "";
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Win
  // ───────────────────────────────────────────────────────────────────────
  function updateWin(dt) {
    state.winT = Math.min(1, state.winT + dt / 2.6);
    const t = state.winT;
    state.speed = Math.max(0, state.speed * (1 - t));
    state.roadOffset = (state.roadOffset + 320 * state.speed * dt) % 60;
    state.skylineRise = easeOutCubic(t);
    state.truckScale = 1 + 0.3 * easeOutCubic(t);
    if (t >= 0.98 && WIN.hidden) WIN.hidden = false;
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInQuad(t)   { return t * t; }

  // ───────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────
  function render() {
    const W = state.cssW;
    const H = state.cssH;

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    sky.addColorStop(0, "#2a0d12");
    sky.addColorStop(1, "#7a1d2a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.55);

    // Ground
    ctx.fillStyle = "#1a0608";
    ctx.fillRect(0, H * 0.55, W, H * 0.45);

    // Skyline (during win)
    if (state.skylineRise > 0) drawSkyline(W, H, state.skylineRise);

    // Road (split + danger ramp baked in based on active obstacle)
    drawRoad(W, H);

    // Targets
    for (const t of state.targets) drawTarget(t, W, H);

    // Obstacles' signs (foreground, on the side of the road)
    for (const o of state.obstacles) drawObstacleSign(o, W, H);

    // Truck
    drawTruck(W, H);

    // Poof particles (front-most)
    drawPoofs(W, H);

    // During reset, fade to black + reset flash
    if (state.phase === "losing" || state.phase === "resetting") {
      const a = state.phase === "losing"
        ? state.loseT * 0.7
        : 0.7 + state.resetT * 0.0; // hold
      ctx.fillStyle = `rgba(20, 6, 8, ${a})`;
      ctx.fillRect(0, 0, W, H);
      // "TIL BERLIN!" message
      const alpha = state.phase === "losing"
        ? Math.max(0, (state.loseT - 0.2) / 0.8)
        : 1 - state.resetT;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#c8102e";
      ctx.lineWidth = 5;
      ctx.font = `${Math.min(W, H) * 0.13}px "Bangers", "Permanent Marker", "Comic Sans MS", cursive`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeText("TIL BERLIN?!", W / 2, H / 2 - H * 0.04);
      ctx.fillText("TIL BERLIN?!",   W / 2, H / 2 - H * 0.04);
      ctx.font = `${Math.min(W, H) * 0.055}px "Bangers", "Permanent Marker", "Comic Sans MS", cursive`;
      ctx.lineWidth = 3;
      ctx.strokeText("(start forfra…)", W / 2, H / 2 + H * 0.05);
      ctx.fillText("(start forfra…)",   W / 2, H / 2 + H * 0.05);
      ctx.restore();
    }
  }

  // Coordinate mapping (perspective)
  function laneToScreen(x, y, W, H) {
    const horizonY = H * 0.55;
    const bottomY  = H;
    const t = clamp(y, 0, 1.1);
    const screenY = horizonY + (bottomY - horizonY) * t;
    const topWidth = W * 0.10;
    const botWidth = W * 0.78;
    const widthAtY = topWidth + (botWidth - topWidth) * t;
    const screenX = W / 2 + (x - 0.5) * widthAtY;
    const scale = 0.25 + 0.95 * t;
    return { screenX, screenY, scale };
  }

  // ── Road ───────────────────────────────────────────────────────────────
  // Perspective trapezoid from horizonY → bottomY. When an obstacle is on
  // the road, the road FORKS at the obstacle's y:
  //  - Below the fork (between truck and fork — closer to camera): full road
  //  - Above the fork (beyond the fork — further away): only the SAFE lane
  //    continues to the horizon; the DANGER lane curves off the road, going
  //    UP and outward to the side of the screen.
  function drawRoad(W, H) {
    const horizonY = H * 0.55;
    const bottomY  = H;
    const topWidth = W * 0.10;
    const botWidth = W * 0.78;

    const o = activeObstacle();

    // ── 1. Asphalt of main road (incl. the safe lane above the fork) ─────
    ctx.fillStyle = "#2c1418";
    ctx.beginPath();
    if (!o) {
      ctx.moveTo(W / 2 - topWidth / 2, horizonY);
      ctx.lineTo(W / 2 + topWidth / 2, horizonY);
      ctx.lineTo(W / 2 + botWidth / 2, bottomY);
      ctx.lineTo(W / 2 - botWidth / 2, bottomY);
    } else {
      const t = clamp(o.y, 0, 1);
      const splitY = horizonY + (bottomY - horizonY) * t;
      const halfAtSplit = (topWidth + (botWidth - topWidth) * t) / 2;
      const dir = o.side === "left" ? -1 : 1;

      // Above the fork: just the safe-side half-lane from horizon to splitY.
      // Below the fork: full road from splitY to bottom (truck still has
      // both lanes available until the fork reaches it).
      if (dir === 1) {
        // Danger right → safe is left
        ctx.moveTo(W / 2 - topWidth / 2, horizonY);    // top-left (safe lane top-left at horizon)
        ctx.lineTo(W / 2,                horizonY);    // top-right (safe lane top-right at horizon = centre)
        ctx.lineTo(W / 2,                splitY);      // safe lane right-edge at splitY (kink-inside)
        ctx.lineTo(W / 2 + halfAtSplit,  splitY);      // kink-outer: jump out to full road outer edge
        ctx.lineTo(W / 2 + botWidth / 2, bottomY);     // bottom-right
        ctx.lineTo(W / 2 - botWidth / 2, bottomY);     // bottom-left
      } else {
        // Danger left → safe is right
        ctx.moveTo(W / 2,                horizonY);    // safe lane top-left = centre at horizon
        ctx.lineTo(W / 2 + topWidth / 2, horizonY);    // safe lane top-right at horizon
        ctx.lineTo(W / 2 + botWidth / 2, bottomY);     // bottom-right
        ctx.lineTo(W / 2 - botWidth / 2, bottomY);     // bottom-left
        ctx.lineTo(W / 2 - halfAtSplit,  splitY);      // kink-outer on left
        ctx.lineTo(W / 2,                splitY);      // safe lane left-edge at splitY
      }
    }
    ctx.closePath();
    ctx.fill();

    // ── 2. Danger ramp curving UP and outward toward the screen side ─────
    if (o) drawDangerRamp(o, W, H);

    // ── 3. Centre dashed line — only on the full-road portion ────────────
    ctx.strokeStyle = "rgba(255, 240, 200, 0.85)";
    ctx.lineWidth = 6;
    ctx.setLineDash([24, 36]);
    ctx.lineDashOffset = -state.roadOffset;
    ctx.beginPath();
    if (!o) {
      ctx.moveTo(W / 2, horizonY);
      ctx.lineTo(W / 2, bottomY);
    } else {
      const t = clamp(o.y, 0, 1);
      const splitY = horizonY + (bottomY - horizonY) * t;
      // Dashed centre only on the full-road portion (below splitY).
      ctx.moveTo(W / 2, splitY);
      ctx.lineTo(W / 2, bottomY);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // ── 4. Edge lines ────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (!o) {
      ctx.moveTo(W / 2 - topWidth / 2, horizonY);
      ctx.lineTo(W / 2 - botWidth / 2, bottomY);
      ctx.moveTo(W / 2 + topWidth / 2, horizonY);
      ctx.lineTo(W / 2 + botWidth / 2, bottomY);
    } else {
      const t = clamp(o.y, 0, 1);
      const splitY = horizonY + (bottomY - horizonY) * t;
      const halfAtSplit = (topWidth + (botWidth - topWidth) * t) / 2;
      const dir = o.side === "left" ? -1 : 1;

      if (dir === 1) {
        // Safe outer edge (left): horizon → bottom on the left.
        ctx.moveTo(W / 2 - topWidth / 2, horizonY);
        ctx.lineTo(W / 2 - botWidth / 2, bottomY);
        // Safe inner edge (right of safe lane): centre at horizon → splitY.
        ctx.moveTo(W / 2, horizonY);
        ctx.lineTo(W / 2, splitY);
        // Outer edge of full-road part below splitY: from kink to bottom-right.
        ctx.moveTo(W / 2 + halfAtSplit, splitY);
        ctx.lineTo(W / 2 + botWidth / 2, bottomY);
      } else {
        // Safe outer edge (right).
        ctx.moveTo(W / 2 + topWidth / 2, horizonY);
        ctx.lineTo(W / 2 + botWidth / 2, bottomY);
        // Safe inner edge (left of safe lane).
        ctx.moveTo(W / 2, horizonY);
        ctx.lineTo(W / 2, splitY);
        // Outer edge of full-road part below splitY on the left.
        ctx.moveTo(W / 2 - halfAtSplit, splitY);
        ctx.lineTo(W / 2 - botWidth / 2, bottomY);
      }
    }
    ctx.stroke();

    // ── 5. The kink "join" line — a thick yellow stripe drawing the eye
    // to the fork's outer corner where the ramp departs ──────────────────
    if (o) {
      const t = clamp(o.y, 0, 1);
      const splitY = horizonY + (bottomY - horizonY) * t;
      const halfAtSplit = (topWidth + (botWidth - topWidth) * t) / 2;
      const dir = o.side === "left" ? -1 : 1;
      ctx.strokeStyle = "#f3c83d";
      ctx.lineWidth = 4;
      ctx.beginPath();
      // Hard line down the inside of the safe lane, marking "stay this side"
      ctx.moveTo(W / 2, horizonY);
      ctx.lineTo(W / 2, splitY);
      ctx.stroke();
      // A short hazard-yellow segment at the kink: from kink-inside to kink-outer.
      ctx.strokeStyle = "rgba(243, 200, 61, 0.9)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(W / 2, splitY);
      ctx.lineTo(W / 2 + dir * halfAtSplit, splitY);
      ctx.stroke();
    }
  }

  function activeObstacle() {
    // Pick the obstacle currently on-road (highest y wins).
    let pick = null;
    for (const o of state.obstacles) {
      if (o.y < 0.04 || o.y > 1.05) continue;
      if (!pick || o.y > pick.y) pick = o;
    }
    return pick;
  }

  // The danger ramp peels off at the fork and curves UP-and-OUT toward the
  // horizon-side corner of the screen. Suggests a loop interchange off-screen.
  function drawDangerRamp(o, W, H) {
    const horizonY = H * 0.55;
    const bottomY  = H;
    const t = clamp(o.y, 0, 1);
    const splitY = horizonY + (bottomY - horizonY) * t;
    const topWidth = W * 0.10;
    const botWidth = W * 0.78;
    const halfAtSplit = (topWidth + (botWidth - topWidth) * t) / 2;
    const dir = o.side === "left" ? -1 : 1;

    // Anchor points on the fork.
    const innerStartX = W / 2;
    const innerStartY = splitY;
    const outerStartX = W / 2 + dir * halfAtSplit;
    const outerStartY = splitY;

    // Exit point: off the side of the screen, at horizon-mid height
    // (we want the ramp to curl up and outward).
    const exitMidY = horizonY + (bottomY - horizonY) * 0.25; // somewhat above split
    const exitInnerX = W / 2 + dir * W * 1.05;
    const exitInnerY = exitMidY;
    const exitOuterX = W / 2 + dir * W * 1.15;
    const exitOuterY = exitMidY - H * 0.06;

    // Bezier control points for the inner and outer edges. The control
    // points pull the curve outward + slightly upward, giving the
    // "sweeping ramp" look.
    const ic1x = W / 2 + dir * W * 0.35;
    const ic1y = splitY - (splitY - horizonY) * 0.05;
    const ic2x = W / 2 + dir * W * 0.75;
    const ic2y = exitInnerY + 6;
    const oc1x = W / 2 + dir * (halfAtSplit + W * 0.30);
    const oc1y = splitY - (splitY - horizonY) * 0.25;
    const oc2x = W / 2 + dir * W * 0.95;
    const oc2y = exitOuterY + 12;

    // Asphalt body.
    ctx.fillStyle = "#332024";
    ctx.beginPath();
    ctx.moveTo(innerStartX, innerStartY);
    ctx.bezierCurveTo(ic1x, ic1y, ic2x, ic2y, exitInnerX, exitInnerY);
    // Connect across to outer edge at the exit.
    ctx.lineTo(exitOuterX, exitOuterY);
    ctx.bezierCurveTo(oc2x, oc2y, oc1x, oc1y, outerStartX, outerStartY);
    ctx.closePath();
    ctx.fill();

    // Hazard chevrons painted across the ramp width.
    drawRampChevrons(
      innerStartX, innerStartY, ic1x, ic1y, ic2x, ic2y, exitInnerX, exitInnerY,
      outerStartX, outerStartY, oc1x, oc1y, oc2x, oc2y, exitOuterX, exitOuterY,
      dir
    );

    // White edge stripes along the curved edges.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(innerStartX, innerStartY);
    ctx.bezierCurveTo(ic1x, ic1y, ic2x, ic2y, exitInnerX, exitInnerY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(outerStartX, outerStartY);
    ctx.bezierCurveTo(oc1x, oc1y, oc2x, oc2y, exitOuterX, exitOuterY);
    ctx.stroke();

    // Implied "loop" curl off-screen, hinting at the highway-loop interchange.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    const arcCx = W / 2 + dir * W * 1.05;
    const arcCy = exitMidY - H * 0.07;
    ctx.arc(arcCx, arcCy, W * 0.13,
      dir > 0 ? Math.PI * 0.55 : Math.PI * 0.45,
      dir > 0 ? Math.PI * 1.95 : Math.PI * 1.05,
      dir > 0);
    ctx.stroke();
  }

  // Paint alternating yellow / black chevrons across the ramp width.
  function drawRampChevrons(
    ix0, iy0, ic1x, ic1y, ic2x, ic2y, ix3, iy3,
    ox0, oy0, oc1x, oc1y, oc2x, oc2y, ox3, oy3,
    dir
  ) {
    const STEPS = 5;
    for (let i = 0; i < STEPS; i++) {
      const a = i / STEPS;
      const b = (i + 0.5) / STEPS;

      const innerA = bez(ix0, iy0, ic1x, ic1y, ic2x, ic2y, ix3, iy3, a);
      const innerB = bez(ix0, iy0, ic1x, ic1y, ic2x, ic2y, ix3, iy3, b);
      const outerA = bez(ox0, oy0, oc1x, oc1y, oc2x, oc2y, ox3, oy3, a);
      const outerB = bez(ox0, oy0, oc1x, oc1y, oc2x, oc2y, ox3, oy3, b);

      ctx.fillStyle = (i % 2 === 0) ? "rgba(243, 200, 61, 0.85)" : "rgba(0, 0, 0, 0.85)";
      ctx.beginPath();
      ctx.moveTo(innerA.x, innerA.y);
      ctx.lineTo(innerB.x, innerB.y);
      ctx.lineTo(outerB.x, outerB.y);
      ctx.lineTo(outerA.x, outerA.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Cubic Bezier sampler.
  function bez(x0, y0, x1, y1, x2, y2, x3, y3, t) {
    const m = 1 - t;
    const x = m*m*m*x0 + 3*m*m*t*x1 + 3*m*t*t*x2 + t*t*t*x3;
    const y = m*m*m*y0 + 3*m*m*t*y1 + 3*m*t*t*y2 + t*t*t*y3;
    return { x, y };
  }

  // ── Targets: fire-trucks in soap bubbles, hovering ────────────────────
  function drawTarget(t, W, H) {
    const p = laneToScreen(t.x, t.y, W, H);
    const now = performance.now() / 1000;
    const hover = Math.sin(now * 2.2 + t.phase) * 4 * p.scale;
    const bobX = Math.cos(now * 1.7 + t.phase) * 2 * p.scale;
    const screenX = p.screenX + bobX;
    const screenY = p.screenY + hover;
    const bubbleR = 30 * p.scale;

    ctx.save();
    ctx.translate(screenX, screenY);

    // Rainbow outer shimmer
    const rainbow = ctx.createRadialGradient(0, 0, bubbleR * 0.6, 0, 0, bubbleR);
    rainbow.addColorStop(0,    "rgba(255, 255, 255, 0)");
    rainbow.addColorStop(0.68, "rgba(255, 200, 220, 0.10)");
    rainbow.addColorStop(0.82, "rgba(180, 220, 255, 0.22)");
    rainbow.addColorStop(0.96, "rgba(200, 240, 255, 0.55)");
    rainbow.addColorStop(1,    "rgba(255, 255, 255, 0.85)");
    ctx.fillStyle = rainbow;
    ctx.beginPath();
    ctx.arc(0, 0, bubbleR, 0, Math.PI * 2);
    ctx.fill();

    // Translucent fill
    ctx.fillStyle = "rgba(190, 215, 255, 0.12)";
    ctx.beginPath();
    ctx.arc(0, 0, bubbleR * 0.96, 0, Math.PI * 2);
    ctx.fill();

    // Fire-truck emoji inside
    ctx.font = `${bubbleR * 1.15}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🚒", 0, 1);

    // Top-left highlight (specular)
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    ctx.ellipse(-bubbleR * 0.36, -bubbleR * 0.42, bubbleR * 0.20, bubbleR * 0.10, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Tiny secondary highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.beginPath();
    ctx.arc(-bubbleR * 0.18, -bubbleR * 0.58, bubbleR * 0.07, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── Berlin obstacle sign + post ───────────────────────────────────────
  // Mounted just BEFORE the fork (slightly closer to camera than splitY),
  // on the danger side of the road, so the user sees it as a warning while
  // approaching.
  function drawObstacleSign(o, W, H) {
    if (o.y < -0.05) return;
    const horizonY = H * 0.55;
    const bottomY  = H;
    const t = clamp(o.y, 0, 1);
    const splitY = horizonY + (bottomY - horizonY) * t;
    const topWidth = W * 0.10;
    const botWidth = W * 0.78;
    const halfAtSplit = (topWidth + (botWidth - topWidth) * t) / 2;
    const dir = o.side === "left" ? -1 : 1;

    // Position: slightly above the fork, just past the road's outer edge
    // (so it floats next to where the ramp peels off).
    const signX = W / 2 + dir * (halfAtSplit + W * 0.07);
    const signY = splitY - H * 0.02;
    const sz = 80 * (0.4 + t * 0.85);   // grow with perspective

    ctx.save();
    ctx.translate(signX, signY);

    // Post
    ctx.fillStyle = "#7a7a7a";
    ctx.fillRect(-sz * 0.04, 0, sz * 0.08, sz * 0.55);

    // Sign panel: yellow autobahn-style
    const sw = sz * 1.15, sh = sz * 0.55;
    ctx.fillStyle = "#f3c83d";
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = sz * 0.05;
    ctx.fillRect(-sw / 2, -sz * 0.55, sw, sh);
    ctx.strokeRect(-sw / 2, -sz * 0.55, sw, sh);

    // "BERLIN" + arrow
    ctx.fillStyle = "#1a1a1a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${sz * 0.22}px Arial, sans-serif`;
    ctx.fillText("BERLIN", 0, -sz * 0.38);
    ctx.font = `bold ${sz * 0.30}px Arial, sans-serif`;
    ctx.fillText(o.side === "left" ? "←" : "→", 0, -sz * 0.12);

    ctx.restore();
  }

  // ── Truck — procedural top-down 3/4 perspective ──────────────────────
  function drawTruck(W, H) {
    const p = laneToScreen(state.truckX, 0.86, W, H);
    const scale = p.scale * state.truckScale;
    const size = 110 * scale;

    ctx.save();
    ctx.translate(p.screenX, p.screenY);
    ctx.rotate(state.truckRot);

    // Subtle road bounce
    const bob = Math.sin(performance.now() / 60) * 1.2;
    ctx.translate(0, bob);

    // Ground shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(2, size * 0.42, size * 0.42, size * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dimensions
    const cargoTopW = size * 0.42;    // narrower at front (perspective)
    const cargoBotW = size * 0.5;     // wider at back
    const cargoH    = size * 0.55;
    const cabH      = size * 0.22;

    // Wheels (drawn first so chassis covers their tops)
    ctx.fillStyle = "#0e0e0e";
    const wOff = size * 0.04;
    const wW = size * 0.06, wH = size * 0.10;
    // Rear wheels
    rrect(-cargoBotW / 2 - wOff, cargoH * 0.05, wW, wH, 2);
    rrect( cargoBotW / 2 - wW + wOff, cargoH * 0.05, wW, wH, 2);
    // Front wheels (under cab)
    rrect(-cargoTopW / 2 - wOff, -cargoH * 0.5 - cabH * 0.6, wW * 0.9, wH * 0.85, 2);
    rrect( cargoTopW / 2 - wW + wOff, -cargoH * 0.5 - cabH * 0.6, wW * 0.9, wH * 0.85, 2);

    // Cargo box — top surface (trapezoid)
    const cargoGrad = ctx.createLinearGradient(0, -cargoH * 0.5, 0, cargoH * 0.5);
    cargoGrad.addColorStop(0, "#5e89e6");
    cargoGrad.addColorStop(1, "#3a6dd6");
    ctx.fillStyle = cargoGrad;
    ctx.beginPath();
    ctx.moveTo(-cargoTopW / 2, -cargoH * 0.5);
    ctx.lineTo( cargoTopW / 2, -cargoH * 0.5);
    ctx.lineTo( cargoBotW / 2,  cargoH * 0.5);
    ctx.lineTo(-cargoBotW / 2,  cargoH * 0.5);
    ctx.closePath();
    ctx.fill();

    // Cargo box BACK face (visible band closest to camera)
    const backH = size * 0.10;
    ctx.fillStyle = "#27468a";
    ctx.beginPath();
    ctx.moveTo(-cargoBotW / 2, cargoH * 0.5);
    ctx.lineTo( cargoBotW / 2, cargoH * 0.5);
    ctx.lineTo( cargoBotW / 2 + size * 0.005, cargoH * 0.5 + backH);
    ctx.lineTo(-cargoBotW / 2 - size * 0.005, cargoH * 0.5 + backH);
    ctx.closePath();
    ctx.fill();

    // Roll-up door lines on the back
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const yy = cargoH * 0.5 + backH * (i / 5);
      ctx.beginPath();
      ctx.moveTo(-cargoBotW / 2 + 2, yy);
      ctx.lineTo( cargoBotW / 2 - 2, yy);
      ctx.stroke();
    }
    // Door handle
    ctx.fillStyle = "#d0d0d0";
    ctx.fillRect(-size * 0.02, cargoH * 0.5 + backH * 0.4, size * 0.04, backH * 0.2);

    // Tail lights at the back corners
    ctx.fillStyle = "#ff3a3a";
    ctx.fillRect(-cargoBotW / 2 + size * 0.02, cargoH * 0.5 + backH * 0.65, size * 0.06, size * 0.025);
    ctx.fillRect( cargoBotW / 2 - size * 0.08, cargoH * 0.5 + backH * 0.65, size * 0.06, size * 0.025);

    // White stripe down the box top (decorative)
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(-size * 0.015, -cargoH * 0.5, size * 0.03, cargoH);

    // "CHEESE" label on box (Easter egg)
    ctx.save();
    ctx.fillStyle = "rgba(255, 240, 200, 0.85)";
    ctx.font = `bold ${size * 0.075}px "Bangers", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CHEESE", 0, 0);
    ctx.restore();

    // Cab — at the front, slightly narrower than cargo top
    const cabW = cargoTopW * 0.94;
    const cabTopW = cabW * 0.86;
    const cabGrad = ctx.createLinearGradient(0, -cargoH * 0.5 - cabH, 0, -cargoH * 0.5);
    cabGrad.addColorStop(0, "#2d558c");
    cabGrad.addColorStop(1, "#27468a");
    ctx.fillStyle = cabGrad;
    ctx.beginPath();
    ctx.moveTo(-cabTopW / 2, -cargoH * 0.5 - cabH);
    ctx.lineTo( cabTopW / 2, -cargoH * 0.5 - cabH);
    ctx.lineTo( cabW / 2,    -cargoH * 0.5);
    ctx.lineTo(-cabW / 2,    -cargoH * 0.5);
    ctx.closePath();
    ctx.fill();

    // Windshield
    ctx.fillStyle = "rgba(170, 220, 245, 0.85)";
    ctx.beginPath();
    ctx.moveTo(-cabTopW / 2 + size * 0.025, -cargoH * 0.5 - cabH * 0.82);
    ctx.lineTo( cabTopW / 2 - size * 0.025, -cargoH * 0.5 - cabH * 0.82);
    ctx.lineTo( cabW / 2    - size * 0.03,  -cargoH * 0.5 - cabH * 0.32);
    ctx.lineTo(-cabW / 2    + size * 0.03,  -cargoH * 0.5 - cabH * 0.32);
    ctx.closePath();
    ctx.fill();

    // Windshield reflection (subtle stripe)
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.beginPath();
    ctx.moveTo(-cabTopW / 2 + size * 0.04, -cargoH * 0.5 - cabH * 0.78);
    ctx.lineTo( cabTopW / 2 - size * 0.04, -cargoH * 0.5 - cabH * 0.78);
    ctx.lineTo( cabW / 2    - size * 0.05, -cargoH * 0.5 - cabH * 0.6);
    ctx.lineTo(-cabW / 2    + size * 0.05, -cargoH * 0.5 - cabH * 0.6);
    ctx.closePath();
    ctx.fill();

    // Headlights at the very front
    ctx.fillStyle = "#fff2a8";
    ctx.fillRect(-cabTopW / 2 + size * 0.04, -cargoH * 0.5 - cabH - size * 0.022, size * 0.07, size * 0.028);
    ctx.fillRect( cabTopW / 2 - size * 0.11, -cargoH * 0.5 - cabH - size * 0.022, size * 0.07, size * 0.028);

    // Grille
    ctx.fillStyle = "#0e0e0e";
    ctx.fillRect(-cabTopW * 0.18, -cargoH * 0.5 - cabH - size * 0.015, cabTopW * 0.36, size * 0.018);

    ctx.restore();
  }

  // Small rounded-rect helper using current fillStyle.
  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  // ── Poof particles ───────────────────────────────────────────────────
  function drawPoofs(W, H) {
    for (const p of state.poofs) {
      // Expanding ring
      if (p.ringT < 1) {
        const origin = p.parts[0];
        const ring = laneToScreen(origin.x, origin.y, W, H);
        const ringR = 12 + p.ringT * 60;
        ctx.save();
        ctx.globalAlpha = 1 - p.ringT;
        ctx.strokeStyle = "rgba(255, 240, 200, 0.7)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ring.screenX, ring.screenY, ringR * ring.scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // Particles
      for (const part of p.parts) {
        if (part.life <= 0) continue;
        const sp = laneToScreen(part.x, part.y, W, H);
        ctx.save();
        ctx.globalAlpha = Math.max(0, part.life);
        ctx.fillStyle = `hsl(${part.hue}, 90%, 80%)`;
        ctx.beginPath();
        ctx.arc(sp.screenX, sp.screenY, part.size * sp.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Copenhagen skyline — real landmarks
  // ───────────────────────────────────────────────────────────────────────
  function drawSkyline(W, H, rise) {
    const baseY = H * 0.55;
    const peakY = H * 0.13;
    const vRange = (baseY - peakY) * rise;
    const baselineY = baseY;
    const factor = vRange / (baseY - peakY);

    // Warm sunset behind
    const glow = ctx.createLinearGradient(0, baselineY - vRange - 80, 0, baselineY);
    glow.addColorStop(0,    "rgba(255, 200, 140, 0)");
    glow.addColorStop(0.5,  "rgba(255, 170, 120, 0.4)");
    glow.addColorStop(1,    "rgba(255, 110, 80, 0.5)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, baselineY - vRange - 80, W, vRange + 80);

    // Far cloud band
    ctx.fillStyle = "rgba(255, 220, 200, 0.15)";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(W * (i + 0.5) / 5, baselineY - vRange - 30, W * 0.12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (factor < 0.05) return;

    // Layout — each function takes its base position and a "scale unit" derived
    // from W and vRange. Building heights are fractions of vRange.
    const u = vRange / 0.65; // unit so heights look right at full rise

    // From left to right:
    drawNyhavnRow(W * 0.00, baselineY, W * 0.16, u, ["#e8b54f", "#c84738"]);
    drawDragonSpire( W * 0.17, baselineY, W * 0.09, u);
    drawChristiansborg(W * 0.27, baselineY, W * 0.10, u);
    drawCityHall(    W * 0.38, baselineY, W * 0.10, u);
    drawRundetaarn(  W * 0.50, baselineY, W * 0.07, u);
    drawMarbleChurch(W * 0.58, baselineY, W * 0.14, u);
    drawNyhavnRow(W * 0.74, baselineY, W * 0.26, u, ["#3a6e9c", "#e87b3a", "#c84738", "#e8b54f"]);
  }

  // Row of Nyhavn-coloured townhouses.
  function drawNyhavnRow(x, baseY, w, u, colors) {
    const n = colors.length;
    const houseW = w / n;
    for (let i = 0; i < n; i++) {
      const hx = x + i * houseW;
      const h = u * (0.22 + (i % 2) * 0.04 + Math.random() * 0); // stable
      const houseH = u * (0.22 + (i % 2 === 0 ? 0.04 : 0));
      drawNyhavnHouse(hx + houseW * 0.05, baseY, houseW * 0.9, houseH, colors[i]);
    }
  }

  function drawNyhavnHouse(x, baseY, w, h, color) {
    const top = baseY - h;
    // Facade
    ctx.fillStyle = color;
    ctx.fillRect(x, top, w, h);
    // Slightly darker facade shadow on right edge
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.fillRect(x + w - w * 0.06, top, w * 0.06, h);
    // Pointed roof
    ctx.fillStyle = "#2d1a18";
    ctx.beginPath();
    ctx.moveTo(x - 1, top + 1);
    ctx.lineTo(x + w / 2, top - h * 0.22);
    ctx.lineTo(x + w + 1, top + 1);
    ctx.closePath();
    ctx.fill();
    // Tiny chimney
    ctx.fillRect(x + w * 0.65, top - h * 0.18, w * 0.07, h * 0.14);
    // Windows (warm yellow)
    ctx.fillStyle = "rgba(255, 220, 140, 0.85)";
    const cols = 2;
    const rows = Math.max(2, Math.floor(h / (w * 0.5)));
    const winW = w * 0.22;
    const winH = Math.min(h * 0.14, w * 0.22);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = x + w * (0.18 + c * 0.42);
        const wy = top + h * 0.12 + r * h * 0.22;
        if (wy + winH > baseY - h * 0.18) continue;
        ctx.fillRect(wx, wy, winW, winH);
        // cross frame
        ctx.fillStyle = "rgba(80, 50, 30, 0.7)";
        ctx.fillRect(wx + winW / 2 - 0.5, wy, 1, winH);
        ctx.fillRect(wx, wy + winH / 2 - 0.5, winW, 1);
        ctx.fillStyle = "rgba(255, 220, 140, 0.85)";
      }
    }
    // Door at the bottom centre
    ctx.fillStyle = "#3a1b14";
    ctx.fillRect(x + w * 0.42, top + h * 0.78, w * 0.16, h * 0.22);
  }

  // Børsen — distinctive dragon spire (4 dragons' tails twisted).
  function drawDragonSpire(x, baseY, w, u) {
    const baseH = u * 0.30;
    const spireH = u * 0.55;
    const top = baseY - baseH;

    // Sandstone base
    const grad = ctx.createLinearGradient(x, top, x, baseY);
    grad.addColorStop(0, "#e0c08c");
    grad.addColorStop(1, "#b89a68");
    ctx.fillStyle = grad;
    ctx.fillRect(x, top, w, baseH);
    // Roof of base
    ctx.fillStyle = "#7a5538";
    ctx.beginPath();
    ctx.moveTo(x - 2, top);
    ctx.lineTo(x + w / 2, top - baseH * 0.22);
    ctx.lineTo(x + w + 2, top);
    ctx.closePath();
    ctx.fill();
    // Windows on base
    ctx.fillStyle = "rgba(255, 220, 140, 0.7)";
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.fillRect(x + w * (0.18 + c * 0.28), top + baseH * (0.2 + r * 0.22), w * 0.12, baseH * 0.12);
      }
    }

    // Twisted spire — sinusoidal silhouette
    const spireBase = top - baseH * 0.22;
    const spireTop  = spireBase - spireH;
    ctx.fillStyle = "#a8835a";
    ctx.beginPath();
    const segments = 30;
    let prevX = x + w / 2 - 2;
    ctx.moveTo(prevX, spireBase);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const yy = spireBase + (spireTop - spireBase) * t;
      const taper = (1 - t) * w * 0.16 + 2;
      const wobble = Math.sin(t * Math.PI * 6) * w * 0.08 * (1 - t * 0.6);
      ctx.lineTo(x + w / 2 + wobble - taper, yy);
    }
    for (let i = segments; i >= 0; i--) {
      const t = i / segments;
      const yy = spireBase + (spireTop - spireBase) * t;
      const taper = (1 - t) * w * 0.16 + 2;
      const wobble = Math.sin(t * Math.PI * 6) * w * 0.08 * (1 - t * 0.6);
      ctx.lineTo(x + w / 2 + wobble + taper, yy);
    }
    ctx.closePath();
    ctx.fill();

    // Crown at the tip
    ctx.fillStyle = "#daa520";
    ctx.fillRect(x + w * 0.45, spireTop - 3, w * 0.1, 4);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.45, spireTop - 3);
    ctx.lineTo(x + w * 0.50, spireTop - u * 0.04);
    ctx.lineTo(x + w * 0.55, spireTop - 3);
    ctx.closePath();
    ctx.fill();
  }

  // Christiansborg tower — tall stone tower with copper-green spire + crown.
  function drawChristiansborg(x, baseY, w, u) {
    const h = u * 0.62;
    const top = baseY - h;

    // Tower body
    const grad = ctx.createLinearGradient(x, top, x, baseY);
    grad.addColorStop(0, "#cfc3a8");
    grad.addColorStop(1, "#9c8d70");
    ctx.fillStyle = grad;
    ctx.fillRect(x + w * 0.18, top, w * 0.64, h);

    // Lower wing
    ctx.fillStyle = "#9c8d70";
    ctx.fillRect(x, baseY - h * 0.45, w, h * 0.45);

    // Windows
    ctx.fillStyle = "rgba(255, 220, 140, 0.7)";
    for (let r = 0; r < 5; r++) {
      ctx.fillRect(x + w * 0.30, top + h * (0.15 + r * 0.15), w * 0.10, h * 0.06);
      ctx.fillRect(x + w * 0.60, top + h * (0.15 + r * 0.15), w * 0.10, h * 0.06);
    }

    // Copper-green spire at top
    const spireH = h * 0.35;
    const sx = x + w * 0.5;
    ctx.fillStyle = "#5c8c75";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.30, top);
    ctx.lineTo(x + w * 0.70, top);
    ctx.lineTo(sx, top - spireH);
    ctx.closePath();
    ctx.fill();

    // Crown on top
    ctx.fillStyle = "#daa520";
    ctx.beginPath();
    ctx.arc(sx, top - spireH, w * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rundetårn — cylindrical red brick with white conical hat + observation deck.
  function drawRundetaarn(x, baseY, w, u) {
    const h = u * 0.52;
    const top = baseY - h;

    // Cylinder body
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0,    "#7a3a28");
    grad.addColorStop(0.5,  "#a04c34");
    grad.addColorStop(1,    "#6a3220");
    ctx.fillStyle = grad;
    ctx.fillRect(x, top + h * 0.08, w, h * 0.92);

    // Top observation deck
    ctx.fillStyle = "#d8c8a8";
    ctx.fillRect(x - w * 0.08, top + h * 0.04, w * 1.16, h * 0.08);

    // Conical hat
    ctx.fillStyle = "#e8e0c8";
    ctx.beginPath();
    ctx.moveTo(x - w * 0.08, top + h * 0.04);
    ctx.lineTo(x + w / 2, top - h * 0.15);
    ctx.lineTo(x + w * 1.08, top + h * 0.04);
    ctx.closePath();
    ctx.fill();

    // Hat trim
    ctx.fillStyle = "#a08c64";
    ctx.fillRect(x - w * 0.08, top + h * 0.02, w * 1.16, 3);

    // Small windows on the cylinder
    ctx.fillStyle = "rgba(255, 220, 140, 0.7)";
    for (let r = 0; r < 4; r++) {
      ctx.beginPath();
      ctx.arc(x + w * 0.3, top + h * (0.25 + r * 0.18), w * 0.06, 0, Math.PI * 2);
      ctx.arc(x + w * 0.7, top + h * (0.25 + r * 0.18), w * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Marble Church — huge green-copper dome with columned drum.
  function drawMarbleChurch(x, baseY, w, u) {
    const drumH = u * 0.18;
    const drumY = baseY - drumH;

    // Drum (column base)
    ctx.fillStyle = "#e5dccb";
    ctx.fillRect(x + w * 0.05, drumY, w * 0.9, drumH);
    // Columns
    ctx.strokeStyle = "rgba(80, 60, 40, 0.45)";
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(x + w * (0.05 + (0.9 * i / 8)), drumY);
      ctx.lineTo(x + w * (0.05 + (0.9 * i / 8)), drumY + drumH);
      ctx.stroke();
    }
    // Frieze
    ctx.fillStyle = "rgba(80, 60, 40, 0.3)";
    ctx.fillRect(x + w * 0.05, drumY, w * 0.9, drumH * 0.1);

    // Dome — large green copper
    const domeR = w * 0.42;
    const domeCx = x + w / 2;
    const domeCy = drumY;
    const domeGrad = ctx.createRadialGradient(domeCx - domeR * 0.3, domeCy - domeR * 0.3, domeR * 0.2, domeCx, domeCy, domeR);
    domeGrad.addColorStop(0, "#a8d4b8");
    domeGrad.addColorStop(0.6, "#6ea088");
    domeGrad.addColorStop(1, "#3a6e5a");
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.arc(domeCx, domeCy, domeR, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Lantern + cross on top
    const lanY = domeCy - domeR - u * 0.04;
    ctx.fillStyle = "#e5dccb";
    ctx.fillRect(domeCx - w * 0.04, lanY, w * 0.08, u * 0.04);
    ctx.fillStyle = "#daa520";
    ctx.fillRect(domeCx - 1, lanY - u * 0.05, 2, u * 0.05);
    ctx.fillRect(domeCx - u * 0.012, lanY - u * 0.035, u * 0.024, 2);
  }

  // City Hall tower — tall red brick rectangle with clock.
  function drawCityHall(x, baseY, w, u) {
    const h = u * 0.70;
    const top = baseY - h;
    const tw = w * 0.55;
    const tx = x + (w - tw) / 2;

    // Lower main building
    ctx.fillStyle = "#7a3422";
    ctx.fillRect(x, baseY - h * 0.35, w, h * 0.35);

    // Tower body
    const grad = ctx.createLinearGradient(tx, top, tx + tw, top);
    grad.addColorStop(0,   "#7a3422");
    grad.addColorStop(0.5, "#9c4530");
    grad.addColorStop(1,   "#6a2c1c");
    ctx.fillStyle = grad;
    ctx.fillRect(tx, top, tw, h);

    // Clock face
    const clockCx = tx + tw / 2;
    const clockCy = top + h * 0.30;
    const clockR  = tw * 0.30;
    ctx.fillStyle = "#f3d96a";
    ctx.beginPath();
    ctx.arc(clockCx, clockCy, clockR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Hands
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(clockCx, clockCy);
    ctx.lineTo(clockCx + clockR * 0.6, clockCy);
    ctx.moveTo(clockCx, clockCy);
    ctx.lineTo(clockCx, clockCy - clockR * 0.8);
    ctx.stroke();

    // Pyramid roof
    ctx.fillStyle = "#2d2218";
    ctx.beginPath();
    ctx.moveTo(tx - 2, top);
    ctx.lineTo(tx + tw / 2, top - tw * 0.55);
    ctx.lineTo(tx + tw + 2, top);
    ctx.closePath();
    ctx.fill();

    // Wing windows
    ctx.fillStyle = "rgba(255, 220, 140, 0.65)";
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 6; c++) {
        ctx.fillRect(x + w * (0.05 + c * 0.15), baseY - h * 0.3 + r * h * 0.12, w * 0.08, h * 0.06);
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
    HUD.innerHTML = `<span class="truck">🚒</span> ${remaining} ${word} <span class="bubble">🫧</span>`;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Utils
  // ───────────────────────────────────────────────────────────────────────
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function haptic(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {} }
})();
