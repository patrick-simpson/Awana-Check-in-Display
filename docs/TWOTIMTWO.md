# TwoTimTwo integration — display side

**How the signage + presentation apps relate to TwoTimTwo.com, and the
design decisions that a future change must not accidentally undo.**

This repo **never talks to TwoTimTwo directly.** The print server
(`Print-TwoTimTwo-Labels`) is the *only* producer on the shared Pusher
channel; both pages here are subscribe-only consumers. The canonical, scraped
map of the TwoTimTwo site itself (DOM contract, `/clubber/csv` columns, every
endpoint) lives in that repo at **`docs/TWOTIMTWO.md`** and its in-app
Capabilities & Roadmap page. This file is the display-side companion.

> **Privacy invariant (do not relax):** everything crossing the channel is
> reduced to an allowlist by `src/lib/eventSanitizers.js` before anything sees
> it — first names only, ever. No last names, allergies, contact info, birth
> years, or photos. The shapes are pinned by
> `src/lib/__fixtures__/contract-vectors.json`, which is **byte-identical** to
> the printer repo's canonical `contract-vectors.json` (verified 2026-07-26).

---

## 1. The event contract we consume

Channel `awana-channel`. Each event is reduced to exactly these fields
(`src/lib/eventSanitizers.js`); anything else is dropped before the app sees it.

| Event | Allowlisted fields | Drives |
|---|---|---|
| `checkin` | `firstName`, `club`, `isBirthday`, `isFirstTimer` (+ optional `id`, `at`) | the live check-in celebration banner |
| `recap` | `entries[]` (verbatim checkin shapes with `id`+`at`) | replay of missed check-ins after a reconnect |
| `tally` | `counts` (per-club whole numbers), `total` | game-time scoreboard counts |
| `birthdays` | `entries[]` of `firstName`, `club`, `month` (1–12), `day` (1–31) — **never a year** | this-week birthday celebration |
| `ops` | `type` (`print-failure`\|`canary`\|`selector-fail`), optional `club` | operator status widgets only — never a public banner |
| `canary` | `at`, optional `nonce` | "is the pipe alive" end-to-end test |

Club names arrive **exactly as the check-in system reports them** — e.g.
`"Sparks "` (trailing space), `"T&T"` (the extension decodes `&amp;`). Each
consumer normalizes on its own:
- **Signage:** `src/lib/clubs.js` `getClubPalette()` — trims, lowercases,
  alias-maps, and covers **all six** clubs (Puggles, Cubbies, Sparks, T&T,
  Trek, Journey) with full art; unknown clubs fall back to Awana-orange so a
  typo still yields a joyful banner.
- **Presentation:** `src/presentation/lib/birthdays.js` `normalizeClub()` —
  see the scope note below.

---

## 2. Deliberate design decision: the presentation tool is 4-club scoped

**Do not "fix" this by adding Trek/Journey — it is intentional and tested.**

The presentation/countdown tool's **game-time scoreboard** and **birthday
celebration** cover only the four younger clubs that are in the room during
game time: `puggles, cubbies, sparks, tnt`. This scope is baked in coherently
across several places — changing one without the others breaks the app:

- `src/presentation/config.js` and `src/presentation/lib/shared-config.js`:
  `CLUB_IDS = ['puggles', 'cubbies', 'sparks', 'tnt']`.
- `normalizeClub()` returns `null` for Trek/Journey (asserted by
  `birthdays.test.js`); `useBirthdays.js` gates on `e.club in CLUBS`;
  `GameTimeView.jsx` filters birthdays/counts by `gameWindow.clubs`.

`shared/theme.json` **does** define all six clubs (Trek/Journey included) so the
signage banner can theme them — the palette is shared, the *celebration scope*
is not. Trek and Journey (grades 6–8 and 9–10, TwoTimTwo `club_id` 6 and 7) are
teen clubs that typically meet outside the main-room game time.

If the church ever wants teens in the game-time scoreboard or birthday reel,
that's a **product decision**, not a bug — see roadmap item D-4 below. It must
be made in all of: `CLUB_IDS` (both files), `normalizeClub` (+ its tests),
`useBirthdays` gate, and the relevant `gameWindow.clubs` in `shared/schedule.json`.

---

## 3. Display-side future possibilities

Grounded in real TwoTimTwo endpoints discovered in the site map (see the
printer repo's `docs/TWOTIMTWO.md` §5–6). All flow through the print server as
the sole Pusher producer, keeping the privacy invariant intact.

| # | Idea | Source | Notes |
|---|---|---|---|
| D-1 | **Lobby "tonight" ticker** | `/meeting/report?output=csv` | totals of kids in, books completed, awards earned, bring-a-friend count. New event type (`tonight`?) or fold into `tally`. First-name-only if any names appear. |
| D-2 | **Color-group points scoreboard** | `/meeting/colorGroup` | team points race — a rotating game-time board. Pure numbers, zero PII. |
| D-3 | **iCal-driven "next meeting" banner** | `/calendar/iCal` | the countdown/schedule engine could learn the real next meeting date (and "No Awana this week") from the authoritative feed instead of only `shared/schedule.json`. Highest-risk area — gate behind the schedule engine's test suite. |
| D-4 | **Extend celebration to Trek/Journey** | n/a (config) | if desired; see §2 for every place that must change together. |
| D-5 | **Cancellation alert** | `/msg/admin` | mirror a church cancellation notice as a full-screen "CLUB CANCELLED TONIGHT" slide. |

Any feature that would surface a child's photo must gate on the roster's
`Photo Release?` value (see the printer repo) — but note nothing photo-related
can cross the current sanitized channel, and it must stay that way.
