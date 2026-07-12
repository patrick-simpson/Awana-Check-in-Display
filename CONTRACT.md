# Awana Check-in Broadcast Contract v1 (mirror)

**The canonical copy of this contract lives in the printer repo:**
[Print-TwoTimTwo-Labels → print-server/CONTRACT.md](https://github.com/patrick-simpson/Print-TwoTimTwo-Labels/blob/main/print-server/CONTRACT.md).
If you change anything here, update the canonical copy and both repos'
contract tests in the same change.

## Transport

- **Pusher Channels**, channel **`awana-channel`**, event **`checkin`**.
- The display's settings (`pusherAppKey`, `pusherCluster`) must match the
  Pusher app and cluster configured on the print server. The display only
  ever needs the public key — never the secret.
- Consumer code: `src/hooks/useSocket.js` (`sanitize()` enforces the
  payload allowlist).
- Producer code: `print-server/checkin-payload.js` +
  `broadcastCheckin()` in the printer repo.

## Payload — exactly four fields, never more

```json
{ "firstName": "Amelia", "club": "Sparks", "isBirthday": false, "isFirstTimer": true }
```

| Field | Type | Meaning |
|---|---|---|
| `firstName` | string, required, non-empty | Kid's first name (truncated to 40 chars here) |
| `club` | string, optional | Club name; mapped to palettes in `src/lib/clubs.js`, unknown values fall back to Awana orange |
| `isBirthday` | strict boolean | `true` = birthday **week** (the printer computes this from the roster) |
| `isFirstTimer` | strict boolean | `true` = the visitor checkbox was ticked at check-in |

**Privacy invariant — do not relax.** `sanitize()` reduces every incoming
payload to exactly these four fields. Allergy info, last names, contact
info, photos — none of it can ever reach the screen, even if a future
producer starts sending more. The canonical test fixture above is used
verbatim in both repos' contract tests (`src/hooks/useSocket.test.js`
here; `print-server/test/checkin-payload.test.js` in the printer repo).

## Semantics

- One event per successful new label print. The printer suppresses
  duplicates (25-second window), and reprints deliberately do not
  broadcast.
- Pusher does not replay missed events — if the display is offline when an
  event fires, it's gone. The display is a celebration surface, not a
  system of record.
- The print server dashboard's **Test Welcome Screen** button sends
  `{ "firstName": "Test", "club": "Sparks", ... }` for end-to-end pairing
  verification.
