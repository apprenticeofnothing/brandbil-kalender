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
    document.querySelectorAll(".day.no-animate").forEach((el) =>
      el.classList.remove("no-animate")
    );
  }));
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

// ── Shared "pop a shower of fire-trucks at this point" helper ────────────
let _popCount = 0;
function popTrucks(originX, originY, count = 5) {
  if (prefersReducedMotion()) return;
  // Cap concurrent trucks to avoid runaway DOM.
  if (_popCount > 30) return;
  for (let i = 0; i < count; i++) {
    const truck = document.createElement("div");
    truck.className = "pop-truck";
    truck.textContent = "🚒";
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
  return n === 1 ? "1 dag tilbage" : `${n} dage tilbage`;
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
  const txt = HEADER_OVERRIDES[unchecked] ?? pluralDays(unchecked);
  // Always include the "driving" truck unless the override already has one.
  if (/🚒|🎉/.test(txt)) return txt;
  return `${txt} <span class="truck">🚒</span>`;
}

// Format a time-to-trigger duration as Danish text.
//   > 1 hour  → "stempler om 4t 23m"
//   < 1 hour  → "stempler om 47m"
//   < 1 min   → "stempler om 38s"
function formatTimeUntilStamp(msUntil) {
  if (msUntil <= 0) return "stempler nu …";
  const totalSeconds = Math.floor(msUntil / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `stempler om ${h}t ${m}m`;
  if (m > 0) return `stempler om ${m}m`;
  return `stempler om ${s}s`;
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

  // Update tiles.
  const tiles = document.querySelectorAll(".day");
  let unchecked = 0;
  tiles.forEach((tile) => {
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
  freshlyStamped.forEach(fanfare);
  _prevChecked = currChecked;
}

function fanfare(tile) {
  // 1. Bouncy stamp animation (extra punch on top of the regular flip).
  tile.classList.remove("fresh-stamp");
  void tile.offsetWidth;
  tile.classList.add("fresh-stamp");
  setTimeout(() => tile.classList.remove("fresh-stamp"), 750);

  // 2. Mini fire-truck shower from the stamp's centre.
  const stamp = tile.querySelector(".stamp");
  if (stamp) {
    const c = elementCentre(stamp);
    popTrucks(c.x, c.y, 10);
  }

  // 3. Soft red full-screen flash.
  const flash = document.createElement("div");
  flash.className = "stamp-flash";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 750);

  // 4. Heaviest haptic.
  tap("heavy");
}

// Custom pull-to-refresh: drag a fire-truck down from the top of the page;
// release past threshold triggers a real reload (full intro replays).
function setupPullToRefresh() {
  if (prefersReducedMotion()) return;

  const truck = document.createElement("div");
  truck.className = "pull-truck";
  truck.textContent = "🚒";
  truck.setAttribute("aria-hidden", "true");
  document.body.appendChild(truck);

  const THRESHOLD = 100;
  const MAX_PULL = 160;
  let startY = 0;
  let pullDistance = 0;
  let pulling = false;
  let triggered = false;

  function setTruck(y, rotation = 0) {
    // Truck is positioned at top: -50px; translateY moves it down.
    truck.style.transform = `translate(-50%, ${y + 50}px) rotate(${rotation}deg)`;
  }

  function onTouchStart(e) {
    if (window.scrollY > 0) return;
    if (triggered) return;
    startY = e.touches[0].clientY;
    pulling = true;
    pullDistance = 0;
    truck.classList.remove("snap-back", "driving-off");
  }

  function onTouchMove(e) {
    if (!pulling || triggered) return;
    pullDistance = Math.max(0, e.touches[0].clientY - startY);
    if (pullDistance > 0 && window.scrollY === 0) {
      // Prevent default vertical bounce so our truck moves smoothly.
      // (Only when we're actually pulling at the top.)
      if (pullDistance > 8) e.preventDefault();
    }
    const visualY = Math.min(pullDistance, MAX_PULL);
    if (visualY > 6) truck.classList.add("visible");
    const rotation = (visualY / MAX_PULL) * 12;
    setTruck(visualY, rotation);
  }

  function onTouchEnd() {
    if (!pulling) return;
    pulling = false;
    if (pullDistance > THRESHOLD && !triggered) {
      // Drive truck off the bottom of the screen, then reload.
      triggered = true;
      tap("medium");
      truck.classList.add("driving-off");
      setTruck(window.innerHeight + 80, 18);
      setTimeout(() => location.reload(), 500);
    } else {
      // Snap back up.
      truck.classList.add("snap-back");
      setTruck(0, 0);
      setTimeout(() => truck.classList.remove("visible", "snap-back"), 360);
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
    popTrucks(x, y, 5);
    tap("light");

    // Long-press: keep emitting trucks at intervals until release.
    longPressTimer = setTimeout(() => {
      tap("medium");
      longPressInterval = setInterval(() => {
        const p = pointXY(lastEvent);
        popTrucks(p.x, p.y, 3);
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

// Tap-handler for the day list: today → peek + popover, checked → pop trucks.
function handleTileTap(e) {
  const tile = e.target.closest(".day");
  if (!tile) return;
  const stamp = tile.querySelector(".stamp");
  if (!stamp) return;
  const c = elementCentre(stamp);

  if (tile.classList.contains("checked")) {
    popTrucks(c.x, c.y, 5);
    tap("light");
    // Brief bounce on the stamp for tactile feedback.
    tile.classList.remove("tile-pop");
    void tile.offsetWidth; // restart animation
    tile.classList.add("tile-pop");
    setTimeout(() => tile.classList.remove("tile-pop"), 380);
    return;
  }

  if (tile.classList.contains("today")) {
    // Peek: brief door wiggle + popover.
    tile.classList.remove("peeking");
    void tile.offsetWidth;
    tile.classList.add("peeking");
    setTimeout(() => tile.classList.remove("peeking"), 620);

    const pop = document.createElement("div");
    pop.className = "peek-popover";
    pop.textContent = "POPPER VED MIDNAT 🚒";
    const r = stamp.getBoundingClientRect();
    pop.style.left = `${r.left + r.width / 2}px`;
    pop.style.top = `${r.top}px`;
    document.body.appendChild(pop);
    setTimeout(() => pop.remove(), 1700);
    tap("light");
  }
}

function init() {
  buildList();
  render();
  playIntro();
  scheduleNextRender();
  document.getElementById("dayList").addEventListener("click", handleTileTap);
  setupPhotoEasterEgg();
  setupPullToRefresh();
  // Also re-render when the page becomes visible again (e.g. after foregrounding the PWA).
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });
}

// Adaptive interval: tick every second in the final minute before midnight,
// every 15s in the last hour, otherwise every 30s.
function scheduleNextRender() {
  const now = Date.now();
  const nextTrigger = TRIGGERS.find((t) => t > now);
  const msUntil = nextTrigger ? nextTrigger - now : Infinity;
  let delay;
  if (msUntil <= 60 * 1000)        delay = 1000;
  else if (msUntil <= 60 * 60_000) delay = 15_000;
  else                              delay = 30_000;
  setTimeout(() => {
    render();
    scheduleNextRender();
  }, delay);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
