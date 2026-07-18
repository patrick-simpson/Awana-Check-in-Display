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
  `src/hooks/useWakeLock.js`, and `src/lib/weather.js` (its realtime
  data must flow through the sanitized socket — never a second Pusher
  stack; the wake-lock and Open-Meteo fetchers are shared so the two
  pages can't drift apart). Nothing in the signage app imports from
  `src/presentation/`.
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
(`checkin`, `recap`, `tally`, `birthdays`, `ops`, `canary`) is reduced
to exactly its allowlisted fields before anything else sees it: first
names only, ever. Allergy info, contact info, last names, birth years,
photos — none of it can ever reach the screen. Payload shapes are
pinned by `src/lib/__fixtures__/contract-vectors.json` (a byte-identical
mirror of the printer repo's canonical copy) and enforced by
`src/lib/eventSanitizers.test.js`. Preserve this invariant on every
change to the socket layer, the sanitizers, or banner components.
