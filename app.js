// Brandbil Countdown Kalender
// 19-day countdown from 6 May → 24 May 2026.
// A day "checks off" once Copenhagen local time passes 22:00 on that day.
// Both phones agree because every check is computed deterministically from Date.now().

// Each day's stamp lands at the END of that day = midnight (00:00 CEST of the next day).
// May 2026 is fully inside CEST (DST) in Europe/Copenhagen, so 00:00 CEST = 22:00 UTC the day before.
// So day X's trigger is Date.UTC(2026, 4, X, 22, 0, 0).
const FIRST_DAY = 5;
const LAST_DAY = 24;
const TRIGGERS = [];
for (let day = FIRST_DAY; day <= LAST_DAY; day++) {
  TRIGGERS.push(Date.UTC(2026, 4, day, 22, 0, 0)); // month 4 = May
}

const REUNION_DAY_UTC = Date.UTC(2026, 4, 24); // start of 24 May UTC
const NEXT_DAY_AFTER_REUNION_UTC = Date.UTC(2026, 4, 25);

const weekdayFmt = new Intl.DateTimeFormat("da-DK", {
  weekday: "long",
  timeZone: "Europe/Copenhagen",
});

function dayOfWeek(year, month0, day) {
  // Pick noon Copenhagen-ish (10:00 UTC) so the date is unambiguous everywhere.
  return weekdayFmt.format(new Date(Date.UTC(year, month0, day, 10, 0, 0)));
}

// Returns the calendar date in Europe/Copenhagen as {y, m, d}.
function copenhagenDate(now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const get = (t) => parts.find((p) => p.type === t).value;
  return { y: +get("year"), m: +get("month"), d: +get("day") };
}

function isReunionDayInCopenhagen(now = Date.now()) {
  const { y, m, d } = copenhagenDate(now);
  return y === 2026 && m === 5 && d === 24;
}

function buildList() {
  const list = document.getElementById("dayList");
  list.innerHTML = "";
  for (let i = 0; i < TRIGGERS.length; i++) {
    const day = FIRST_DAY + i;
    const daysLeft = LAST_DAY - day;
    const li = document.createElement("li");
    li.className = "day no-animate"; // suppress flip transition on first paint
    li.dataset.index = String(i);
    li.dataset.day = String(day);

    const weekday = dayOfWeek(2026, 4, day);
    const isReunion = day === LAST_DAY;

    li.innerHTML = `
      <div class="date">${daysLeft}.</div>
      <div class="meta">
        <div class="weekday">${weekday}</div>
        <div class="sub">${day}. maj</div>
      </div>
      <div class="stamp" aria-hidden="true">
        <div class="stamp-flip">
          <div class="stamp-front">🚒</div>
          <div class="stamp-back">🚒</div>
        </div>
      </div>
    `;
    if (isReunion) li.classList.add("reunion");
    list.appendChild(li);
  }
  // Remove no-animate after the first paint so subsequent transitions animate.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll(".day.no-animate, .grid-cell.no-animate").forEach((el) =>
      el.classList.remove("no-animate")
    );
  }));
}

// Build the calendar-grid view (Mon→Sun rows). May 5 2026 is a Tuesday, so
// we prepend ONE empty cell before May 5; total 21 cells in 3 rows of 7.
function buildGrid() {
  const cells = document.getElementById("gridCells");
  if (!cells) return;
  cells.innerHTML = "";

  // Compute Monday-based weekday for May 5 2026: Tue → 1 leading blank.
  // (Pre-computed since the date range is fixed.)
  const LEADING_BLANKS = 1;

  for (let b = 0; b < LEADING_BLANKS; b++) {
    const blank = document.createElement("div");
    blank.className = "grid-cell empty";
    cells.appendChild(blank);
  }

  for (let i = 0; i < TRIGGERS.length; i++) {
    const day = FIRST_DAY + i;
    const cell = document.createElement("div");
    cell.className = "grid-cell no-animate";
    cell.dataset.index = String(i);
    cell.dataset.day = String(day);
    cell.innerHTML = `
      <div class="grid-flip">
        <div class="grid-front">🚒</div>
        <div class="grid-back">🚒</div>
      </div>
    `;
    cells.appendChild(cell);
  }
}

