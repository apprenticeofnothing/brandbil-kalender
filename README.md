# Brandbil Count Down Kalender

A 19-day countdown calendar from **6 May → 24 May 2026**. Each day automatically gets a 🚒 stamp once Copenhagen local time passes 22:00.

It's a static web page (no backend, no accounts). On iPhone, opening the URL in Safari and tapping **Share → Add to Home Screen** turns it into an app icon that launches full-screen.

## Files

- `index.html` — markup + meta tags
- `style.css` — styling (Apple-feel, dark/light, full-bleed)
- `app.js` — countdown logic + tile rendering
- `manifest.webmanifest` — PWA manifest
- `icon-180.png` / `icon-512.png` — home-screen icon

## Run it locally

```bash
cd ~/brandbil-kalender
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to GitHub Pages

```bash
cd ~/brandbil-kalender
git init -b main
git add .
git commit -m "Initial commit"

# Create the public repo on GitHub (one-off, requires gh CLI logged in):
gh repo create brandbil-kalender --public --source=. --remote=origin --push

# Enable Pages on the main branch root:
gh api -X POST "repos/{owner}/brandbil-kalender/pages" -f "source[branch]=main" -f "source[path]=/" \
  || gh api -X PUT  "repos/{owner}/brandbil-kalender/pages" -f "source[branch]=main" -f "source[path]=/"
```

After ~1 minute the URL is `https://<your-github-username>.github.io/brandbil-kalender/`.

## Send to your friend

1. Text them the URL.
2. They open it in Safari on iPhone.
3. They tap **Share → Add to Home Screen → Add**.
4. The icon appears on their home screen and launches full-screen, just like a native app.

Both phones show the same checks because the state is computed deterministically from the current time in Europe/Copenhagen.

## Previewing a future state

Append `?simulate=2026-05-13T15:00:00Z` to the URL to render the calendar as if "now" were that ISO timestamp. Useful for sanity-checking the look on a future evening without waiting.

## How the auto-check works

The app does **not** rely on background tasks (which iOS makes unreliable). Instead, the file `app.js` hard-codes 19 UTC instants — one for each day at 22:00 Copenhagen time:

```js
for (let day = 6; day <= 24; day++) {
  TRIGGERS.push(Date.UTC(2026, 4, day, 20, 0, 0)); // 22:00 CEST = 20:00 UTC
}
```

Every time the page renders (on open, on visibility change, and on a 60s timer), each tile is shown as checked iff `Date.now() >= TRIGGERS[i]`. So both phones always agree, and tiles flip automatically without any push, account, or sync.
