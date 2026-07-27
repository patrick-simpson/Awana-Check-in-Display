# Security & privacy

This app puts a screen in a room full of children and their families. Its whole
security posture rests on one idea: **the display is a consumer of a
deliberately PII-free data feed, and it re-validates that feed rather than
trusting it.**

## The privacy invariant

Every payload arriving on the Pusher channel is reduced to an explicit
allowlist of fields before anything else in the app sees it. The sanitizers live
in [`src/lib/eventSanitizers.js`](src/lib/eventSanitizers.js) and are bound
per-event in [`src/hooks/useSocket.js`](src/hooks/useSocket.js) — one sanitizer
per event type, no shared fallback path.

**First names only, ever.** Allergy information, contact details, last names,
birth years, addresses and photos cannot reach the screen even if the publisher
sends them, because a field that is not on the allowlist is dropped before the
event is dispatched. The typedefs in that file *are* the display's entire data
surface.

Payload shapes are pinned by
[`src/lib/__fixtures__/contract-vectors.json`](src/lib/__fixtures__/contract-vectors.json)
— a byte-identical mirror of the canonical copy in the printer repo — and
enforced by `src/lib/eventSanitizers.test.js`. See [CONTRACT.md](CONTRACT.md).

Two supporting rules:

- **`notice.message` is the only free-text field on the channel.** It is
  church-authored copy intended for public display, so it is shown verbatim by
  design — but it is length-bounded and forced to plain text, and rendered as an
  ordinary React text child. Nothing in this app uses
  `dangerouslySetInnerHTML`.
- **One Pusher stack.** `src/presentation/` may not open a second connection;
  its realtime data must flow through the same sanitized socket. Otherwise a
  second, unsanitized path could appear without anyone noticing.

If you change the socket layer, the sanitizers, or a banner component, preserve
this invariant. It is the only thing standing between a roster and a projector.

## The Pusher channel is public — know what that means

This is the one exposure that is inherent to the design rather than a bug, and
it is worth understanding before you deploy.

The app calls `pusher.subscribe('awana-channel')` — a **public** channel (no
`private-`/`presence-` prefix, no auth endpoint). Because this is a browser app,
the Pusher **App Key** must ship to the client, and the site is deployed to
GitHub Pages. So:

> Anyone who views the page source can take the App Key and subscribe to the
> channel from anywhere in the world.

What such a subscriber can see is exactly what the contract allows:

- each check-in as it happens: **child's first name, club, birthday flag,
  first-timer flag**
- the monthly birthday roster: **first name, club, birthday month and day**
- aggregate counters, club tallies, team points, next-meeting date, and any
  church-authored notice

What they cannot see: last names, allergies, medical or photo-consent flags,
contact details, addresses, birth *years*, or anything else — none of it is on
the channel at all, and the sanitizers would drop it if it were.

For most churches that is an acceptable trade: a stranger learns that a child
named "Ava" attends Sparks on Wednesdays. **Decide consciously whether it is
acceptable for yours**, particularly if any family in your club has a custody or
safeguarding reason to avoid their child's attendance being observable.

### Closing it, if you need to

Making the channel private requires a server-side auth endpoint that signs
subscription requests with the Pusher **secret**, which means introducing a
backend this repo intentionally does not have (`pusher-js` would then be
configured with `authEndpoint`, and the channel renamed to `private-…`). If your
situation requires it, that is the change — a static GitHub Pages deployment
cannot do it alone.

An access-control layer in front of the page (a private network, or Pages behind
SSO on a paid plan) reduces who can *read the screen*, but does not stop someone
who already has the key from subscribing to the channel directly.

## What lives on the device

The Settings panel stores configuration in `localStorage` under
`awanaConfig.v1`, and the "skip weeks" schedule overlay is device-local too.
Every value read back out is re-validated per key (see
`src/hooks/useConfig.js`), so a corrupt or hand-edited entry cannot produce a
broken screen on club night. No roster data is ever persisted — check-in events
are held in memory for the recap window and discarded.

Nothing in this repo requires a deploy secret: the Pages workflow uses GitHub's
own OIDC token.

## Forking this repo

1. **Replace `pusherAppKey` in `src/config.js` with your own church's key**, or
   clear it and use the Settings panel. If you fork a deployed instance and
   leave the key in place, you will subscribe to that church's channel and show
   their children's first names on your screen.
2. **Never add the Pusher `secret` or `app_id`** to this repo. The display only
   ever needs the key and the cluster. The secret belongs on the print server.
3. **Set your own church identity** — `src/presentation/church.config.js` and
   the files under `shared/` carry church-specific names, schedule and slide
   copy.
4. **Keep `contract-vectors.json` byte-identical** with the printer repo's
   canonical copy. It is the shared definition of what may ride the channel; if
   the two drift, the sanitizers stop matching what the publisher sends.
5. **Run `npm test`.** The sanitizer suite is what proves the privacy invariant
   still holds.

## Reporting a vulnerability

Open a GitHub issue for anything non-sensitive. For something that would expose
children's data, contact the repository maintainer directly rather than filing a
public issue.
