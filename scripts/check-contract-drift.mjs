// Guards the event-bus contract mirror. The canonical contract-vectors.json
// lives in the printer repo (Print-TwoTimTwo-Labels — the sole publisher);
// this repo carries a byte-identical mirror that the sanitizer tests run
// against. Drift is created by a *printer-repo* push, which this repo's
// push-triggered CI never sees — hence the weekly cron in ci.yml.
//
// Network trouble (offline runner, raw.githubusercontent outage, moved
// file) warns and exits 0: this check must never block a club-night
// redeploy of the live signage site. A successful fetch that doesn't
// byte-match the mirror exits 1.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const CANONICAL_URL =
  'https://raw.githubusercontent.com/patrick-simpson/Print-TwoTimTwo-Labels/main/contract-vectors.json';
const MIRROR_PATH = fileURLToPath(
  new URL('../src/lib/__fixtures__/contract-vectors.json', import.meta.url),
);

let canonical;
try {
  const res = await fetch(CANONICAL_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  canonical = Buffer.from(await res.arrayBuffer());
} catch (err) {
  console.warn(
    `⚠ Could not fetch the canonical contract-vectors.json (${err.message}).\n` +
      `  ${CANONICAL_URL}\n` +
      '  Skipping the drift check — if the canonical file moved, update\n' +
      '  CANONICAL_URL in scripts/check-contract-drift.mjs.',
  );
  process.exit(0);
}

const mirror = await readFile(MIRROR_PATH);

if (canonical.equals(mirror)) {
  console.log('✓ contract-vectors.json matches the canonical copy byte-for-byte.');
  process.exit(0);
}

console.error(
  '✗ contract-vectors.json has drifted from the canonical copy.\n' +
    `  canonical: ${CANONICAL_URL}\n` +
    '  mirror:    src/lib/__fixtures__/contract-vectors.json\n' +
    '  Re-mirror byte-identically (see CONTRACT.md — canonical changes land\n' +
    '  in the printer repo first):\n' +
    `    curl -fsSL ${CANONICAL_URL} \\\n` +
    '      -o src/lib/__fixtures__/contract-vectors.json\n' +
    '  then re-run: npm test',
);
process.exit(1);
