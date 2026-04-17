import { AnimatePresence } from 'framer-motion';
import WelcomeBanner from './WelcomeBanner.jsx';
import BirthdayBanner from './BirthdayBanner.jsx';
import FirstTimerBanner from './FirstTimerBanner.jsx';

/**
 * Transparent layer that sits over the background iframe and hosts
 * whichever banner variant matches the current event.
 *
 * Priority: birthday > first-timer > standard welcome.
 */
export default function Overlay({ currentEvent, audioEnabled }) {
  return (
    <div className="overlay">
      <AnimatePresence mode="wait">
        {currentEvent && renderBanner(currentEvent, audioEnabled)}
      </AnimatePresence>
    </div>
  );
}

function renderBanner(event, audioEnabled) {
  if (event.isBirthday) {
    return <BirthdayBanner key={event.id} event={event} audioEnabled={audioEnabled} />;
  }
  if (event.isFirstTimer) {
    return <FirstTimerBanner key={event.id} event={event} audioEnabled={audioEnabled} />;
  }
  return <WelcomeBanner key={event.id} event={event} audioEnabled={audioEnabled} />;
}
