import { getAllClubs } from '../lib/clubs.js';

// Obviously-fake names only: a simulated banner on the lobby TV must
// never look like (or match) a real kid checking in.
const SAMPLE_NAMES = ['Test Kid', 'Demo Kid', 'Sample Star', 'Pretend Pal', 'Practice Run'];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export default function DebugPanel({
  onSimulate, onSimulateRecap, onSimulateOps, onClose,
  status, lastEventAt, pending, phase, seenStats, opsFailures, wakeLockStatus,
}) {
  const standard = () => onSimulate({
    firstName: pick(SAMPLE_NAMES),
    club: pick(getAllClubs()),
  });

  const birthday = () => onSimulate({
    firstName: pick(SAMPLE_NAMES),
    club: pick(getAllClubs()),
    isBirthday: true,
  });

  const firstTimer = () => onSimulate({
    firstName: pick(SAMPLE_NAMES),
    club: pick(getAllClubs()),
    isFirstTimer: true,
  });

  const fiveAtOnce = () => {
    for (let i = 0; i < 5; i++) {
      onSimulate({ firstName: pick(SAMPLE_NAMES), club: pick(getAllClubs()) });
    }
  };

  // Simulates the after-dinner carpool wave — proves burst mode keeps
  // the queue moving when 20 kids scan in seconds.
  const bigRush = () => {
    for (let i = 0; i < 20; i++) {
      onSimulate({ firstName: pick(SAMPLE_NAMES), club: pick(getAllClubs()) });
    }
  };

  const everyClub = () => {
    for (const club of getAllClubs()) {
      onSimulate({ firstName: pick(SAMPLE_NAMES), club });
    }
  };

  // A recap the way the printer would send it: fresh ids, recent
  // timestamps — proves the quiet "also joined us" replay path.
  const recap = () => onSimulateRecap?.({
    entries: Array.from({ length: 3 }, (_, i) => ({
      id: `debug-recap-${Date.now()}-${i}`,
      at: Date.now() - (i + 1) * 60 * 1000,
      firstName: pick(SAMPLE_NAMES),
      club: pick(getAllClubs()),
      isBirthday: false,
      isFirstTimer: false,
    })),
    at: Date.now(),
  });

  const printFailure = () => onSimulateOps?.({
    type: 'print-failure',
    club: pick(getAllClubs()),
    at: Date.now(),
  });

  const seen = seenStats?.() ?? { size: 0 };

  return (
    <div className="debug">
      <h3>Debug · Simulate check-ins</h3>
      <div className="debug-stats">
        <span>pusher: {status ?? 'unknown'}</span>
        <span>
          last event: {lastEventAt
            ? new Date(lastEventAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
            : 'none'}
        </span>
        <span>queued: {pending ?? 0}</span>
        <span>phase: {phase ?? 'unknown'}</span>
        <span>seen ids: {seen.size}</span>
        <span>printer problems: {opsFailures?.length ?? 0}</span>
        <span>wake lock: {wakeLockStatus ?? 'unknown'}</span>
      </div>
      <button onClick={standard}>Standard welcome</button>
      <button onClick={birthday}>Birthday welcome</button>
      <button onClick={firstTimer}>First-timer welcome</button>
      <button onClick={fiveAtOnce}>Trigger 5 simultaneous</button>
      <button onClick={bigRush}>Trigger 20-kid rush (burst mode)</button>
      <button onClick={everyClub}>Trigger every club</button>
      {onSimulateRecap && <button onClick={recap}>Simulate recap replay (quiet banners)</button>}
      {onSimulateOps && <button onClick={printFailure}>Simulate print failure (ops)</button>}
      <button onClick={onClose}>Close</button>
      <span className="close-hint">Toggle with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd></span>
    </div>
  );
}