// View-toggle (Liste / Kalender) with localStorage persistence.
function setupViewToggle() {
  const toggle = document.getElementById("viewToggle");
  if (!toggle) return;
  const KEY = "brandbil-view";
  const params = new URLSearchParams(location.search);
  const urlView = params.get("view");
  const saved = (() => { try { return localStorage.getItem(KEY); } catch (_) { return null; } })();
  // Default = grid (Kalender). Liste is the secondary opt-in.
  applyView((urlView === "table" || (urlView !== "grid" && saved === "table")) ? "table" : "grid");

  toggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".view-pill");
    if (!btn) return;
    const view = btn.dataset.view;
    applyView(view);
    try { localStorage.setItem(KEY, view); } catch (_) {}
    tap("light");
  });

  function applyView(view) {
    document.body.classList.toggle("view-grid", view === "grid");
    toggle.querySelectorAll(".view-pill").forEach((p) => {
      p.classList.toggle("active", p.dataset.view === view);
    });
  }
}

function rainFireTrucks() {
  if (document.hidden) return;
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);

  const COUNT = 36;
  let maxEnd = 0;
  for (let i = 0; i < COUNT; i++) {
    const t = document.createElement("div");
    t.className = "confetti-truck";
    t.textContent = "🚒";
    t.style.left = (Math.random() * 100).toFixed(2) + "vw";
    t.style.fontSize = (28 + Math.random() * 28).toFixed(0) + "px";
    const delay = Math.random() * 4.5;
    const dur = 3.5 + Math.random() * 1.5;
    t.style.animationDelay = delay.toFixed(2) + "s";
    t.style.animationDuration = dur.toFixed(2) + "s";
    t.style.setProperty("--rot-start", (Math.random() * 360 - 180).toFixed(0) + "deg");
    t.style.setProperty("--rot-end", (Math.random() * 720 - 360).toFixed(0) + "deg");
    t.style.setProperty("--drift", (Math.random() * 80 - 40).toFixed(0) + "px");
    layer.appendChild(t);
    maxEnd = Math.max(maxEnd, delay + dur);
  }

  setTimeout(() => layer.remove(), (maxEnd + 0.2) * 1000);
}

