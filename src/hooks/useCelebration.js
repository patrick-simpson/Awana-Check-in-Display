import { useEffect, useRef } from 'react';

/**
 * Fire a banner's celebration (confetti burst + chime) exactly once per
 * check-in event. The callbacks and the audio flag are read through refs
 * — synced in their own effects — so toggling sound mid-banner, or a
 * parent re-render swapping callback identities, never re-fires the
 * confetti; only a new event id does.
 */
export function useCelebration(eventId, audioEnabled, { confetti, chime }) {
  const audioRef = useRef(audioEnabled);
  const fireRef = useRef({ confetti, chime });

  useEffect(() => {
    audioRef.current = audioEnabled;
  }, [audioEnabled]);
  useEffect(() => {
    fireRef.current = { confetti, chime };
  }, [confetti, chime]);

  useEffect(() => {
    fireRef.current.confetti();
    if (audioRef.current) fireRef.current.chime();
  }, [eventId]);
}
