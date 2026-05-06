// Brandbil Countdown Kalender
// 19-day countdown from 6 May → 24 May 2026.
// A day "checks off" once Copenhagen local time passes 22:00 on that day.
// Both phones agree because every check is computed deterministically from Date.now().

// May 2026 is fully inside CEST (DST) in Europe/Copenhagen, so 22:00 CEST = 20:00 UTC.
// Hard-coding UTC instants keeps this independent of the device's clock zone.
const FIRST_DAY = 5;
const LAST_DAY = 24;
const TRIGGERS = [];
for (let day = FIRST_DAY; day <= LAST_DAY; day++) {
  TRIGGERS.push(Date.UTC(2026, 4, day, 20, 0, 0)); // month 4 = May
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
    li.className = "day";
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
      <div class="stamp" aria-hidden="true">🚒</div>
    `;
    if (isReunion) li.classList.add("reunion");
    list.appendChild(li);
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
    const delay = Math.random() * 3.0;
    const dur = 3.0 + Math.random() * 1.5;
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

  // 4.5s — Stage A → Stage B: photo + bridge text appear, curtain + cheese fade
  setTimeout(() => {
    document.body.classList.replace("intro-stage-a", "intro-stage-b");
    bg.classList.add("fade-out");
    stage.classList.add("fade-out");
  }, 4500);

  // 5.3s — curtain + cheese stage fully gone, remove from DOM
  setTimeout(() => {
    bg.remove();
    stage.remove();
  }, 5300);

  // 6.5s — Stage B → Stage C: bridge fades out, rest of calendar fades in
  setTimeout(() => {
    document.body.classList.remove("intro-stage-b");
  }, 6500);
}

function pluralDays(n) {
  return n === 1 ? "1 dag tilbage" : `${n} dage tilbage`;
}

function render() {
  const params = new URLSearchParams(location.search);
  const override = params.get("simulate");
  const now = override ? new Date(override).getTime() : Date.now();
  const today = copenhagenDate(now);
  const isReunion = isReunionDayInCopenhagen(now);

  // Update tiles.
  const tiles = document.querySelectorAll(".day");
  let unchecked = 0;
  tiles.forEach((tile) => {
    const i = +tile.dataset.index;
    const day = +tile.dataset.day;
    const checked = now >= TRIGGERS[i];
    tile.classList.toggle("checked", checked);
    if (!checked) unchecked++;

    const isToday =
      today.y === 2026 && today.m === 5 && today.d === day;
    tile.classList.toggle("today", isToday);
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
    label.innerHTML = pluralDays(unchecked) + ` <span class="truck">🚒</span>`;
  }
}

function init() {
  buildList();
  render();
  playIntro();
  // Re-render every 60s so a tile flips when 22:00 passes while the page is open.
  setInterval(render, 60_000);
  // Also re-render when the page becomes visible again (e.g. after foregrounding the PWA).
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
