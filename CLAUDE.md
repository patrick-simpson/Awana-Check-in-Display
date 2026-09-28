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
  passed**, including a hardcoded `repeat: Infinity`, and including one
  NESTED inside a target (`exit={{ opacity: 0, transition: {...} }}`, an
  `animate` target's own transition, a variant's): framer-motion lets a
  nested transition beat the element's prop, so under zero animation M
  strips those too (`stripTransition` / `stripVariants`). Before that, every
  exit with its own timing still animated on the Pi. This is why it's
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
- **Plain CSS** `@keyframes`/`transition` rules (the lobby's ambient
  `lobby-drift-*` / `lobby-float` / `lobby-twinkle` / `lobby-roll` loops,
  the connecting-status pulse, the cozy-filter fade, and any future one)
  don't go through React, so they need a separate kill switch: `App.jsx`
  toggles a `zero-animation-mode` class on `<html>` from the same
  `config.reduceMotion` flag, and `app.css` has one blanket rule —
  `.zero-animation-mode, .zero-animation-mode *, .zero-animation-mode
  *::before, .zero-animation-mode *::after { animation: none !important;
  transition: none !important; }` — that disables every CSS
  animation/transition on the page at once. Deliberately a blanket rule
  rather than listing selectors one at a time, for the same reason as
  `M.*`: a future CSS animation is covered automatically, with nothing
  to remember. The pseudo-elements are named because `*` never matches
  one and neither property is inherited: the kit checkbox's `::before`
  check pop still played under `?lowPower=1` until they were.
  `src/lib/zeroAnimationCss.test.js` pins the rule and fails any
  pseudo-element animation it would not reach.
- Verified live (not just unit-tested): a real animated element sampled
  every 250ms genuinely oscillates opacity standalone but is perfectly
  flat under `?lowPower=1`; a CSS `@keyframes` animation's computed
  `animation-name` is its real name standalone and `none` under
  `?lowPower=1`.

**Double-click fullscreen is handed UP when embedded.** A double-click on
the stage normally fullscreens the stage element. Inside Journey's iframe
that fullscreens only the frame, which covers Journey's own corner buttons
and leaves the operator with no way back out, so `toggleFullscreen` in
`App.jsx` instead posts `{ type: EMBED_FULLSCREEN_MESSAGE }` (the string
lives in `src/lib/constants.js`) to `window.parent` and returns. Journey's
`public/src/schedule.js` is the consumer: it verifies `event.source` is its
own iframe and fullscreens its whole page. The message carries nothing but
its type, and standalone behaviour (`window.self === window.top`) is exactly
what it always was. Both sides have to agree on the string, so changing it
means landing both repos together.

## Brand kit — `shared/brand/` (2026-27 catalog)

Owner decision 2026-09-27: every screen in the family (lobby signage,
projector, Journey kiosk, label printer) wears the Awana 2026-27 catalog's
design language and full official branding. `shared/brand/` is the one
canonical kit: `tokens.json` (club primary/deep/tint, house colors, fonts,
the motion table), `tokens.css` (the same as `--brand-*` properties),
`fonts.css` + `fonts/` (Galindo, Londrina Solid, Figtree; WOFF2 for the web,
TTF for the printer's canvas; OFL), `logos/` (every club mark as white
knockout / full color / one color, plus the Awana Clubs mark), `shapes/`
and `doodles/`. Read its README before changing it.

- **Three spellings of one palette.** `tokens.json`, `tokens.css` and
  `shared/theme.json` must agree; `src/lib/brandKit.test.js` fails if they
  drift. Edit all three together, and the projector's `--color-club-*` in
  `src/presentation/index.css` too (`shared-config.test.js` pins those to
  theme.json).
- **Puggles is blue** (`#1DB6D9`, its wordmark and duck), not the orange its
  catalog page uses: the owner's call, pinned by a test.
