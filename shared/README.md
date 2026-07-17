# Shared Awana data (`/shared/`)

> **Transition note:** this is a copy of the `shared/` directory in
> **KVBC-Awana-Countdown**, which remains the *canonical* host until the
> presentation-tool migration completes and that repo is retired. Until
> then, edit schedule/theme data in KVBC-Awana-Countdown first and mirror
> it here. Both Pages sites serve identical files during the transition.

This directory is the **single source of truth** for data consumed by all
three KVBC Awana apps. It is copied into `dist/shared/` at build time and
served by GitHub Pages at:

    https://<owner>.github.io/KVBC-Awana-Countdown/shared/schedule.json
    https://<owner>.github.io/KVBC-Awana-Countdown/shared/theme.json
    https://<owner>.github.io/KVBC-Awana-Countdown/shared/art/<file>.png

Consumers:

- **KVBC-Awana-Countdown** (this repo) — imports both JSONs at build time
  (`src/lib/shared-config.ts` validates them; a bad file fails lint/test/build
  before it can deploy).
- **Awana-Check-in-Display** — fetches both at runtime with a localStorage
  cache and baked-in fallbacks.
- **Print-TwoTimTwo-Labels** — fetches `schedule.json` at server startup for
  club-night windows and late check-in routing defaults.

## `schedule.json` (v1)

```jsonc
{
  "version": 1,
  "timezone": "America/New_York",     // informational; times are local wall-clock
  "meeting": { "day": 3, "start": "18:00" },  // 0=Sun … 6=Sat
  "windows": [
    // Gap-free evening. kinds: "slideshow" (needs deck: opening|closing),
    // "game" (needs clubs: [club ids]), "shutdown".
    { "kind": "game", "clubs": ["tnt"], "title": "T&T Game Time", "start": "18:05", "end": "18:30" }
  ],
  "specialDates": {
    // Either cancel a night…
    "2026-11-25": { "noClub": true, "label": "Thanksgiving Break" },
    // …or fully REPLACE the window table for one date (no partial patches):
    "2026-12-16": { "label": "Store Night", "windows": [ /* same shape as windows */ ] }
  }
}
```

Times are `"HH:MM"` local wall-clock strings. A `specialDates` key is a local
`YYYY-MM-DD` date. A replacement table applies on that date even if it is not
the normal meeting day.

## `theme.json` (v1)

Per-club identity: display `name`, `color` (hex), `aliases` (lowercase
spellings other systems may send), and `art` paths **relative to this
directory's URL**. `"monochrome": true` marks black-ink logos (Trek, Journey)
that consumers must invert or recolor on dark backgrounds.

The four scheduled-club colors are mirrored in `src/index.css`
(`--color-club-*`); `src/lib/shared-config.test.ts` fails if they drift.

## Versioning

`version` is bumped only on breaking shape changes. Additive fields are fine
without a bump. When bumping, update all three consumer repos in the same
change set — the contract vectors in each repo pin these shapes.
