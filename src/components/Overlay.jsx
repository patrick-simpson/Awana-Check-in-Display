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
 *
 * `birthdayRibbon` is the "Birthday this Friday!" label from
 * src/lib/birthdayWeek.js, or null. It rides BOTH the birthday and the
 * standard banner: the printer's `isBirthday` flag is true for the whole
 * ISO week, so a child whose birthday is Friday reaches BirthdayBanner on
 * Wednesday and the ribbon is what keeps that banner honest. First-timer
 * and welcome-back are deliberately left out — `isBirthday` is tested
 * first, so a rostered child never reaches them, and a genuine first-timer
 * has no roster row to match anyway.
 */
export default function Overlay({ currentEvent, audioEnabled, clubPhrases, birthdayRibbon }) {
  return (
    <div className="overlay">
      <AnimatePresence mode="wait">
        {currentEvent && renderBanner(currentEvent, audioEnabled, clubPhrases, birthdayRibbon)}
      </AnimatePresence>
    </div>
  );
}

function renderBanner(event, audioEnabled, clubPhrases, ribbon) {
  if (event.isBirthday) {
    return <BirthdayBanner key={event.id} event={event} audioEnabled={audioEnabled} ribbon={ribbon} />;
  }
  if (event.isFirstTimer) {
    return <FirstTimerBanner key={event.id} event={event} audioEnabled={audioEnabled} />;
  }
  if (event.welcomeBack) {
    return <WelcomeBackBanner key={event.id} event={event} audioEnabled={audioEnabled} />;
  }
  return (
    <WelcomeBanner
      key={event.id}
      event={event}
      audioEnabled={audioEnabled}
      clubPhrases={clubPhrases}
      ribbon={ribbon}
    />
  );
}