- **theme.json is what the screens actually render**, not `clubs.js`: once
  it loads, its values win field by field. Its optional `deep` and `tint`
  beat the derived guesses, and `art.logoWhite` (the knockout) beats
  `art.logo` (full color, for light fields) on banners, which sit on the
  club's own color. `clubs.js` carries the same catalog values as the
  pre-load fallback.
- **Mirrors.** Journey-Display (`public/brand/`) and the printer
  (`print-server/public/brand/`) carry byte-identical copies with drift
  checks, so neither depends on the network at showtime. Change the kit
  here first, then re-copy it into both.
- `scripts/brand/extract-catalog-brand.py` regenerates the marks and shapes
  from a catalog PDF (not committed), for next season.
- **Two sizes of one shout.** `--font-shout` is Galindo at true size, for
  everything built from the kit (`src/components/brand/`, and each surface as
  its stage rebuilds it). `--font-display` is the same files drawn at 82% (the
  `'Galindo Fit'` @font-face in app.css), so rules still sized for the old
  Baloo 2 (banner names, the ticker and the other surfaces not yet rebuilt)
  keep their fit: at true size a max-length slide overflowed and long names
  broke mid-word at 720p. Move a rule to `--font-shout` only when you re-size
  it, as stage 4b did for the lobby's headlines (typed and calendar slides
  now shout in `--font-shout`, sized by the fit in `src/lib/lobbyFrame.js`).
  Both stacks fall back to Baloo 2 for the letters Galindo lacks (Ș, Ț,
  Vietnamese), which is why the Baloo import outlives the promos.
- **The posters keep their own faces.** `--promo-font-*` and `--font-poster`
  are poster-only and the brand tokens never touch a `.promo-*` rule;
  `src/lib/promoFonts.test.js` pins both directions.
- **Kit primitives** (`src/components/brand/`: StepChip, Wave, CornerTab,
  Sticker, DoodleCluster) are M elements, timed from `src/lib/brand.js`
  (one 100 ms beat, the wipe / settle / pop / exit curves).
  `zeroAnimation.test.jsx` renders each through the real framer-motion under
  zero-animation mode, and `src/lib/motionImports.test.js` fails any signage
  file that imports an animating framer-motion export instead of `M`.
- **The lobby has its own visual suite**, `e2e/signage.visual.spec.js`: a
  paused Playwright clock (install() alone lets time run), Math.random
  reseeded at every click, a fixture calendar and `?lowPower=1`. Regenerate
  its baselines with the update-snapshots workflow, never from a sandbox.

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
  so deploys and schedule edits are never masked by a cache, and the
  self-update probes are network-ONLY (see "Self-updating pages")
- Quality gates on every push to `main`: lint, `tsc` typecheck of the
  `@ts-check` seams, vitest with coverage thresholds, build, and the
  Playwright smoke suite; visual regression runs in ci.yml only
  (baselines under `e2e/__screenshots__`, regenerate via the
  update-snapshots workflow)

## Season promo slides (fall 2026)

Four hardcoded, animated posters in the lobby signage's background
rotation: recreations of the church's three printed fall posters (the
DEFEND **poster contest**, **BARF Night**, and **Parents' Night**), plus
a fourth the printer never made, the **slime cut of BARF Night**.
Signage only (`index.html`); the projector and Journey never see them.

