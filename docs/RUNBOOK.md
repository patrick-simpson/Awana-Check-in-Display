# Club-night operations runbook

The five-minutes-before-club guide for whoever is standing at the
screen — no coding required. The [README](../README.md) covers setup
from scratch; this covers *running* the two displays and getting out of
trouble fast.

## The two screens

| Screen | URL | Lives where |
| --- | --- | --- |
| **Check-in display** (welcome banners) | `…/index.html` (the site root) | Lobby TV, near the check-in table |
| **Presentation tool** (countdown, pledges, game timers) | `…/countdown.html` | Projector in the main room |

Both are just web pages: any stick/PC with Chrome or Edge, opened
fullscreen, is a working display. Both keep the screen awake on their
own (Screen Wake Lock) and both survive network blips — the service
worker keeps art, slides, and the schedule cached on the device.

---

## Check-in display (lobby TV)

### Pre-club check (5:45 PM)

1. Screen is on, page is fullscreen (double-click anywhere toggles it).
2. Hover the mouse — a gear appears bottom-left. If the header of the
   Settings panel (Ctrl+Shift+S) says **Connected**, you're done.
3. Fire a test: Settings → **Preview a check-in**, or ask the check-in
   table to use the print server's "Test Welcome Screen" button
   (end-to-end proof).

### Operator controls

| Shortcut | What it does |
| --- | --- |
| Ctrl+Shift+S | Settings panel (connection, background, banners, calendar) |
| Ctrl+Shift+E | Typed-slides editor |
| Ctrl+Shift+D | Debug panel — simulate check-ins, rushes, birthdays |
| Ctrl+Shift+X | **Panic mode** — strips to the reliable core, banners keep working |
| Double-click | Fullscreen |

### "The screen is wrong at 5:55 PM" — decision tree

- **Background looks broken / weird slide junk** → Ctrl+Shift+X
  (panic mode). Kids still get their banners; sort the background out
  after club. Ctrl+Shift+X again to restore.
- **"Signal: disconnected" in the corner** → the display lost Pusher.
  It retries on its own (the sticker shows the retry countdown) and
  the page self-reloads after a long outage. Meanwhile check-ins are
  NOT lost: on reconnect, the print server's recap replays anyone
  missed in the last ~20 minutes with quiet banners.
- **"Signal: not set up"** → no Pusher key on this device. Settings →
  Connection → paste the App Key + Cluster (from the same Pusher app
  the print server uses).
- **"⚠ N" printer-problem count on the Signal sticker** → labels are
  failing at the door. That's a print-server issue — check its
  dashboard; the display is just the messenger.
- **Names not appearing but the Pusher Debug Console shows events** →
  channel/event mismatch (`awana-channel` / `checkin`), or the wrong
  Pusher app's key on one side.
- **Frozen / black / anything else inexplicable** → reload the page
  (F5). Tonight's tally and seen-events survive a reload; the recap
  buffer refills anyone missed. Still wrong → reboot the stick.

### Good-to-know behaviors (not bugs)

- One banner at a time; during a rush, banners shorten automatically
  (never below the Settings → Banners floor) and a "+N more coming"
  pill appears.
- After the opening ceremony starts, banners switch to a calmer
  late-arrival style with no confetti cannon — that's the shared
  schedule (`shared/schedule.json`) doing its job.
- The tally resets itself each day; "Reset counter" in Settings does it
  on demand.

## Presentation tool (projector)

### Pre-club check

1. Open `…/countdown.html` — the week-long countdown should show the
   right time until Wednesday 6:00 PM. **If the countdown time is
   wrong, the device clock is wrong** — the page shows an amber
   "clock off by ~N min" chip when it detects this. Fix the system
   clock / enable network time; nothing else will look right until
   you do.
2. Hover the **top-right corner** for the hidden operator menu
   (QuickNav): jump to any window, set the Pusher key, toggle
   Low-power mode (weak hardware) or countdown sounds (off by
   default). Birthdays sync themselves from the print server's
   broadcast once the key is set — there is nothing to upload.

### During club

The schedule drives everything: opening slides at 6:00, game screens
per club, closing slides at 7:30, shutdown at 7:35. Manual overrides
from QuickNav hand back to the schedule on their own (a "back to
schedule in Ns" pill warns first — press **Stay** to keep it).

| Keys | Where | What |
| --- | --- | --- |
| Space / → / PageDown | countdown & slides | advance / skip to ceremony |
| ← / PageUp | slides | previous slide |
| Esc twice | slides | exit to countdown |
| Space / Enter | shutdown screen | restart countdown |

### Skipping a week (holiday)

QuickNav → **Skip Weeks** → pick the date → "Mark no club". That
device immediately treats the date as no-club (countdown counts to the
following week). This is per-device; for the change to apply everywhere
and permanently, put it in `shared/schedule.json` instead (any edit
there is validated by CI before it can deploy).

### Closing text

Edit `shared/slides.json` in the repo — the goodnight slide's text
comes from there. A malformed edit fails the build rather than
reaching the projector. (The verse-of-the-month slide was retired: the
opening ceremony ends on a blackout, and pressing → on the blackout
jumps straight into the first game window.)

## Moving or replacing a display device

Settings on a device live in that device's browser. To clone a lobby
display: Settings → **Export**, then **Import** on the new machine.
For the projector page: enter the Pusher key via QuickNav (a corner
note appears on fresh devices until it is set); birthdays and live
counts then sync themselves from the print server's broadcasts.

## Deploy facts worth knowing

- Every push to `main` redeploys the site (lint, typecheck, tests, and
  an end-to-end smoke suite all gate it — a red check means the old
  site stays up).
- Devices pick up a deploy on their next page load (the service worker
  never serves stale code after a reload).
- The church calendar feed refreshes itself nightly via a scheduled
  GitHub Action; if the calendar page breaks, displays keep the last
  good copy.

## Privacy (the rule that never bends)

The screens show **first names only** — ever. Every event from the
check-in system is stripped to an allowlist before anything renders
(see `CONTRACT.md`). If you ever see more than a first name and club on
screen, treat it as an incident: panic mode (Ctrl+Shift+X does not
affect banners — instead pull the Pusher key in Settings to stop the
feed), then report it.
