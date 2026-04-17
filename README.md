# Awana Check-in Display

A joyful welcome screen for your Awana club. Runs full-screen on a TV or projector, loops your PowerPoint in the background, and reacts to each child's check-in with a celebratory banner, confetti, and an optional chime.

- **Dynamic club theming** — Cubbies banners are blue, Sparks red, T&T green, and so on.
- **Birthday mode** — falling gifts, fireworks, and "Happy Birthday, [Name]!"
- **First-timer mode** — a special "Welcome to Awana, [Name]!" moment.
- **Queueing** — if five kids scan at once, each gets their own moment in turn.
- **Countdown** — a polished timer in the corner until club starts.
- **Zero backend** from this repo — it just listens to your existing check-in server over a WebSocket.

---

## 1. Fork this repo

1. Click the **Fork** button at the top of this page (top-right on GitHub).
2. On the next screen, click **Create fork**. You now own a copy.

## 2. Turn on GitHub Pages

GitHub Pages is a free service that hosts the app for you. You only do this once.

1. In your fork, open the **Settings** tab (top of the repo page).
2. In the left sidebar click **Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.

That's it. No secrets, no tokens. Every time you push a change to `main`, a fresh copy of the site gets published automatically.

## 3. Configure your app

You have two ways to set the WebSocket URL, the PowerPoint link, and the club start time. Pick whichever feels easier — most people use the Settings panel.

### Option A — the Settings panel (no code, per-device)

1. Open your deployed app (see step 5 below).
2. Move the mouse to wake the gear icon in the bottom-left corner, and click it. (Keyboard shortcut: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>.)
3. Fill in the three fields, click **Save**. Your settings are saved in the browser on that device.

### Option B — edit `src/config.js` (applies to every visitor)

Open `src/config.js` in GitHub (click the pencil icon to edit in-browser) and fill in the top three values:

```js
websocketUrl: 'ws://192.168.1.42:3000',      // where your check-in server listens
powerpointEmbedUrl: 'https://onedrive.live.com/embed?cid=…',
countdownTargetTime: '18:30',                 // 6:30 PM, 24-hour clock
```

Commit the change. A new build will deploy in about a minute.

#### Getting the OneDrive embed URL

1. Upload your `.pptx` to OneDrive.
2. Open it in OneDrive → **File → Share → Embed**.
3. OneDrive gives you an `<iframe src="…"></iframe>` snippet. Copy just the URL between the quotes and paste it into the settings.

## 4. Wait for the green check

Open the **Actions** tab of your fork. The most recent run should turn green after 1–2 minutes.

## 5. Open your app

Your site lives at:

```
https://<your-github-username>.github.io/<repo-name>/
```

On the display PC, open it in Chrome or Edge and press <kbd>F11</kbd> for fullscreen.

## 6. Wire it up to your check-in server

This app listens for a WebSocket event called `checkIn` with this exact payload shape:

```json
{
  "firstName": "Olivia",
  "club": "Sparks",
  "isBirthday": false,
  "isFirstTimer": false
}
```

A minimal Node.js server that does this (using `socket.io`) looks like:

```js
// server.js
const { Server } = require('socket.io');
const io = new Server(3000, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('Display connected');
});

// Call this whenever a child checks in:
function broadcastCheckIn({ firstName, club, isBirthday, isFirstTimer }) {
  io.emit('checkIn', {
    firstName,
    club,
    isBirthday: !!isBirthday,
    isFirstTimer: !!isFirstTimer,
  });
}

// Example:
setTimeout(() => broadcastCheckIn({ firstName: 'Amelia', club: 'Cubbies' }), 5000);
```

Run `npm install socket.io && node server.js` on the check-in laptop, then point the display's **WebSocket server URL** setting at `ws://that-laptop-ip:3000`.

---

## Keyboard shortcuts

| Shortcut                                               | What it does                                 |
| ------------------------------------------------------ | -------------------------------------------- |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>          | Open the Settings panel                      |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>          | Open the Debug panel (simulate check-ins)    |
| <kbd>F11</kbd>                                         | Toggle browser fullscreen                    |

The Debug panel is how you test without a real check-in server — click "Standard welcome", "Birthday welcome", or "Trigger 5 simultaneous" and you'll see the exact same animations real check-ins trigger.

---

## Supported clubs

Banners and confetti theme themselves automatically based on the `club` field in the payload. Anything not in this list still works — it'll just use the default yellow palette.

| Club      | Color  |
| --------- | ------ |
| Puggles   | Purple |
| Cubbies   | Blue   |
| Sparks    | Red    |
| T&T       | Green  |
| Trek      | Orange |
| Journey   | Teal   |

---

## Privacy

This screen reads only four fields from each check-in payload:

- `firstName`
- `club`
- `isBirthday`
- `isFirstTimer`

Anything else your check-in system sends (allergies, addresses, parent info, last names, photos) is **ignored and stripped out** before rendering. Nothing about a child's health or contact info can appear on the screen, even by mistake.

---

## Running locally (optional)

You don't need this for normal use, but if you want to develop:

```bash
git clone https://github.com/<you>/<repo>.git
cd <repo>
npm install
npm run dev
```

Then open http://localhost:5173/.

---

## Troubleshooting

- **Blank background where the PowerPoint should be.** Make sure you used the *Embed* URL from OneDrive, not the regular share link. The URL should contain `embed?` in it.
- **"disconnected" status dot.** The display can't reach your check-in server. Check that the server is running, that both machines are on the same network, and that the URL in Settings uses the server's IP address (not `localhost` unless both are on the same machine).
- **No sound.** Browsers block audio until you interact with the page. Click anywhere or toggle the sound switch in Settings once — chimes work from then on.
- **Site shows "404" after deploy.** Open the **Actions** tab and look at the latest run. If the build step is red, click it for the error message. If it's green but the page is still 404, make sure **Settings → Pages → Source** is set to **GitHub Actions** (step 2 above).
- **Animations are fine but no banner.** Check the browser's JavaScript console (<kbd>F12</kbd>). The server likely emitted a payload missing `firstName`.

---

## License

MIT. Use, fork, modify, display on as many screens as you like.
