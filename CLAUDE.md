# Brandbil Countdown Kalender — Project Reference

A 20-day countdown calendar (5 May → 24 May 2026) sent to a friend so she can
add it to her iPhone home screen and watch the days check off automatically
with fire-trucks. Shipped as a static PWA on GitHub Pages.

**Live URL:** https://apprenticeofnothing.github.io/brandbil-kalender/

---

## Stack

Zero build, zero backend, zero framework. Just:

- `index.html` — markup, meta tags, hero, view-toggle, day list, day grid, footer
- `style.css` — every visual, animation, and responsive rule
- `app.js` — all logic (triggers, render, intro, taps, haptics, pull-to-refresh, view toggle)
- `manifest.webmanifest` — PWA install manifest
- `icon-180.png`, `icon-512.png` — home-screen icon
- `photo.jpg` — intro reveal photo (Stage B of intro)
- `photo-calendar.jpg` — calendar steady-state photo (Stage C onwards)

Plus one external dependency: **Bangers** loaded from Google Fonts.

Hosted on GitHub Pages from the `main` branch root. No CI; pushes to `main`
trigger a Pages rebuild that goes live in ~30–60 s.

---

## How the countdown works

20 hard-coded UTC instants in `TRIGGERS[]`, one per day at **00:00 Copenhagen
time** (= 22:00 UTC the day before, since May 2026 is fully inside CEST):

```js
for (let day = 5; day <= 24; day++) {
  TRIGGERS.push(Date.UTC(2026, 4, day, 22, 0, 0));
}
```

Each tile's checked state is computed deterministically from `Date.now() ≥ TRIGGERS[i]`.
Both phones therefore always agree without any sync or backend. Re-renders
happen on a slow cadence (15–30 s normally, 1 s in the final minute before a
trigger) plus a lightweight 1 Hz ticker that only updates today's countdown
text and pulse rate.

When a tile transitions unchecked → checked while the page is open, the
**fanfare** fires: tile bounces, a fire-truck shower bursts from the tile, a
soft red screen flash, and a heavy haptic. Detection is by diffing the current
checked-index set against the previous render's set, so it never re-fires for
already-stamped tiles on initial load.

---

## The intro animation

Plays once per fresh page load. Three stages, ~9.3 s total:

1. **Stage A (0–4.5 s)** — dark-red curtain over the calendar, 36 fire-trucks
   raining, then 🧀 grows from centre at 1.5 s with bouncy overshoot, then comic-styled
   "EN CHEESY-AS-FUCK" arcs in above and "COUNTDOWN KALENDER" arcs in below.
   Curved text is SVG `<textPath>` along quadratic Bézier paths.

2. **Stage B (4.5–6.5 s)** — Stage A fades out, 0.7 s of just confetti raining
   on the curtain, then the curtain fades and the **first photo** (`photo.jpg`)
   appears at the hero position with "TIL MIN SØDESTE VEN" below it.

3. **Stage C (8.3 s onwards)** — bridge text fades out, the **second photo**
   (`photo-calendar.jpg`) cross-fades in, and the rest of the calendar
   (title, big number, label, toggle, day list / grid, footer) fades in around it.

Driven by `body` classes `.intro-stage-a` / `.intro-stage-b` (no class = stage C
/ steady state). CSS transitions handle the fades. Reduced-motion users skip
the intro entirely.

---

## The calendar UI

### Two views (toggle persisted in localStorage)

- **Kalender (grid, default)** — classic 3-row Mon→Sun calendar grid showing
  only May 5 → 24. Cells contain just the fire-truck (full-colour = checked,
  ghost = future). Today pulses.
- **Liste (table)** — vertical scroll list. Each tile shows `[days-left]. /
  weekday / date` and a fire-truck stamp on the right.

Both views are rendered to the DOM at init; `body.view-grid` swaps which is
visible. Render writes state to *both* lists in lockstep so they stay in sync.

### Today's tile is special

- **Ghost fire-truck silhouette** (grayscale + opacity 0.35) that **pulses**.
  Pulse rate scales with time-to-midnight: 1.6 s when far, 1.1 s last hour,
  0.7 s last 10 min, 0.5 s last minute.
- **Live seconds countdown** in the sub-line: `I dag · 5t 35m 49s`, updated
  every second.
- **Tonight mode** in the final 10 minutes: solid red ring on the stamp,
  warm red wash, accent-red countdown text.

### Advent-door reveal

Every tile is a 3D flip-card: `.stamp-front` (ghost) on front, `.stamp-back`
(full firetruck) on the back. The `.checked` class triggers a `rotateY(180deg)`
transition that reveals the stamped truck. `firstRender` is guarded by a
`.no-animate` class so already-checked tiles on initial load don't flip
in front of the user.

### Interactive features

- **Tap today's tile** → door wiggles 50° and snaps back, "POPPER VED MIDNAT 🚒"
  popover floats up centred over the tile, fire-truck bubble rain behind the
  popover for ~1.9 s, light haptic.