function prefersReducedMotion() {
  return window.matchMedia &&
         window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ── Haptics (best-effort; iOS support is spotty) ─────────────────────────
function tap(intensity) {
  const ms = { light: 12, medium: 30, heavy: 60 }[intensity] ?? 12;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
}

// ── Shared "pop a shower of an emoji at this point" helper ───────────────
let _popCount = 0;
function popEmojis(originX, originY, count = 5, emoji = "🚒") {
  if (prefersReducedMotion()) return;
  // Cap concurrent items to avoid runaway DOM.
  if (_popCount > 30) return;
  for (let i = 0; i < count; i++) {
    const truck = document.createElement("div");
    truck.className = "pop-truck";
    truck.textContent = emoji;
    // Random angle in the upper hemisphere (mostly upward).
    const angle = (-Math.PI / 2) + ((Math.random() - 0.5) * (Math.PI * 0.9));
    const distance = 60 + Math.random() * 80; // 60–140px
    const midDx = Math.cos(angle) * distance * 0.5;
    const midDy = Math.sin(angle) * distance * 0.5;
    const endDx = Math.cos(angle) * distance + (Math.random() - 0.5) * 20;
    const endDy = Math.sin(angle) * distance + 60 + Math.random() * 40; // gravity drop
    const midRot = (Math.random() - 0.5) * 60;
    const endRot = (Math.random() - 0.5) * 360;
    truck.style.setProperty("--start-x", `${originX}px`);
    truck.style.setProperty("--start-y", `${originY}px`);
    truck.style.setProperty("--mid-dx", `${midDx}px`);
    truck.style.setProperty("--mid-dy", `${midDy}px`);
    truck.style.setProperty("--end-dx", `${endDx}px`);
    truck.style.setProperty("--end-dy", `${endDy}px`);
    truck.style.setProperty("--mid-rot", `${midRot}deg`);
    truck.style.setProperty("--end-rot", `${endRot}deg`);
    truck.style.fontSize = `${22 + Math.random() * 16}px`;
    document.body.appendChild(truck);
    _popCount++;
    truck.addEventListener("animationend", () => {
      truck.remove();
      _popCount--;
    }, { once: true });
  }
}

// Get the centre point (in viewport coords) of an element.
function elementCentre(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function playIntro() {
  if (document.hidden) return;
  if (prefersReducedMotion()) return;

  // Stage A: hide the whole calendar behind the dark-red curtain.
  document.body.classList.add("intro-stage-a");

  // Layer 1 — solid dark-red curtain
  const bg = document.createElement("div");
  bg.className = "intro-bg";
  bg.setAttribute("aria-hidden", "true");
  document.body.appendChild(bg);

  // Layer 2 — confetti (raised z-index so it's between bg and stage)
  rainFireTrucks();

  // Layer 3 — cheese + "EN CHEESY-AS-FUCK" above + "COUNTDOWN KALENDER" below
  const stage = document.createElement("div");
  stage.className = "intro-stage";
  stage.setAttribute("aria-hidden", "true");
  stage.innerHTML = `
    <div class="intro-stage-inner">
      <svg class="intro-curve top" viewBox="0 0 560 130" preserveAspectRatio="xMidYMid meet">
        <defs>
          <path id="curveTop" d="M 30,118 Q 280,4 530,118" fill="none"/>
        </defs>
        <text text-anchor="middle">
          <textPath href="#curveTop" startOffset="50%">EN CHEESY-AS-FUCK</textPath>
        </text>
      </svg>
      <div class="intro-cheese" aria-hidden="true">🧀</div>
      <svg class="intro-curve bottom" viewBox="0 0 560 130" preserveAspectRatio="xMidYMid meet">
        <defs>
          <path id="curveBottom" d="M 30,12 Q 280,126 530,12" fill="none"/>
        </defs>
        <text text-anchor="middle">
          <textPath href="#curveBottom" startOffset="50%">COUNTDOWN KALENDER</textPath>
        </text>
      </svg>
    </div>
  `;
  document.body.appendChild(stage);

  // 4.5s — Stage A fade-out: cheese stage fades (curtain stays up; calendar still hidden)
  setTimeout(() => {
    stage.classList.add("fade-out");
  }, 4500);

  // 5.8s — Stage B begins: 700ms blank-curtain pause has elapsed.
  //        Curtain starts fading (1.0s) and body class flips so photo + bridge fade in (1.0s).
  setTimeout(() => {
    document.body.classList.replace("intro-stage-a", "intro-stage-b");
    bg.classList.add("fade-out");
    stage.remove(); // cheese stage is fully gone by now
  }, 5800);

  // 6.9s — curtain fully transparent, remove from DOM
  setTimeout(() => {
    bg.remove();
  }, 6900);

  // 8.3s — Stage B → Stage C: bridge fades out, rest of calendar fades in (1.0s each)
  setTimeout(() => {
    document.body.classList.remove("intro-stage-b");
  }, 8300);
}

function pluralDays(n) {
  // Number is shown via the big-number outline in the photo circle, so the
  // sub-line just reads "dag tilbage" / "dage tilbage" below it.
  return n === 1 ? "dag tilbage" : "dage tilbage";
}

// Personalised header copy at milestone counts. Edit freely.
const HEADER_OVERRIDES = {
  14: "Næsten halvvejs 🚒",
  10: "10 dage tilbage 💛",
  7:  "Kun en uge! 🚒",
  5:  "Bare 5 dage tilbage 💕",
  3:  "Næsten der 🚒🚒",
  2:  "I overmorgen! 🎉",
  1:  "I morgen 💛🚒",
};
function headerCopy(unchecked) {
  // Strip any 🚒 from override text — we always frame with our own animated trucks.
  let txt = HEADER_OVERRIDES[unchecked] ?? pluralDays(unchecked);
  txt = txt.replace(/\s*🚒\s*/g, " ").trim();
  return `<span class="truck">🚒</span> ${txt} <span class="truck mirror">🚒</span>`;
}

// Format a time-to-trigger duration as Danish text — bare units, live seconds.
//   "5t 51m 23s"
function formatTimeUntilStamp(msUntil) {
  if (msUntil <= 0) return "0t 0m 0s";
  const totalSeconds = Math.floor(msUntil / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}t ${m}m ${s}s`;
}

// Pulse duration scaled to time-until-trigger (in ms). Calmer when far,
// frantic in the last 10 minutes.
function pulseDurationFor(msUntil) {
  const TEN_MIN = 10 * 60 * 1000;
  if (msUntil <= 0) return "0.45s";
  if (msUntil <= 60 * 1000) return "0.5s";          // last minute
  if (msUntil <= TEN_MIN)   return "0.7s";          // last 10 min
  if (msUntil <= 60 * 60 * 1000) return "1.1s";     // last hour
  return "1.6s";
}

// Stamp-event detector: which indices were checked last render? Diff against
// current to find indices that just transitioned unchecked → checked, so we
// can fire the midnight fanfare exactly once per stamp.
let _prevChecked = null; // null = first render (skip fanfare)

function render() {
  const params = new URLSearchParams(location.search);
  const override = params.get("simulate");
  const now = override ? new Date(override).getTime() : Date.now();
  const today = copenhagenDate(now);
  const isReunion = isReunionDayInCopenhagen(now);

  const TEN_MIN = 10 * 60 * 1000;

  const currChecked = new Set();
  const freshlyStamped = [];

  // Update both views in lockstep (table .day and grid .grid-cell).
  const tableTiles = document.querySelectorAll(".day");
  const gridCells  = document.querySelectorAll(".grid-cell:not(.empty)");
  let unchecked = 0;

  tableTiles.forEach((tile) => {
    const i = +tile.dataset.index;
    const day = +tile.dataset.day;
    const checked = now >= TRIGGERS[i];
    if (checked) currChecked.add(i);
    if (_prevChecked && checked && !_prevChecked.has(i)) freshlyStamped.push(tile);
    tile.classList.toggle("checked", checked);
    if (!checked) unchecked++;

    const isToday =
      today.y === 2026 && today.m === 5 && today.d === day;
    tile.classList.toggle("today", isToday);

    // Today-only enhancements: live countdown, pulse rate, tonight-mode.
    if (isToday && !checked) {
      const msUntil = TRIGGERS[i] - now;
      const sub = tile.querySelector(".sub");
      if (sub) sub.textContent = formatTimeUntilStamp(msUntil);
      tile.style.setProperty("--pulse-duration", pulseDurationFor(msUntil));
      tile.classList.toggle("tile-imminent", msUntil > 0 && msUntil <= TEN_MIN);
    } else {
      // Restore the date sub if a previous render had set it to a countdown.
      const sub = tile.querySelector(".sub");
      if (sub) sub.textContent = `${day}. maj`;
      tile.style.removeProperty("--pulse-duration");
      tile.classList.remove("tile-imminent");
    }
  });

  // Grid view mirrors the same state. Don't double-fire fanfare — that's
  // handled on the table tile then we ALSO play it on the grid cell here.
  gridCells.forEach((cell) => {
    const i = +cell.dataset.index;
    const day = +cell.dataset.day;
    const checked = now >= TRIGGERS[i];
    cell.classList.toggle("checked", checked);
    const isToday = today.y === 2026 && today.m === 5 && today.d === day;
    cell.classList.toggle("today", isToday);
    if (isToday && !checked) {
      const msUntil = TRIGGERS[i] - now;
      cell.style.setProperty("--pulse-duration", pulseDurationFor(msUntil));
      cell.classList.toggle("tile-imminent", msUntil > 0 && msUntil <= TEN_MIN);
    } else {
      cell.style.removeProperty("--pulse-duration");
      cell.classList.remove("tile-imminent");
    }
  });

  // Update header.
  const hero = document.querySelector(".hero");
  const bigText = document.querySelector("#bigNumber .big-number-svg text");
  const label = document.getElementById("bigLabel");

  if (isReunion) {
    hero.classList.add("reunion");
    label.innerHTML = "Vi ses i dag!";
  } else if (now >= NEXT_DAY_AFTER_REUNION_UTC) {
    // Past the whole window — keep something nice on screen.
    hero.classList.add("reunion");
    label.innerHTML = "Det var det! 💛";
  } else {
    hero.classList.remove("reunion");
    bigText.textContent = String(unchecked);
    label.innerHTML = headerCopy(unchecked);
  }

  // Fire midnight fanfare for any tiles that just transitioned to checked.
  freshlyStamped.forEach((tile) => {
    fanfare(tile);
    // Also kick the matching grid cell.
    const i = tile.dataset.index;
    const cell = document.querySelector(`.grid-cell[data-index="${i}"]`);
    if (cell) bounceFlip(cell);
  });
  _prevChecked = currChecked;
}

function bounceFlip(el) {
  el.classList.remove("fresh-stamp");
  void el.offsetWidth;
  el.classList.add("fresh-stamp");
  setTimeout(() => el.classList.remove("fresh-stamp"), 750);
}

function fanfare(tile) {
  // 1. Bouncy stamp animation (extra punch on top of the regular flip).
  bounceFlip(tile);

  // 2. Mini fire-truck shower from the stamp's centre.
  const stamp = tile.querySelector(".stamp") || tile;
  const c = elementCentre(stamp);
  popEmojis(c.x, c.y, 10);

  // 3. Soft red full-screen flash.
  const flash = document.createElement("div");
  flash.className = "stamp-flash";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 750);

  // 4. Heaviest haptic.
  tap("heavy");
}

// Custom pull-to-refresh: dark overlay + page fade + big truck + comic text;
// release past threshold triggers a real reload (full intro replays).
function setupPullToRefresh() {
  if (prefersReducedMotion()) return;

  const overlay = document.createElement("div");
  overlay.className = "pull-overlay";
  overlay.setAttribute("aria-hidden", "true");
  document.body.appendChild(overlay);

  const stage = document.createElement("div");
  stage.className = "pull-stage";
  stage.setAttribute("aria-hidden", "true");
  stage.innerHTML = `
    <div class="pull-text">RE-FRESH FOR ANOTHER<br>ROUND OF CHEESY INTRO</div>
    <div class="pull-truck">🚒</div>
  `;
  document.body.appendChild(stage);

  const main = document.querySelector("main");

  const THRESHOLD = 100;
  const MAX_PULL = 220;
  let startY = 0;
  let pullDistance = 0;
  let pulling = false;
  let triggered = false;

  function setStage(y, rotation = 0) {
    stage.style.transform = `translate(-50%, ${y + 180}px) rotate(${rotation}deg)`;
  }

  function setOpacity(progress) {
    const eased = Math.min(1, progress);
    overlay.style.opacity = (eased * 0.92).toFixed(3);
    if (main) main.style.opacity = (1 - eased * 0.7).toFixed(3);
  }

  function reset() {
    stage.classList.remove("visible", "snap-back", "driving-off");
    overlay.classList.remove("snap-back", "driving-off");
    stage.style.transform = "";
    overlay.style.opacity = "";
    if (main) main.style.opacity = "";
  }

  function onTouchStart(e) {
    if (window.scrollY > 0) return;
    if (triggered) return;
    startY = e.touches[0].clientY;
    pulling = true;
    pullDistance = 0;
    stage.classList.remove("snap-back", "driving-off");
    overlay.classList.remove("snap-back", "driving-off");
  }

  function onTouchMove(e) {
    if (!pulling || triggered) return;
    pullDistance = Math.max(0, e.touches[0].clientY - startY);
    if (pullDistance > 0 && window.scrollY === 0 && pullDistance > 8) {
      e.preventDefault();
    }
    const visualY = Math.min(pullDistance, MAX_PULL);
    if (visualY > 6) stage.classList.add("visible");
    const rotation = (visualY / MAX_PULL) * 8;
    setStage(visualY, rotation);
    setOpacity(visualY / THRESHOLD);
  }

  function onTouchEnd() {
    if (!pulling) return;
    pulling = false;
    if (pullDistance > THRESHOLD && !triggered) {
      triggered = true;
      tap("medium");
      stage.classList.add("driving-off");
      overlay.classList.add("driving-off");
      setStage(window.innerHeight + 200, 16);
      setOpacity(1);
      setTimeout(() => location.reload(), 500);
    } else {
      stage.classList.add("snap-back");
      overlay.classList.add("snap-back");
      setStage(0, 0);
      setOpacity(0);
      setTimeout(reset, 380);
    }
    pullDistance = 0;
  }

  document.addEventListener("touchstart", onTouchStart, { passive: true });
  document.addEventListener("touchmove",  onTouchMove,  { passive: false });
  document.addEventListener("touchend",   onTouchEnd);
  document.addEventListener("touchcancel", onTouchEnd);
}

// Photo Easter egg: tap squishes + pops trucks; long-press emits trucks until release.
function setupPhotoEasterEgg() {
  const circle = document.getElementById("heroCircle");
  if (!circle) return;

  let longPressTimer = null;
  let longPressInterval = null;
  let lastEvent = null;

  function pointXY(ev) {
    const e = ev.touches?.[0] ?? ev.changedTouches?.[0] ?? ev;
    return { x: e.clientX, y: e.clientY };
  }

  function startTap(ev) {
    lastEvent = ev;
    const { x, y } = pointXY(ev);
    circle.classList.remove("bouncing");
    void circle.offsetWidth;
    circle.classList.add("bouncing");
    popEmojis(x, y, 5, "🧀");
    tap("light");

    // Long-press: keep emitting cheese at intervals until release.
    longPressTimer = setTimeout(() => {
      tap("medium");
      longPressInterval = setInterval(() => {
        const p = pointXY(lastEvent);
        popEmojis(p.x, p.y, 3, "🧀");
      }, 200);
    }, 500);
  }

  function endTap() {
    clearTimeout(longPressTimer);
    clearInterval(longPressInterval);
    longPressTimer = null;
    longPressInterval = null;
  }

  function move(ev) { lastEvent = ev; }

  circle.addEventListener("pointerdown", startTap);
  circle.addEventListener("pointermove", move);
  circle.addEventListener("pointerup", endTap);
  circle.addEventListener("pointercancel", endTap);
  circle.addEventListener("pointerleave", endTap);
}

// Tap-handler for both views (table .day and grid .grid-cell). Today → peek
// + popover + bubble rain. Checked → fire-truck pop shower.
function handleTileTap(e) {
  const tile = e.target.closest(".day, .grid-cell");
  if (!tile || tile.classList.contains("empty")) return;
  const tileRect = tile.getBoundingClientRect();
  const tileCentre = { x: tileRect.left + tileRect.width / 2, y: tileRect.top + tileRect.height / 2 };

  if (tile.classList.contains("checked")) {
    popEmojis(tileCentre.x, tileCentre.y, 5);
    tap("light");
    tile.classList.remove("tile-pop");
    void tile.offsetWidth;
    tile.classList.add("tile-pop");
    setTimeout(() => tile.classList.remove("tile-pop"), 380);
    return;
  }

  if (tile.classList.contains("today")) {
    // Peek: brief door wiggle.
    tile.classList.remove("peeking");
    void tile.offsetWidth;
    tile.classList.add("peeking");
    setTimeout(() => tile.classList.remove("peeking"), 620);

    // Popover centred above the entire tile.
    const pop = document.createElement("div");
    pop.className = "peek-popover";
    pop.textContent = "POPPER VED MIDNAT 🚒";
    pop.style.left = `${tileCentre.x}px`;
    pop.style.top  = `${tileRect.top - 8}px`;
    document.body.appendChild(pop);
    setTimeout(() => pop.remove(), 1700);

    // Fire-truck bubble rain BEHIND the popover, lasting a touch longer.
    const interval = setInterval(() => {
      const r = tile.getBoundingClientRect();
      popEmojis(r.left + r.width / 2, r.top + 24, 3);
    }, 220);
    setTimeout(() => clearInterval(interval), 1900);

    tap("light");
  }
}

// Tap the "DAGE TILBAGE" label to launch the cheese-catching game.
function setupGameTrigger() {
  const label = document.getElementById("bigLabel");
  if (!label || typeof window.openCheeseGame !== "function") return;
  label.addEventListener("click", () => {
    const now = Date.now();
    const remaining = TRIGGERS.filter((t) => t > now).length;
    // No game on reunion day — nothing left to catch.
    if (remaining <= 0) {
      tap("light");
      return;
    }
    tap("medium");
    window.openCheeseGame(remaining);
  });
}

function init() {
  buildList();
  buildGrid();
  setupViewToggle();
  render();
  playIntro();
  scheduleNextRender();
  startCountdownTicker();
  document.getElementById("dayList").addEventListener("click", handleTileTap);
  document.getElementById("dayGrid").addEventListener("click", handleTileTap);
  setupPhotoEasterEgg();
  setupPullToRefresh();
  setupGameTrigger();
  // Also re-render when the page becomes visible again (e.g. after foregrounding the PWA).
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });
}

// Heavy render() runs on a slower cadence (full DOM walk).
function scheduleNextRender() {
  const now = Date.now();
  const nextTrigger = TRIGGERS.find((t) => t > now);
  const msUntil = nextTrigger ? nextTrigger - now : Infinity;
  let delay;
  if (msUntil <= 60 * 1000)        delay = 1000;   // last minute: catch the transition fast
  else if (msUntil <= 60 * 60_000) delay = 15_000;
  else                              delay = 30_000;
  setTimeout(() => {
    render();
    scheduleNextRender();
  }, delay);
}

// Lightweight 1 Hz ticker — only updates today's countdown text + pulse rate.
// Runs forever once started; bails when there's no today-tile or page is hidden.
function startCountdownTicker() {
  setInterval(() => {
    if (document.hidden) return;
    const now = Date.now();
    const todayTile = document.querySelector(".day.today:not(.checked)");
    if (!todayTile) return;
    const i = +todayTile.dataset.index;
    const msUntil = TRIGGERS[i] - now;
    if (msUntil <= 0) return; // render() will fire fanfare on the next tick
    const TEN_MIN = 10 * 60 * 1000;
    const sub = todayTile.querySelector(".sub");
    if (sub) sub.textContent = formatTimeUntilStamp(msUntil);
    todayTile.style.setProperty("--pulse-duration", pulseDurationFor(msUntil));
    todayTile.classList.toggle("tile-imminent", msUntil <= TEN_MIN);
    // Mirror onto the grid cell.
    const cell = document.querySelector(`.grid-cell[data-index="${i}"]`);
    if (cell) {
      cell.style.setProperty("--pulse-duration", pulseDurationFor(msUntil));
      cell.classList.toggle("tile-imminent", msUntil <= TEN_MIN);
    }
  }, 1000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
