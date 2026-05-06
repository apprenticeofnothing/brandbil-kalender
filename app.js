// Brandbil Count Down Kalender
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
    const li = document.createElement("li");
    li.className = "day";
    li.dataset.index = String(i);
    li.dataset.day = String(day);

    const weekday = dayOfWeek(2026, 4, day);
    const isReunion = day === 24;

    li.innerHTML = `
      <div class="date">${day}.</div>
      <div class="meta">
        <div class="weekday">${weekday}</div>
        <div class="sub">${isReunion ? "Vi ses!" : "kl. 22:00"}</div>
      </div>
      <div class="stamp" aria-hidden="true">🚒</div>
    `;
    if (isReunion) li.classList.add("reunion");
    list.appendChild(li);
  }
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
  const big = document.getElementById("bigNumber");
  const label = document.getElementById("bigLabel");

  if (isReunion) {
    hero.classList.add("reunion");
    big.textContent = "🚒";
    label.innerHTML = "Vi ses i dag!";
  } else if (now >= NEXT_DAY_AFTER_REUNION_UTC) {
    // Past the whole window — keep something nice on screen.
    hero.classList.add("reunion");
    big.textContent = "🚒";
    label.innerHTML = "Det var det! 💛";
  } else {
    hero.classList.remove("reunion");
    big.textContent = String(unchecked);
    label.innerHTML = pluralDays(unchecked) + ` <span class="truck">🚒</span>`;
  }
}

function init() {
  buildList();
  render();
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
