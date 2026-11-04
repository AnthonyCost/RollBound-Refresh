import { useEffect, useState } from 'react';
import { api } from '../api.js';

/** How often players check for the campaign's running encounter (ms). */
const ENCOUNTER_CHECK = 3000;

/**
 * The campaign's running encounter as players see it (no creature stats; see the server's
 * GET /campaigns/:id/encounter), or null. Checks every few seconds, and as soon as the page
 * is shown again; paused while it's hidden. An unchanged answer keeps the same object, so
 * nothing re-renders. enabled: false (no campaign, a read-only sheet) checks nothing.
 */
export function useRunningEncounter(campaignId, enabled = true) {
  const [encounter, setEncounter] = useState(null);
  useEffect(() => {
    setEncounter(null);
    if (!enabled || !campaignId) return undefined;
    let cancelled = false;
    const check = () => {
      if (document.hidden) return;
      api.getRunningEncounter(campaignId).then(
        ({ encounter: next }) => !cancelled && setEncounter((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next)),
        () => {}, // Offline for a moment: keep what we had and try again next time.
      );
    };
    check();
    const timer = setInterval(check, ENCOUNTER_CHECK);
    document.addEventListener('visibilitychange', check);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [campaignId, enabled]);
  return encounter;
}
