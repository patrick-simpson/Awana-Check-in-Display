# Presentation-tool migration & KVBC-Awana-Countdown retirement plan

The full presentation tool now lives in this repo at
`src/presentation/` → deployed as `/countdown.html`. The original
**KVBC-Awana-Countdown** repo was left untouched and keeps working; the
two can run side by side for as long as needed.

## Current state (transition period)

- `shared/` (schedule.json, theme.json, art/) exists in **both** repos
  with identical content. **KVBC-Awana-Countdown remains canonical** —
  edit there first, mirror here (see the note in `shared/README.md`).
- This repo's signage page still runtime-fetches
  `…/KVBC-Awana-Countdown/shared/*.json` (see `sharedScheduleUrl` /
  `sharedThemeUrl` in `src/config.js`).
- The printer repo (Print-TwoTimTwo-Labels) also still reads the old
  repo's `shared/` URLs.
- The presentation page reads its *own* copy at build time
  (`src/presentation/lib/shared-config.js`) — no runtime dependency on
  the old repo.

## Retirement checklist (do these in order, when ready)

1. **Repoint this repo's signage config:** change `sharedScheduleUrl` /
   `sharedThemeUrl` in `src/config.js` to
   `https://<owner>.github.io/Awana-Check-in-Display/shared/…` (and the
   matching URLs in `src/lib/theme.test.js` / `src/lib/schedule.test.js`).
2. **Repoint the printer repo** (Print-TwoTimTwo-Labels) off the old
   `shared/` URLs the same way.
3. **Operator cutover:** switch the projector machine's kiosk
   bookmark/autostart from `…/KVBC-Awana-Countdown/` to
   `…/Awana-Check-in-Display/countdown.html`. localStorage does not
   cross origins, so on the new page re-upload the birthday CSV and
   re-enter the Pusher key once (QuickNav → Display Settings, or
   `?key=…&cluster=…` on first load).
4. **Flip canonical:** declare this repo's `shared/` the canonical copy —
   remove the transition note in `shared/README.md` (both repos) and
   update the old repo's README.
5. **Archive:** optionally add a redirect page to the old repo, then
   archive KVBC-Awana-Countdown. Keep its Pages site up until steps 1–2
   have shipped everywhere.

## Follow-up ideas (optional, not required)

- Unify the presentation page's ambient `useWeather` (WeatherType enum)
  with the signage `lib/weather.js` reading through one shared fetcher.
- The signage corner `CountdownTimer.jsx` chip is a different surface
  and stays; retire it only if it ever becomes redundant.
