# Awana Check-in Display

A joyful welcome screen for your Awana club, styled after the official Awana Clubs catalog — chunky rounded type, sparkle doodles, wavy shapes and warm orange gradients. Runs full-screen on a TV or projector, loops your PowerPoint in the background, and reacts to each child's check-in with a celebratory banner, confetti, and an optional chime.

- **Catalog-true club theming** — every banner uses the club's real color, age range, and tagline (Sparks red with "Grades K–2", Cubbies royal blue with "Ages 3–5", and so on).
- **Birthday mode** — falling gifts, fireworks, and "Happy Birthday, [Name]!"
- **First-timer mode** — a special "Welcome to Awana Clubs, [Name]!" moment.
- **Queueing with burst mode** — if five kids scan at once, each still gets their own moment in turn; during a big rush the display automatically shortens banners so the line at the door never outruns the screen.
- **Tonight's tally** — an optional corner counter ("23 checked in tonight"). It stores only a number and resets itself daily.
- **Countdown** — a polished timer in the corner until club starts.
- **Built for signage** — keeps the screen awake during club (Screen Wake Lock), double-click anywhere for fullscreen, and if the connection drops mid-club a warning dot appears on its own.
- **Fully serverless** — no local server to run. Your check-in system publishes events to [Pusher](https://pusher.com) and this display subscribes to them over the internet.

---

## 1. Fork this repo

1. Click the **Fork** button at the top of this page (top-right on GitHub).
2. On the next screen, click **Create fork**. You now own a copy.

## 2. (Skip — GitHub Pages turns itself on)

The first time the deploy workflow runs in your fork it auto-enables
GitHub Pages with "GitHub Actions" as the source. You don't have to
flip any switches. If you ever want to confirm: **Settings → Pages**,
the source should read **GitHub Actions**.

No secrets, no tokens. Every push to `main` redeploys automatically.

## 3. Get free Pusher API keys

Pusher runs the realtime pipe between your check-in system and this display. The free tier is plenty for a club.

1. Go to [pusher.com](https://pusher.com) and create a free account.
2. Click **Create app** → choose **Channels**.
3. Give it a name (e.g. `awana`) and pick the **Cluster** geographically closest to you (for most U.S. clubs, `us2`).
4. Open the app → **App Keys** in the sidebar. Note the two values:
   - `key` (a short hex string) — this is the **App Key**.
   - `cluster` (e.g. `us2`) — this is the **Cluster**.

## 4. Configure your app

Pick whichever is easier — most people use the Settings panel.

### Option A — the Settings panel (no code, per-device)

1. Open your deployed app (see step 6).
2. Move the mouse to wake the gear icon in the bottom-left corner, and click it. (Keyboard shortcut: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>.)
3. Paste the **Pusher App Key** and **Cluster**, fill in the PowerPoint link and start time, click **Save**.

### Option B — edit `src/config.js` (applies to every visitor)

Open `src/config.js` on GitHub (pencil icon to edit in-browser) and fill in:

```js
pusherAppKey: 'abcdef1234567890',
pusherCluster: 'us2',
powerpointEmbedUrl: 'https://onedrive.live.com/embed?cid=…',
countdownTargetTime: '18:30',
```

Commit the change. A new build deploys in about a minute.

#### Getting the OneDrive embed URL

1. Upload your `.pptx` to OneDrive.
2. Open it → **File → Share → Embed**.
3. Copy the URL from the `<iframe src="…"></iframe>` snippet OneDrive gives you.

### Typed slides — no PowerPoint needed

Instead of a PowerPoint embed, you can free-type background slides right in
the app: Settings → Background source → **Typed slides** → **Edit slides…**
(or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd>). Each slide gets the
catalog look automatically, with a per-slide theme, text size, and duration.

**Video slides** — the editor's **+ Add video** button drops a local video
file (mp4/webm) into the rotation:

- The file is stored in this browser's local storage (IndexedDB) on the
  display machine only — it is **never uploaded** anywhere.
- Videos play **muted** (browsers block autoplaying sound on a kiosk).
- "Seconds on screen" = 0 plays the video to the end, then advances; a
  number holds the slide that long while the video loops.
- The JSON **Export** carries a video slide's *name* only — after importing
  a deck on another machine, re-add the video files there (the editor
  badges them "Video not on this device" until you do).
- Clearing the browser's site data deletes stored videos.

### Calendar & weather slides — automatic, from the church calendar

With **Typed slides** as the background source, the display also reads the
church's Awana calendar and generates slides on its own (Settings →
**Calendar & Weather**):

- **Welcome** — "Welcome to Water Night!" on special nights (the calendar
  title after any "` - `note" becomes a subtitle), or your own wording
  ("Welcome to Awana!") on regular nights. On non-club days it points to
  the next club night instead.
- **Next week** — "Next week is Backwards Night!" when something special is
  coming, "No club this/next week" on break weeks (with the comeback date),
  or "Club is on a break" across long gaps like summer. **Awana Store nights
  are never announced ahead of time** — any calendar title containing
  "store" is hidden, and the slot shows the weather instead.
- **Weather** — when next week has nothing to tease (regular weeks, break
  weeks, and the off-season), a live current-conditions
  slide (big temperature, animated hand-drawn glyph) from
  [Open-Meteo](https://open-meteo.com) (free, no API key). Set your town in
  Settings with the **Look up** button.
- **Nights remaining** — once fewer than 10 club nights are left after
  tonight, a big "N nights remaining" slide with the nudge *"Is your child
  on track to finish their book?"*

**How the data flows:** the calendar site doesn't allow direct browser
fetches, so a nightly GitHub Action (`.github/workflows/update-calendar.yml`
→ `scripts/fetch-calendar.mjs`) scrapes the calendar page into
`public/calendar-feed.json` and redeploys when it changes. The display reads
that file same-origin. If the file ever goes stale (>3 weeks), the display
falls back to scraping the calendar live through a public CORS proxy and
keeps the last good copy cached in the browser — the screen never goes
calendar-blind. If parsing ever breaks (e.g. the calendar site redesigns),
the Action refuses to overwrite the last good feed and the workflow run
fails, which emails the repo owner.

To point at a different church's calendar, change the URL in Settings →
Calendar & Weather *and* the `DEFAULT_URL` in `scripts/fetch-calendar.mjs`
(or run the workflow with `--url`). Note "tonight" is decided by the display
device's own clock and timezone — keep the TV's clock right.

## 5. Point your check-in system at Pusher

**Using the [Awana Label Printer](https://github.com/patrick-simpson/Print-TwoTimTwo-Labels)?**
It broadcasts automatically: on its dashboard (`http://localhost:3456`) →
Settings → Pusher Integration, enter the same Pusher app's App ID, Key,
Secret, and Cluster, then click **Test Welcome Screen** — a "Test" banner
should appear here within a second. The exact payload the two apps
exchange is pinned down in [CONTRACT.md](./CONTRACT.md).

Any other check-in tool just needs to publish a `checkin` event on the `awana-channel` channel. Any Pusher server SDK works — Node, Python, PHP, etc. Node example:

```js
// In your check-in system, not this repo
const Pusher = require('pusher');
const pusher = new Pusher({
  appId:   'YOUR_APP_ID',     // from Pusher → App Keys
  key:     'YOUR_APP_KEY',    // same key you put in the display
  secret:  'YOUR_APP_SECRET', // keep this private, never commit it
  cluster: 'us2',
  useTLS:  true,
});

pusher.trigger('awana-channel', 'checkin', {
  firstName:    'Olivia',
  club:         'Sparks',
  isBirthday:   false,
  isFirstTimer: false,
});
```

## 6. Open your app

Your site lives at:

```
https://<your-github-username>.github.io/<repo-name>/
```

On the display PC, open it in Chrome or Edge and press <kbd>F11</kbd> for fullscreen.

---

## Overlay mode (OBS / ProPresenter / vMix)

Add `?overlay=1` to the URL and the page becomes a transparent layer with
only the celebration banners and confetti — no background, countdown,
tally, or buttons — ready to sit on top of a livestream or projection:

```
https://<your-github-username>.github.io/<repo-name>/?overlay=1&key=YOUR_APP_KEY&cluster=us2
```

- `key` / `cluster` — your Pusher app key and cluster in the URL, since
  embedded browsers can't open the settings panel. The key is Pusher's
  public subscribe key, safe to put in a URL.
- In OBS: add a **Browser** source with that URL at your canvas size —
  the background is transparent automatically.
- For systems that need a chroma key instead of transparency, use
  `&chroma=00b140` (green) and key it out.

---

## Keyboard shortcuts

| Shortcut                                               | What it does                                 |
| ------------------------------------------------------ | -------------------------------------------- |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>          | Open the Settings panel                      |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>          | Open the Debug panel (simulate check-ins)    |
| <kbd>F11</kbd> or double-click                         | Toggle fullscreen                            |

The Debug panel is how you test without publishing any real Pusher events — click "Standard welcome", "Birthday welcome", or "Trigger 5 simultaneous" to see the exact same animations real check-ins trigger.

---

## Supported clubs

| Club      | Color      | Shown on banner |
| --------- | ---------- | --------------- |
| Puggles   | Orange     | Ages 2–3        |
| Cubbies   | Royal blue | Ages 3–5        |
| Sparks    | Red        | Grades K–2      |
| T&T       | Green      | Grades 3–6      |
| Trek      | Sky blue   | Grades 6–8      |
| Journey   | Slate      | Grades 9–12     |

Common alternate spellings (`Truth & Training`, `TNT`, `Cubbie`, …) resolve to the right club. Unknown club names still work — they just use the default Awana-orange palette.

---

## Privacy

This screen reads only four fields from each check-in payload:

- `firstName`
- `club`
- `isBirthday`
- `isFirstTimer`

Anything else your check-in system publishes (allergies, addresses, parent info, last names, photos) is **ignored and stripped out** before rendering. Nothing about a child's health or contact info can appear on the screen, even by mistake.

---

## Running locally (optional)

```bash
git clone https://github.com/<you>/<repo>.git
cd <repo>
npm install
npm run dev
```

Then open http://localhost:3000/.

Quality checks (these also run in CI and gate every deploy):

```bash
npm run lint   # ESLint (includes React hooks rules)
npm test       # Vitest unit tests
```

---

## Troubleshooting

- **Blank background where the PowerPoint should be.** Make sure you used the *Embed* URL from OneDrive, not the regular share link. The URL should contain `embed?`.
- **"disconnected" status dot.** Double-check the App Key and Cluster in Settings. Both must match your Pusher app exactly. The cluster is usually 3–4 lowercase letters/digits (e.g. `us2`, `eu`).
- **Banners don't appear even when your check-in system fires events.** In the Pusher dashboard, open your app → **Debug Console**. If events show up there but not on your screen, the channel name or event name is wrong — it must be channel `awana-channel`, event `checkin`.
- **No sound.** Browsers block audio until you interact with the page. Click anywhere or toggle the sound switch in Settings once.
- **Site shows "404" after deploy.** Open the **Actions** tab. If the build step is green but the page is still 404, make sure **Settings → Pages → Source** is set to **GitHub Actions**.

---

## License

MIT. Use, fork, modify, display on as many screens as you like.
