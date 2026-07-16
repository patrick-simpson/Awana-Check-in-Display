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
