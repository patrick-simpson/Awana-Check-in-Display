# Awana Check-in Display — Project conventions for Claude

## Git workflow: push directly to `main` on every update

Every code change in this repo should be committed **and pushed to
`main`** as part of the same turn. There are no feature branches and no
pull request review step — the user has explicitly authorized direct
pushes to `main`. The deploy workflow at
`.github/workflows/deploy.yml` triggers on every push to `main`, so
each push automatically redeploys the live signage site.

Concretely, after editing any file:

1. `git add` the changed files.
2. `git commit` with a clear message.
3. `git push -u origin main` (no PR, no other branch).

If the working branch is not already `main` (e.g. you started on a
`claude/...` branch), `git push origin HEAD:main` is acceptable.

> Note: this convention lives in memory only. To make the harness
> *enforce* an auto-push (i.e. block stopping until a push has
> happened), configure a Stop hook in `.claude/settings.json`. Ask the
> user before adding hooks.

## Embedding on weaker hardware — `?lowPower=1`

The sibling **Journey Display** repo embeds this app via iframe on a
Raspberry Pi Zero — hardware far weaker than the other, standalone
devices running this same signage app elsewhere. `src/lib/urlFlags.js`'s
`?lowPower=1` flag forces `confettiLevel: 'off'` and `reduceMotion: true`
for that one embed's URL only, winning over even this device's saved
Settings — the same way `?key=`/`?cluster=` already do for OBS/
ProPresenter embeds. `confettiLevel`/`reduceMotion` in `src/config.js`
default to full effects (`'full'` / `false`) for everyone else — **do
not** change those defaults to accommodate one weak embed again; that's
exactly the mistake this flag exists to avoid repeating. Journey
Display's `public/index.html` passes the flag on its iframe's `src`.

**`reduceMotion: true` means ZERO animation, not just reduced** — this
was tightened after an initial pass only suppressed transforms. Two
mechanisms, because framer-motion and CSS need different enforcement:

- **Framer-motion:** `src/lib/motion.jsx` exports `M` — a drop-in
  replacement for `motion` (`M.div`, `M.span`, `M.path`, …, proxied so
  any tag works) that reads `ZeroAnimationContext` (provided in
  `App.jsx`, driven by `config.reduceMotion`) and forces
  `transition={{ type: false }}` — an instant jump to the target value,
  no fade, no repeat loop — **regardless of what transition the caller
  passed**, including a hardcoded `repeat: Infinity`. This is why it's
  stronger than `MotionConfig`'s `reducedMotion="always"` prop (also
  still set): that only ever gates transform/positional values (x, y,
  scale, rotate, width/height, top/left/right/bottom — framer-motion's
  own `positionalKeys` set), never opacity or anything else — verified
  directly against framer-motion's source, not just its docs.
  **Every component in this app (signage side, not `src/presentation/`)
  must import `M` from `src/lib/motion.jsx` instead of `motion` from
  `'framer-motion'` directly.** This is the actual guarantee behind
  "future updates get the animation exemption automatically" — a new
  animated component built with `M.*` is covered with zero extra code;
  one that imports `motion` directly is invisible to this system and
  will animate even under `?lowPower=1`, silently reintroducing the bug
  this exists to prevent. `AnimatePresence`/`MotionConfig` are unaffected
  and still come straight from `'framer-motion'`.
- **Plain CSS** `@keyframes`/`transition` rules (the doodle-scene drift,
  the connecting-status pulse, the cozy-filter fade, and any future one)
  don't go through React, so they need a separate kill switch: `App.jsx`
  toggles a `zero-animation-mode` class on `<html>` from the same
  `config.reduceMotion` flag, and `app.css` has one blanket rule —
  `.zero-animation-mode, .zero-animation-mode * { animation: none
  !important; transition: none !important; }` — that disables every CSS
  animation/transition on the page at once. Deliberately a blanket rule
  rather than listing selectors one at a time, for the same reason as
  `M.*`: a future CSS animation is covered automatically, with nothing
  to remember.
- Verified live (not just unit-tested): a real animated element sampled
  every 250ms genuinely oscillates opacity standalone but is perfectly
  flat under `?lowPower=1`; a CSS `@keyframes` animation's computed
  `animation-name` is its real name standalone and `none` under
  `?lowPower=1`.

## Tech stack snapshot

- React 18 + Vite (plain JavaScript)
- framer-motion, canvas-confetti
- pusher-js for realtime check-in events (no backend in this repo)
- Vite `base: './'` so assets use relative paths and work under any URL
- Two independent HTML entries: `index.html` (signage) and
  `countdown.html` (presentation tool, `src/presentation/`)