- **Tap a checked tile** → 5 fire-truck emojis bobble out from the tap point
  with random direction + gravity, light haptic, tile gets a small bounce.
- **Tap the photo** → photo squish-bounces, 5 cheese emojis bobble out. A
  long-press streams them continuously, medium haptic on long-press start.
- **Pull to refresh** → dark gradient overlay washes in, `<main>` fades to 30 %
  opacity, a 64-px fire-truck follows the finger with comic-styled
  "RE-FRESH FOR ANOTHER ROUND OF CHEESY INTRO" above it. Past 100 px → drives
  off-screen + `location.reload()`. Native pull-to-refresh is suppressed via
  `overscroll-behavior-y: contain`.

All of the above use the shared `popEmojis(x, y, count, emoji)` helper and the
`tap(intensity)` haptic helper (`navigator.vibrate`, best-effort on iOS).

### Personalised header copy

`headerCopy(unchecked)` looks up milestone phrases (14: "Næsten halvvejs", 7:
"Kun en uge!", 1: "I morgen", etc.) and always brackets them with two
animated fire-trucks (the right one mirrored via `scaleX(-1)`). The big number
itself lives in the photo circle as an SVG outline.

---

## Visual language

- **Comic font**: Bangers, all caps, used for title, "DAGE TILBAGE", peek
  popover, pull-to-refresh text, intro headers, footer credit, and the big
  number overlay.
- **Outline treatment**: white fill + CI-red stroke (`paint-order: stroke fill`)
  for HTML, `stroke: var(--accent)` for SVG.
- **Accent red**: `--accent: #c8102e` (light) / `#ff5a4d` (dark).
- **Background**: deep maroon (`#14060a` dark, `#fff5f3` light) with a subtle
  warm radial gradient from the top.
- **Spacing**: tight enough that the entire grid-mode interface fits within
  the iPhone 13 mini viewport (812 px) without scrolling, while the title
  still clears the Dynamic Island via `env(safe-area-inset-top)`.

---

## Responsive sizing

Tested on iPhone 13 mini (375 × 812) and iPhone 16 (393 × 852). Most components
use `clamp(min, vw, max)` to scale. A `@media (max-width: 380px)` block tightens
padding and font sizes for mini.

---

## Cache busting

GitHub Pages serves `index.html` with `Cache-Control: max-age=600`. To force
iOS Safari (in PWA mode especially) to fetch fresh asset versions, all
referenced assets carry a `?v=N` query in `index.html`. **Bump that number
on every meaningful change** so the friend's phone picks up updates within
minutes instead of indefinitely.

Current version: `?v=14` (search `v=14` in `index.html` to bump).

---

## Deploy

```bash
cd ~/brandbil-kalender
# Edit. Bump v=N in index.html.
git add <files>
git commit -m "<message>"
git push "https://x-access-token:$(gh auth token)@github.com/apprenticeofnothing/brandbil-kalender.git" main
# Pages rebuilds in ~30–60 s.
```

Verification:

```bash
until curl -sS "https://apprenticeofnothing.github.io/brandbil-kalender/?bust=$(date +%s)" \
  | grep -q "v=N"; do sleep 5; echo "still rebuilding..."; done
```

---

## Local dev

```bash
cd ~/brandbil-kalender
python3 -m http.server 8765
# http://localhost:8765/
# Use ?simulate=2026-05-12T15:00:00Z to fast-forward the clock.
# Use ?view=grid or ?view=table to force a view for screenshots.
```

Visual verification via headless Chrome:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars \
  --window-size=393,852 --virtual-time-budget=10000 \
  --screenshot=out.png "http://localhost:8765/"
