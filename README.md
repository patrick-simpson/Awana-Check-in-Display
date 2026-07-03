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

## 5. Point your check-in system at Pusher

Whichever tool does your check-ins just needs to publish a `checkin` event on the `awana-channel` channel. Any Pusher server SDK works — Node, Python, PHP, etc. Node example:

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