- Tailwind CSS 4 (`@tailwindcss/vite`) is imported ONLY by
  `src/presentation/index.css`, with `@source` scanning pinned to that
  subtree — the signage CSS graph must never see Tailwind
- Jelly UI web components, vendored at `public/vendor/jelly-ui.js`
  (loaded from `src/main.jsx`; provenance in `public/vendor/README.md`)
- Shared timing/cap constants live in `src/lib/constants.js` (signage);
  operator-tunable ones are mirrored as validated `config.js` keys
- A hand-written service worker (`src/sw.js`, emitted with a per-build
  cache version by the `serviceWorker()` plugin in vite.config.js)
  gives both pages an offline shell — JSON and HTML stay network-first
  so deploys and schedule edits are never masked by a cache
- Quality gates on every push to `main`: lint, `tsc` typecheck of the
  `@ts-check` seams, vitest with coverage thresholds, build, and the
  Playwright smoke suite; visual regression runs in ci.yml only
  (baselines under `e2e/__screenshots__`, regenerate via the
  update-snapshots workflow)

## Season promo slides (fall 2026)

Three hardcoded, animated recreations of the church's printed fall
posters — the DEFEND **poster contest**, **BARF Night**, and
**Parents' Night** — shown in the lobby signage's background rotation.
Signage only (`index.html`); the projector and Journey never see them.