- `src/lib/promos.js` is the pure half: `SEASON_PROMOS` (the four
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
- **ONE slot per pass through the deck.** Four extra slides in an
  eight-slide deck would turn the lobby TV into a poster wall, so the
  slot carries every live promo and `ManualSlideshow` shows a different
  one each lap (`step % length` is the position, `step / length` is the
  lap — both derived from one counter so `advance` stays a pure state
  updater). The slot's key stays `slide.id`, so it remounts each visit
  and every entrance animation plays from the top.
- **The hold belongs to the POSTER, not the slot.** Each descriptor
  carries its own `durationSec` (8 / 8 / 8 / 15), `buildPromoSlot()`
  copies it onto every slot entry, and `ManualSlideshow` hands
  `slideDurationMs` the promo this lap is showing rather than the slot
  (falling back to the slot's own `durationSec`). One hold for all four
  would either rush the slime cut or leave the other three sitting
  still. `slideDurationMs` stays a pure function of one slide.
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
- **A promo poster holds check-ins** while it is up (see "The lobby
  director" below): arrivals wait behind a WAITING chip and play at full
  length on the next slide, and the stinger wave carries the lobby into and
  out of each poster. The posters themselves are untouched.
- Settings → Calendar & Weather → **"Fall event promos"**
  (`config.seasonPromos`) turns them off without touching the other
  auto-slides.
- **The slime cut (`kind: 'barfEpic'`, `BarfEpicPromo`)** is the loud
  one: a wall of dripping lime goo over deep purple, THE / BIGGEST /
  BARF / EVER slamming in one at a time behind splats that hit the
  "glass", then a lower third that rises out of a puddle while two plum
  kid silhouettes high-five over it, then the date, the reward line and
  the closer. Same window as BARF Night (through 2026-10-14 inclusive),
  same `tonight` variant, and its beat sheet runs to 12 s, which is what
  the 15 second hold is for.
  - **Its beats are keyframes, not `initial` plus `delay`.** Measured on
    the real build: framer-motion runs an accelerated value (opacity) on
    the browser's own timeline and everything else on its JS frameloop,
    so an element waiting out a long `delay` can paint at its ANIMATE
    opacity: a word at full strength and triple size seconds before its
    beat, and the closer on screen from the first frame. The pure
    `landsAt(at, dur, values)` in `PromoSlide.jsx` builds one keyframe
    list per beat ("hold, then land"), which nothing downstream can
    reinterpret, and whose LAST value is still what `?lowPower=1`
    freezes on. Use it for any new beat here rather than a long `delay`.
  - **The frozen frame is the whole poster.** Everything rests at
    opacity 1 in its final position; the only things that end faint are
    the splats (a 0.45 stain, which is what a splat on glass looks like)
    and the edge drips, which end off-frame.
  - `splatPath(seed, arms)` draws the thrown goo from a tiny seeded LCG,
    so the stains are varied but identical on every device and in every
    screenshot; a test pins that.
- **Next season means editing `SEASON_PROMOS` and `PromoSlide.jsx`
  together** — deliberately hardcoded (owner's choice 2026-09-13),
  because the art is a recreation of specific printed posters, not
  something an operator types a date into.

## The check-in moment (rebrand stage 3)

Every arrival is one component, `src/components/CheckInMoment.jsx`: the
catalog's club opener page played live. The child's club wave rises and
carries the name (Galindo, `--font-shout`, sized by measurement so it never
breaks between letters), the club's white mark rides the low side, three kit
doodles land last, and the one hot sticker marks a birthday or a first-timer.
The colour is always the child's club. What differs between a welcome, a
welcome back, a first-timer, a birthday and a replayed recap is only the
kicker, the one line under the name and the sticker, all pure functions in
`src/lib/checkInMoment.js` (tests pin the wording, the ribbon rule and that
a birthday never shows a number).

- **Nobody's time is ever shortened** (owner, 2026-09-27). The queue is the
  pure reducer in `src/lib/checkInQueue.js`: every child holds for their full
  configured time (`holdMsFor`, which cannot even see the backlog). A RUN is
  one stretch with the wave up; when a hold ends and someone is waiting, the
  next child takes over in the same run (`step` + 1) with no gap and the name
  FLIPS. The old burst shrink, `BURST_FLOOR_MS` and `burstFloorMs` are gone;
  do not bring them back to "drain a backlog".
- **The gap between runs is never shorter than the run's exit**
  (`RUN_EXIT_MS`, derived from the `WAVE_EXIT` table the component also
  reads). The Overlay keys the moment on `run` with `AnimatePresence
  mode="wait"`, so a new run mounts only after the last has left; a shorter
  gap would spend the next child's hold on the previous child's exit. Under
  zero animation exits are instant and the configured gap alone applies.
- **Flips cross over in place.** Per-child copy (kicker, name, line, sticker,
  mark, a new club's wave) sits in small keyed AnimatePresences; the
  outgoing copy gets `is-leaving` (via `useIsPresent`) the moment its exit
  starts and leaves the flow, so only the incoming child sizes a cell, and
  the cells above glide (`layout="position"`). Per-child copy carries its own
  club colours and sticker size, so an outgoing name never repaints in the
  next club's colours mid-exit. A newer club's wave stacks over the one it
  replaces inside an isolated layer.
- **Confetti** fires from the moment's own effect, once per LIVE child,
  timed to land with the name or out of the sticker (aimed at the sticker's
  measured centre), and cleared if the child flips away first. Bursts throw
  the kit's four-point sparkle (a canvas-confetti path shape built once with
  an explicit matrix; star fallback) and dots; season skins still win.
- The slide behind **steps back** while a name is up (`.stage.checkin-active`,
  scoped to the live background so the slide editor's thumbnails stay true),
  and the idle settings gear hides so it never sits on the club's mark.
- Testing: Playwright's `page.clock` does NOT drive framer-motion's opacity
  (it runs on the browser's own animation timeline), so frames of a moving
  animation must be sampled in real time; paused-clock screenshots are only
  meaningful under `?lowPower=1`, which is what `e2e/signage.visual.spec.js`
  uses.

## The lobby director: held slides and the corner (rebrand stage 4)

The typed slideshow and the check-in queue take turns instead of competing
(the approved mockup's rules; owner, 2026-09-27):

- **Slides that hold check-ins.** A promo poster always holds; so does any
  slide marked "Hold check-ins while this slide is up" (`holdCheckIns: true`,
  `holdsCheckIns()` in `src/lib/slides.js`). While one is up the queue starts
  no run (`hold` in `src/lib/checkInQueue.js`), a WAITING chip counts the
  line, and the celebration queue (doors-open flourish, milestone toasts)
  holds too, because a doors-open flourish names a child. When the held slide
  ends, the waiting children play as one run, each for their full time. A run
  already on screen is never cut off.
- **Names pause the slideshow.** `ManualSlideshow`'s `paused` stops the slide
  timer and KEEPS the time already spent (a video that ends meanwhile waits
  too), so a slide is never skipped or restarted by a rush.
- **A deck can never hold forever.** `special` is only reported for a deck
  that can move on to an ordinary slide (more than one slide, at least one
  not held); unmounting the slideshow reports `special: false`.
- **The stinger.** A change that involves a held slide sweeps a full-screen
  house wave over the lobby and swaps the slides while it covers; ordinary
  changes hand off instead (see the next section). It ends off-screen, so
  `?lowPower=1` never shows it.
- **`holdCheckIns` on the wire** is contract v5's optional slide field, literal
  `true` or absent, never false (printer 6.16.0 publishes it;
  `sanitizeSlidesChunk` and `sanitizeSlides` keep only `true`). Changing it
  means the printer's canonical contract-vectors.json first.
- **Corner info is ONE item at a time** (`src/lib/cornerInfo.js`,
  `useCornerItem`, `CornerChip`): the time or tonight's tally bottom-right,
  the weather top-right, as stepped chips. It moves on at each slide LOAD and
  its value is frozen until the next one (the clock does not tick). The typed
  slideshow reports loads; any other background uses a timer on the slideshow
  delay. It hides on held slides. There is no layout or interval setting any
  more (`widgetDisplayMode` / `cycleIntervalSec` are dropped as unknown keys).
- **Problem indicators are not corner info.** The status sticker (connection,
  printer failures, name faults, layer faults) shows whenever there is a
  problem, on any slide.

## The lobby scene and the slide frame (rebrand stage 4b)

Everything behind the check-in moment is one scene, `src/components/CatalogScene.jsx`,
and one copy frame on it, `src/components/SlideCopy.jsx`: the idle placeholder,
typed slides and calendar slides all use both, and so do the slide editor's
thumbnails (`still`, at `--lobby-u: 16px` in the 1600x900 frame, so a
thumbnail is the TV at 0.15 scale and fits the same way).

- **One persistent studio, only the copy changes.** The field (flat colour,
  two tone-on-tone clouds, white kit doodles, CSS ambient loops that end at
  rest) and the chrome (the orange corner tab with the Awana Clubs mark, the
  sunflower and orange house waves) never remount on a slide change. The
  field crossfades only when two slides want different themes; seasonal skins
  still dress the idle scene (`sceneForSkin` picks its theme, and
  `.stage[data-skin]` prints the season's two offsets behind the idle
  headline). Colours come from `LOBBY_THEMES` in `src/lib/lobbyFrame.js`.
- **An ordinary change is a copy-only hand-off** (`src/lib/lobbyMotion.js`):
  the outgoing kicker, words and chip lift away one after another, the orange
  house wave swells once, then the next kicker, words and chip land, about a
  second end to end. The swell is keyed by a hand-off count and its keyframes
  stay on the wave while the count stands: framer-motion replays a target that
  goes and comes back. A change into or out of a held slide keeps the stinger,
  and everything under it (copy, field, media, chrome) changes in one frame at
  `SWAP_AT` while the wave covers the screen.
- **The chrome steps aside for a poster or a video.** Under the stinger it is
  hidden and brought back by OPACITY at the swap (`chromeMove`), never by a
  transform alone: the app honours the OS's reduced motion, and framer-motion
  then makes every transform instant, delay and all, while opacity keyframes
  still hold, then land, on time. A video that comes or goes on an ordinary
  change slides the tab up and the waves down on the wipe curve.
- **Keyframes, not delays.** Every beat is one "hold, then land" keyframe list
  (`holdThenLand` / `holdThenLeave` / `vanishAtSwap`), never `initial` plus a
  long `delay` (a delayed opacity paints its target early), and the last
  keyframe is always the resting design, which is what `?lowPower=1` shows.
- **The fit (`fitFrame`) measures words in the faces that draw them** and
  never lets the block leave the safe box (u = 1% of the 16:9 stage). Shout
  (uppercase Galindo, `--font-shout`, hard offset shadow): up to three lines
  of at most 68u from 7.2u down to 6u, then up to two lines of 84u down to 5u;
  `lg` caps it at 5.8u, `md` always reads. Otherwise read (sentence-case
  Figtree in the theme's reading ink): balanced rows of at most 76u from 4.2u
  down to 1.5u. The block starts at 15.1u and rises only as far as 11u, and a
  row wider than 45u stops at 14u, clear of the corner tab and the top-right
  stack (which is rem-sized and reaches 13.2u at 1280x720); nothing passes
  45u, clear of the house waves and the bottom chip. Lines break only between
  tokens: words, and the words `Intl.Segmenter` finds in Chinese, Japanese and
  Thai (joined with nothing). The operator's line breaks are kept down to
  1.5u, then run on separated by " · ". A word wider than any line keeps a
  readable size (at least 2.4u) and wraps on rows of its own inside 76u. A
  kicker wraps to two lines before it shrinks below 1.6u and never runs wider
  than 84u. Copy takes its direction from its text (`dir="auto"`).
- **A refit never replays.** Every headline token is one element in both
  layouts, keyed by its place, and the beat sheet is fixed when the copy first
  appears, so a web font landing late only re-lays the same elements out.
- **The calendar's `frame` field is local-only.** `buildCalendarSlides` adds
  `frame` (headline, sub, date chip) for the lobby; `sanitizeSlides` and the
  wire contract never accept it, so a published or typed slide can never
  carry one. Its wording is the calendar's, unchanged.

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

## Self-updating pages

Owner request 2026-09-16: a lobby TV or a projector that has been running for
days should pick up a new deploy on its own, within a few minutes, without
anyone walking over to it, and never in the middle of something a room is
watching.

- **One build identity, three places.** The `serviceWorker()` plugin in
  `vite.config.js` already hashed the emitted filenames for the service
  worker's cache name; that same hash now also lands in `dist/version.json`
  (`{ build, builtAt }`) and in a `<meta name="awana-build">` tag in BOTH
  HTML entries. The tag is how app code learns its own build, read from the
  DOM and never imported, which is what lets the projector page share
  `src/lib/buildReload.js` without breaking its isolation rule. The hash is
  only knowable after rollup names every file, so `transformIndexHtml` writes
  a `__BUILD_HASH__` token and the post-order `generateBundle` swaps it in
  the emitted HTML. HTML files are deliberately excluded from the hashed and
  precached file list, so that token can never move the service worker's
  cache name.
- **No stamp means no poller.** `pageBuild()` is null on the dev server and
  in the hermetic e2e smoke run, and `useBuildReload` then starts no timer at
  all. A missing, non-200 or unparsable `version.json` is likewise "no news",
  never a change: a captive portal answering every URL with a login page must
  not be able to reload the wall.
- **The HTML is checked before reloading.** GitHub Pages serves everything
  with `max-age=600`, so its CDN can still be handing out the previous
  `index.html` minutes after `version.json` has moved on. A reload that
  landed on the old HTML would come straight back and loop, so the page
  fetches its own `location.pathname` first and only reloads when that HTML
  already carries the new hash. Both probes carry
  `?awanaBuild=<Date.now()>`; `src/sw.js` passes anything with that query
  (and `version.json` itself) straight through to the network, because a
  cached answer would pin the screen to the build it already has.
- **Busy means busy, and there is no deadline.** Signage is busy while a
  check-in banner (and so any birthday ribbon riding on it), a celebration or
  doors-open flourish, a visible checkout board, an open Settings / slide
  editor / debug panel, or an event from the last `BUILD_QUIET_MS` is on
  screen. The projector is busy unless `projectorIdle()` says otherwise:
  shutdown is always safe, a countdown still more than `COUNTDOWN_IDLE_MS`
  out is safe (before 5:30 on a club night, and every other day), games and
  slideshows never are. Either page also holds while anything focusable is
  being typed in. A busy page re-asks every `BUILD_BUSY_RECHECK_MS`, for as
  long as it takes: a check-in rush is never interrupted to install a fix.
- Poll every `BUILD_CHECK_MS` (3 minutes) and on the browser's `online`
  event, rate-limited to `BUILD_ONLINE_MIN_MS` because `online` fires in
  bursts on a flaky church connection. Nothing is persisted; two
  `console.warn` lines (update detected, reloading) are the whole trace.
  `location.reload()` keeps `?lowPower=1`, `?key=` and friends.

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
  `src/hooks/useWakeLock.js`, `src/hooks/useBuildReload.js`,
  `src/lib/buildReload.js`, `src/lib/weather.js`, `src/lib/skins.js`,
  `src/components/BirthdayArt.jsx`, and the secret-storage helpers
  `src/hooks/useDisplayLogin.js`, `src/hooks/useDisplayKey.js`,
  `src/lib/displayKey.js` (`maskDisplayKey`) and `src/lib/envelope.js`
  (`isPlausibleKey`). Its realtime data must flow through the sanitized
  socket — never a second Pusher stack; the wake-lock, Open-Meteo
  fetcher, skin table, birthday art, self-update poller and the display
  key / login slots are shared so the two pages can't drift apart (the
  projector page must never grow a second copy of a key slot, and one
  copy of "may this screen reload right now" is the whole point of the
  self-update helper).
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

### The projector in the brand kit (rebrand stage 6)

The approved mockup: the same brand on pure black. The countdown is type
alone, the Awana Clubs mark is back, and the catalog arrives through the
type, the club colours and marks, the stepped chip and the edge waves.

- **How it gets the kit without breaking isolation.** `shared/` belongs to
  the whole family, so the projector reads it the way it already read
  `schedule.json`: `index.css` `@import`s `shared/brand/tokens.css` (bundled
  and hashed at build time, exactly like the lobby's `app.css`), and
  `lib/kit.js` / `lib/motion-tokens.js` import `shared/brand/tokens.json`.
  Fonts are the same `@fontsource` files the lobby bundles (Galindo,
  Londrina Solid 400, Figtree, Baloo 2 as the fallback for letters Galindo
  lacks), so the service worker precaches one copy for both pages and
  nothing is fetched at showtime. The mark and the club wave come in as
  build assets / `?raw` from `shared/brand/`. It never imports
  `src/lib/brand.js`, `src/lib/motion.jsx` or `src/components/brand/*`:
  `src/presentation/isolation.test.js` enforces the whole allowlist, and
  `lib/chip.test.js` pins the projector's own stepped-chip geometry to the
  lobby's so the two cannot drift.
- **Units.** Everything is sized in `--u` (1% of the widest 16:9 frame
  that fits the window) off the mockup, on a centred `.pj-frame`; edge
  waves and the mark use the real screen edges.
- **One headline** (`components/Headline.jsx`, Galindo caps, words never
  broken, `fit` sizes a title to one line by measurement), one kicker
  (Londrina), one body (Figtree), one stepped chip (`StepChip.jsx`, which
  replaced the pill Badge everywhere: game ends / warnings / tally /
  birthdays / theme / upcoming nights / the ESC toast / the resume pill).
- **Timing is the kit's**: `DUR`/`EASE` are the kit table (beat, quick,
  exit, settle, pop, wipe, stinger; four curves) plus the projector's own
  `mode` (view crossfade) and `sweep`. `motion-tokens.test.js` pins CSS to
  JS and both to the kit.
- **The mark is a broadcast logo**: `AwanaMark` renders once in `App.jsx`,
  outside every view, so no slide change or crossfade moves it. It drops
  lower and smaller on game time (clear of the top waves) and fades away
  only for a bare wall: views report it through `onBareChange` (the
  opening's closing blackout, the shutdown idle blackout).
- **Slide changes are the sweep, not the old 3D flip**: every kicker,
  headline word, body word and chip is a PART that inherits its slide's
  `hidden`/`shown`/`gone` variant (`lib/landing.js`, keyframe lists, never
  `initial` + `delay`); the outgoing parts climb away one after another,
  `ColorSweep` crosses the bottom edge once in the six club colours
  (`lib/sweep.js`; ← sweeps the other way) and rests OFF the wall, so
  `?vr=1` / reduced motion never show it; the next parts land after the
  last has left. The pledge clock belongs to the deck, so it holds still.
- **Game time**: the club's deep-behind-colour waves on both edges (the
  far bottom one drifting), the white club mark sized by optical area, the
  headline in the club colour, white figures with club-colour colons, a
  "GAME ENDS / 6:30 PM" chip that becomes "GAME ENDS 6:30 PM / TWO
  MINUTES" (sun figures, orange-deep plate) and "... / LAST 30 SECONDS"
  (hot figures, hot-deep plate), a hot HAPPY BIRTHDAY chip with the cake
  (still no age), and small CHECKED IN chips top-right. T&T is its catalog
  green.
- The countdown's figures are Galindo in fixed 0.70em cells (Galindo has
  no tabular figures; the widest ink, the zero, is 0.688em), clipped top
  and bottom only so the roll never shaves a figure.

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
