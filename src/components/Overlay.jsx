import { AnimatePresence } from 'framer-motion';
import WelcomeBanner from './WelcomeBanner.jsx';
import BirthdayBanner from './BirthdayBanner.jsx';
import FirstTimerBanner from './FirstTimerBanner.jsx';
import WelcomeBackBanner from './WelcomeBackBanner.jsx';

/**
 * Transparent layer that sits over the background iframe and hosts
 * whichever banner variant matches the current event.
 *
 * Priority: birthday > first-timer > welcome-back > standard welcome.
 */
export default function Overlay({ currentEvent, audioEnabled, clubPhrases }) {
  return (
    <div className="overlay">
      <AnimatePresence mode="wait">
        {currentEvent && renderBanner(currentEvent, audioEnabled, clubPhrases)}
      </AnimatePresence>
    </div>
  );
}

function renderBanner(event, audioEnabled, clubPhrases) {
  if (event.isBirthday) {
    return <BirthdayBanner key={event.id} event={event} audioEnabled={audioEnabled} />;
  }
  if (event.isFirstTimer) {
    return <FirstTimerBanner key={event.id} event={event} audioEnabled={audioEnabled} />;
  }
  if (event.welcomeBack) {
    return <WelcomeBackBanner key={event.id} event={event} audioEnabled={audioEnabled} />;
  }
  return <WelcomeBanner key={event.id} event={event} audioEnabled={audioEnabled} clubPhrases={clubPhrases} />;
}