- `src/lib/promos.js` is the pure half: `SEASON_PROMOS` (the three
  descriptors), `nightsUntil()` / `countdownLabel()` (the live "3 club
  nights left" → "Next club night" → "Tonight!" counter) and
  `buildPromoSlot()`. `src/components/PromoSlide.jsx` + the
  `.promo-*` rules in `app.css` are the art.
- **Calendar-driven, and only calendar-driven.** The counter counts real
  club nights out of the same feed the calendar slides use, through
  `calendarLogic.js`'s `clubNights()` — so a break week the shared
  schedule marks `noClub` is subtracted here too, from one copy of the
  rules rather than two. No feed means **no slot at all**, never a promo
  with a blank or guessed counter (that is also what keeps them out of
  the hermetic e2e smoke run, which boots with no calendar).
- **Self-retiring.** Each promo shows from its `showFrom` through its
  event date INCLUSIVE and is gone the next morning — the same
  `slideInWindow()` semantics as a typed slide's `showUntil`, on the
  local date key that already ticks over at midnight without a reload.
  After 2026-11-04 the slot returns null and nothing changes on screen.
- **ONE slot per pass through the deck.** Three extra slides in an
  eight-slide deck would turn the lobby TV into a poster wall, so the
  slot carries every live promo and `ManualSlideshow` shows a different
  one each lap (`step % length` is the position, `step / length` is the
  lap — both derived from one counter so `advance` stays a pure state
  updater). The slot's key stays `slide.id`, so it remounts each visit
  and every entrance animation plays from the top.
- **Nothing persisted, nothing on the wire.** Like the calendar slides,
  the slot is derived fresh from (events, today, config) on every
  render; it is never written to localStorage and never published. A
  `type: 'promo'` entry arriving in a `slides` chunk is dropped by the
  existing text-only allowlist, and `eventSanitizers.test.js` pins that.
- **Three big statements, one rotating line** (v2, after the owner
  watched them on the lobby TV: too many small pieces, and they landed
  in two seconds and then sat still). A slide carries a headline, a hero
  graphic and a date, at sizes meant for a read from the check-in line,
  plus the countdown chip and ONE `.promo-detail` slot. Every line the
  first pass set in small type is now a string in that slot, which turns
  over at 1.6 / 3.8 / 6.0 s inside the 8 s hold
  (`PROMO_DURATION_SEC = 8`) and beats once at 4.0 s. All of that copy
  lives in the one exported `PROMO_DETAILS` table in `PromoSlide.jsx`,
  chosen by the pure `detailsFor(promo)`; the tonight/`afterContest`
  wording is pinned by tests there. Hero words and dates are set in
  Lilita One (`--font-poster`), headlines in Baloo, the detail line in
  Oswald. If a line will not fit a screen, cut words rather than points.
- Every animated element is `M.*` from `src/lib/motion.jsx`, so
  `?lowPower=1` freezes the whole poster. Ambient `repeat: Infinity`
  loops are fine — just keep the LAST keyframe the resting value,
  because zero-animation mode jumps straight to it and that is the frame
  the Pi sits on. (The drifting confetti and the floating hearts end
  off-frame or at zero opacity for exactly that reason.) Note that
  framer-motion captures the real `requestAnimationFrame` when it is
  imported, so **vitest fake timers cannot drive its crossfades** — the
  detail line's cadence is tested through `RotatingDetail` with real
  timers and short steps, and its copy through `detailsFor`.
- Settings → Calendar & Weather → **"Fall event promos"**
  (`config.seasonPromos`) turns them off without touching the other
  auto-slides.
- **Next season means editing `SEASON_PROMOS` and `PromoSlide.jsx`
  together** — deliberately hardcoded (owner's choice 2026-09-13),
  because the art is a recreation of three specific printed posters, not
  something an operator types a date into.

## Tonight counter: the printer's tally is the source of truth

The corner "Tonight" chip used to run ABOVE the check-in desk's number all
evening. It now has one rule: **the printer's `tally` total is the truth**
(derived on the printer side from TwoTimTwo's own report, and republished
for an hour past club), and a local `bump()` is only an **optimistic tick**
so a child sees the number move within a second of their own check-in.

- **A bump yields to any tally at or after the check-in's time.**
  `bump(at)` in `src/hooks/useTally.js` takes the sanitized `checkin.at` and
  skips when the last adopted tally is stamped at or after it, because that
  total already counts the child. This is not a rare race: plaintext `tally`
  dispatches synchronously in `useSocket.js` while a sealed `checkin` waits
  on a decrypt, so the printer's "check-in then tally" publish order arrives
  here **inverted** almost every time. A check-in with no `at` (a producer
  older than contract v2) falls back to `TALLY_BUMP_GRACE_MS` since the last
  tally landed, measured against this device's own clock only. The printer's
  `at` is never compared to `Date.now()`, for the reason `TALLY_REORDER_MS`
  explains. `sync()` still adopts the printer's total outright.
- **Every check-in is deduped by id before anything else.** `handleCheckIn`
  returns early on `hasSeen(payload.id)`. Two stations, or a recap replaying
  on its own decrypt chain beside the live event, deliver the same id twice.
- **The seen set and the count share one lifetime.** `useSeenEvents.js` is
  day-stamped `localStorage` with the same `todayKey()` shape as
  `useTally.js`. It was sessionStorage, which is shorter: a kiosk relaunch
  kept tonight's number and forgot everyone it had already counted, so the
  next recap replayed the whole `recapMaxAgeMin` window back into the total.
  Two facts about the same evening cannot live on two different clocks.
- **Settings → "Preview a check-in" never moves the public count.** It is a
  rehearsal for the operator: banner yes, demo badge yes, number no. The hint
  rides a local-only fourth argument to `dispatchEvent`/`simulateEvent`
  (`{ countsTowardTally: false }`) that the live Pusher binding never passes.
  Deliberately NOT a payload field: on the wire any publisher could set it,
  and the sanitizer would have to allowlist something the contract has no
  word for. The debug panel's simulators still count, on purpose: that panel
  exists to rehearse the real thing end to end.
- Nothing about the wire changed; the `checkin`/`tally` sanitizers and
  `contract-vectors.json` are untouched. The existing "synced with the
  check-in desk" note still explains a correction bigger than one either way.

## The presentation page (`src/presentation/` → /countdown.html)

The full Awana Presentation Tool, migrated from KVBC-Awana-Countdown
(see MIGRATION.md for the retirement plan). Its conventions carry over:

- **Pure black page backgrounds** (`#000000`) — it is projected onto a
  blank wall. Broadcast-ready quality on every screen; never regress an
  animation, keyboard shortcut, or effect.
- **Pure schedule engine**: `src/presentation/lib/schedule.js` is the
  highest-risk code. Any change to it, to the window tables, or to
  `shared/schedule.json` needs matching cases in
  `src/presentation/lib/schedule.test.js`, and time-travel QA
  via `countdown.html?now=<ISO>` across the 18:00 / 18:05 / 19:30 /
  19:35 / midnight boundaries plus a non-Wednesday evening — the
  Playwright suite (`npm run e2e`, `e2e/countdown-modes.spec.js`)
  automates exactly those boundaries and gates every deploy, but a
  manual spot-check is still good manners for engine changes.
  A device-local "skip weeks" overlay (`lib/scheduleOverlay.js`,
  QuickNav editor) can mark dates no-club; `shared/schedule.json`
  remains canonical for anything structural.
- **Isolation rule**: `src/presentation/` may import from the existing
  app ONLY `src/hooks/useSocket.js`, `src/hooks/useConfig.js`,
  `src/hooks/useWakeLock.js`, `src/lib/weather.js`, `src/lib/skins.js`,
  `src/components/BirthdayArt.jsx`, and the secret-storage helpers
  `src/hooks/useDisplayLogin.js`, `src/hooks/useDisplayKey.js`,
  `src/lib/displayKey.js` (`maskDisplayKey`) and `src/lib/envelope.js`
  (`isPlausibleKey`). Its realtime data must flow through the sanitized
  socket — never a second Pusher stack; the wake-lock, Open-Meteo
  fetcher, skin table, birthday art and the display key / login slots
  are shared so the two pages can't drift apart (the projector page must
  never grow a second copy of a key slot).
  (The skin table earned its place after the two screens disagreed about
  the season: November read as `harvest` on signage and `winter` on the
  projector, from two separate month tables.) Nothing in the signage app
  imports from `src/presentation/`.
- `shared/` at the repo root is served at `/shared/` (dev middleware +
  build copy in vite.config.js) for the whole Awana app family; this
  repo's copy is the canonical one (KVBC-Awana-Countdown is retired).
- Design tokens live in `src/presentation/index.css`; the `--dur-*`
  timing values are mirrored in `src/presentation/lib/motion-tokens.js`
  — keep the two in sync (enforced by
  `src/presentation/lib/motion-tokens.test.js`).
- `shared/slides.json` (verse of the month, closing text) is validated
  in `lib/shared-config.js` like the other shared files — malformed
  content fails the build, never the projector.

## Privacy invariant — DO NOT relax

**One strict allowlist sanitizer per event type** — see
`src/lib/eventSanitizers.js` (bound per-event in
`src/hooks/useSocket.js`). Each incoming payload on the Pusher channel
(`checkin`, `recap`, `checkout`, `tally`, `birthdays`, `ops`, `canary`,
`tonight`, `points`, `schedule`, `notice`, `slides`) is reduced
to exactly its allowlisted fields before anything else sees it: first
names only, ever. Allergy info, contact info, last names, birth years,
photos — none of it can ever reach the screen. Payload shapes are
pinned by `src/lib/__fixtures__/contract-vectors.json` (a byte-identical
mirror of the printer repo's canonical copy) and enforced by
`src/lib/eventSanitizers.test.js`. Preserve this invariant on every
change to the socket layer, the sanitizers, or banner components.

**The four name-bearing events arrive ENCRYPTED**, because the Pusher
channel is public and Pusher public channels have no server-side
authorization primitive at all. `checkin`, `recap`, `birthdays` and
`checkout` — plus `slides`, the operator's published slide deck (free-typed
church copy, contract v5; chunked, ordered strictly by `publishedAt`,
cached in `awanaSyncedSlides.v1`, publish token in its own storage like the
display key) — are sealed with AES-256-GCM (`src/lib/envelope.js`; publisher half is
`print-server/events.js` in the printer repo, pinned to a shared
`envelope-vectors.json` interop fixture). Rules that must survive any
change:

- Decryption sits **in front of** `dispatchEvent`, never beside it — a
  sealed frame is authenticated, not trusted, so it still passes its own
  allowlist sanitizer. `eventSanitizers.js` is untouched by the transport.
- **Anti-downgrade:** once a screen holds a key, a *plaintext* payload on
  those four events is dropped. Without it the encryption is decorative.
- The key lives in its **own** localStorage entry (`src/lib/displayKey.js`)
  and must never be added to `VALIDATORS` in `useConfig.js` — that table
  also backs `?config=<url>` and the Settings export, so it would publish
  the key. `displayKey.test.js` guards all three paths.
- Decrypts are serialized through one promise chain per event, or a burst
  of arrivals greets children out of order.
- **Display login** (`src/lib/displayLogin.js`): `provision` frames on the
  `cache-awana-channel-provision` cache channel are opened with a
  passphrase-derived key (PBKDF2-SHA256, params pinned in the fixture's
  `provision` section) and write ONLY into the displayKey/publishToken
  storage slots — never into config, never through `dispatchEvent`, never
  rendered. The derived login key lives in its own `awanaLoginKey.v1` entry
  with the same three leak-path tests as the display key. `useSocket.js` is
  still the only file that imports pusher-js, which is why the subscription
  lives there.
- The other events stay plaintext **on purpose**: their readability
  is what lets a screen distinguish "pipe down" from "cannot read names"
  from "quiet night". See SECURITY.md.

**`checkout` (who is still here) needs more than a sanitizer.** It is the
one payload that names children who are *not yet with a parent*, so the
rendering rules are part of the privacy design, not styling:

- It is **off by default** (`checkoutBoardMode: 'off'`). No default is
  right for every church, so it takes a deliberate choice.
- Below `checkoutBoardNamesAbove` children it **stops naming anyone**. A
  long list is anonymising; two names late in the evening point at two
  specific unattended children, and `checkin` already published those
  names earlier.
- A missing payload renders **nothing**, never an empty board — "I have
  no data" and "everyone has been picked up" are opposite facts.
- It is **not a headcount**. It reflects whether volunteers *recorded*
  checkout, so it can be fresh and wrong; every string says "not checked
  out yet", never "still in the building".
- All of that judgement lives in the pure `decideBoard()` in
  `src/lib/checkoutBoard.js` so it can be tested exhaustively.
