import { getAllClubs } from '../lib/clubs.js';

const SAMPLE_NAMES = ['Amelia', 'Noah', 'Olivia', 'Liam', 'Emma', 'Mason', 'Ava', 'Ethan', 'Sophia', 'Lucas'];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export default function DebugPanel({ onSimulate, onClose, status, lastEventAt, pending }) {
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
      </div>
      <button onClick={standard}>Standard welcome</button>
      <button onClick={birthday}>Birthday welcome</button>
      <button onClick={firstTimer}>First-timer welcome</button>
      <button onClick={fiveAtOnce}>Trigger 5 simultaneous</button>
      <button onClick={bigRush}>Trigger 20-kid rush (burst mode)</button>
      <button onClick={everyClub}>Trigger every club</button>
      <button onClick={onClose}>Close</button>
      <span className="close-hint">Toggle with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd></span>
    </div>
  );
}