```

Note: headless Chrome doesn't fully respect mobile `meta viewport`, so layouts
look ~5–10 % wider than they will on a real iPhone. Real-phone verification
is the source of truth.

---

## Project conventions

- **No CSS framework**, no build step. Edit `style.css` directly.
- **Vanilla JS**, no bundler, no module system. Functions are top-level in
  `app.js`.
- **DOM is rendered to twice** for the two views — keep render parity in mind
  when adding new state.
- **Reduced motion**: respect `prefers-reduced-motion: reduce` for any new
  animation or particle effect. There's already a `prefersReducedMotion()`
  helper in `app.js`.
- **iOS quirks**: Safari needs `webkit-` prefixes for `text-stroke` and
  `backface-visibility`. PWA standalone mode hides URL bar — design assuming
  full-bleed viewport with `viewport-fit=cover` + `safe-area-inset-*`.

---

## Next phase — Cheese-Catching Fire-Truck Game 🚒🧀

A short, replayable arcade mini-game that becomes the secret reward for
tapping the "DAGE TILBAGE" label.

### Trigger

The two-trucks-bracketing-"DAGE TILBAGE" label in the hero becomes tappable.
Tap → fade calendar out, open the game (either a new page `/game.html` or a
full-screen modal `<section class="game">` overlaying the calendar — leaning
modal so the calendar state and reduced-motion preference are inherited).

### Concept

Top-down (or 3/4) view of a highway with the fire-truck driving toward the
camera. The truck is fixed vertically (or has a fixed apparent y), the road
scrolls past beneath it. Cheese wedges (🧀) spawn ahead at random horizontal
lane positions; the player steers the truck left/right to catch them.

### Goal

Catch **N** cheeses, where N = the number of days remaining at the moment
the game starts (`unchecked` count from the calendar render). Reaching 0 = win.

### HUD

- Top-left or top-centre: live cheese counter — starts at N, decrements by 1
  per catch ("**5 dage tilbage 🚒🧀**" etc.). Visually echoes the calendar
  header style — Bangers, red outline.
- Top-right: optional "Bedste tid: …" personal best (localStorage).

### Controls

- **Mobile / touch (primary)**: horizontal swipe / drag on the canvas moves
  the truck left/right. Tilt is a nice-to-have but accel-permission is fiddly.
- **Keyboard (desktop)**: ← / → arrows, A / D.
- Truck snaps between 3 lanes (or moves continuously across 3-lane width —
  continuous is more skill-rewarding; pick continuous).

### Difficulty curve

`speed = baseSpeed * (1 + 0.12 * caughtSoFar)`. So each catch makes the world
scroll ~12 % faster. With N = 19 starting, by the time you catch the last
cheese the road is moving ~3.3× initial speed. Tune the multiplier to taste
in playtesting. Also increase cheese spawn rate proportionally so density
doesn't fall.

### Win condition + reward animation

When the last cheese is caught:

1. Scrolling stops smoothly (ease-out over ~1.5 s).
2. The Copenhagen skyline rises from the horizon (silhouette of Christiansborg
   + Rundetårn + the harbour cranes — drawn as SVG paths, kept tiny).
3. The truck drives forward into it (parallax: skyline scales up as truck Y
   moves toward the horizon).
4. "**VI SES I KØBENHAVN!**" in Bangers, big, red-outlined, fades in.
5. After 4 s, button to "Tilbage til kalenderen" returns to the main app.

### Implementation sketch

- **Canvas-based** (one `<canvas>` element, drawn via `requestAnimationFrame`).
  DOM-based with absolutely-positioned emoji spans is also viable and lets us
  reuse the existing emoji rendering — but canvas scales better and gives us
  control of the parallax skyline. Recommend canvas with emoji rendered via
  `ctx.fillText("🚒", x, y)` (works on iOS Safari + macOS Safari with the
  Apple Color Emoji font fallback).
- **Single game-state object** with `truckX`, `cheeses[]`, `speed`, `caught`,
  `phase` ("playing" | "won"). Mutated inside the rAF loop.
- **Collision**: simple AABB on each cheese vs. truck bounding box.
- **Highway**: scrolling parallax with two background layers — distant
  city/hills silhouette and a road texture with lane markings. Both are
  procedurally drawn each frame, no image assets needed.
- **Game over for losing** is not a state — the player can only win. Missed
  cheeses just pass off-screen and respawn ahead until caught.
- **Persist best time** in `localStorage` key `brandbil-game-best`.
- **Haptic** on each catch (`tap("light")`), heavy on win.

### File additions

| File | Purpose |
|------|---------|
| `game.js` (new) | Game loop, input, render |
| `style.css` (existing) | New `.game-modal`, HUD styles, transition |
| `app.js` (existing) | Wire the tap on `.big-label`, mount/dismount the game modal |
| `index.html` (existing) | Empty `<section id="game" hidden>` mount point |

No image assets; everything drawn or emoji.

### Open questions for that phase

- Cheese count = current `unchecked` (so the game gets shorter as the real
  countdown progresses), or fixed at 19/20 always?
- Should winning the game count toward anything in the main calendar, or
  pure cosmetic mini-game?
- One-shot per real-day, or replayable as many times as the friend wants?
- Bangers loaded for HUD text — already in head, no new font fetch.

---

## Changelog (high-level)

- **v1–v4** — initial scaffold, photo circle, fire-truck confetti intro,
  midnight stamps, cache-busting `?v=` query strings.
- **v5–v7** — three-stage intro (cheese → photo + comic text → calendar),
  curved Bangers text, red comic outline, second-photo cross-fade in stage C.
- **v8** — premium calendar features: advent-door flip cards, today pulse,
  live countdown, stamp-event fanfare, photo Easter egg with cheese,
  pull-to-refresh, mirrored framing trucks.
- **v9** — round-2 polish: grid view (Kalender vs Liste toggle), dramatic
  pull-to-refresh with comic text, live seconds, untilted stamp, iPhone 13
  mini sizing.
- **v10–v12** — comic-font headers, footer credit, two-line title, Kalender
  as default, number removed from header (lives only in circle).
- **v13–v14** — vertical spacing pass: tightened then restored breathing room
  so the entire grid-mode interface fits on iPhone 13 mini / 16 while the
  title still clears the Dynamic Island.
