# TOK — DJ sufler

TOK is a DJ prompter for YouTube Music playlists. It listens to the song that's currently playing and suggests what to queue next by tempo, energy, and key, so a mix keeps flowing instead of stalling between tracks.

It's a single-page web app — no build step, no backend, no accounts. Everything runs client-side and installs as a PWA.

## Features

- **Direction-based suggestions** — pick *up*, *down*, or *flow* and TOK proposes the next track to match: build energy, wind it down, or hold steady.
- **Per-track metadata** — BPM, key, and energy rating, editable per song and stored locally.
- **Playlist queue** — browse, search, and reorder the current playlist; switch between multiple saved playlists.
- **Custom theming** — pick an accent color or set a custom one via hue/saturation picker.
- **Installable PWA** — works offline-capable as a standalone app on mobile and desktop, with a true-black theme tuned for OLED displays.
- **Local database import/export** — back up or move your track metadata as a JSON file.

## Getting started

No build tools required — it's static HTML/CSS/JS.

```bash
git clone https://github.com/gryva/tok-dj-sufler.git
cd tok-dj-sufler
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser and paste a YouTube Music playlist link or ID to get started.

## Running tests

```bash
npm test          # full suite
npm run test:unit    # unit tests only
npm run test:stress  # stress tests only
```

## Project structure

```
index.html       App shell and markup
style.css        Styling and animations
app.js           UI logic, playlist/queue management, theming
engine.js        Suggestion engine (tempo/energy/key matching)
js/              Smaller standalone modules (e.g. direction-arrow animation)
test/            Unit and stress tests
manifest.json    PWA manifest
```

## Tech

Vanilla JavaScript (ES modules), no framework, no bundler. Tests run on Node's built-in test runner.
