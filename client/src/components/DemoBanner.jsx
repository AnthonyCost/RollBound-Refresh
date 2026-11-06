import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
// How often the banner updates: every 30 seconds, and every 5 in the last minute.
const TICK_MS = 30_000;
const LAST_MINUTE_TICK_MS = 5_000;

function timeLeftLabel(ms) {
  if (ms < MINUTE) return 'in under a minute';
  if (ms < HOUR) {
    const minutes = Math.ceil(ms / MINUTE);
    return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  // To the nearest hour, so a fresh demo says 24, not 25.
  const hours = Math.max(1, Math.round(ms / HOUR));
  return `in ${hours} hour${hours === 1 ? '' : 's'}`;
}

/**
 * The strip under the top bar in a demo: it's temporary, and how long it lasts.
 * In the last hour it turns into a warning that counts down the minutes, and when
 * time's up it checks with the server, which ends the session (see AuthContext).
 */
export default function DemoBanner() {
  const { user, isDemo, logout } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const { pathname } = useLocation();

  const left = isDemo ? new Date(user.demoExpiresAt) - now : Infinity;
  const lastMinute = left < MINUTE;
  useEffect(() => {
    if (!isDemo) return undefined;
    const id = setInterval(() => setNow(Date.now()), lastMinute ? LAST_MINUTE_TICK_MS : TICK_MS);
    return () => clearInterval(id);
  }, [isDemo, lastMinute]);

  useEffect(() => {
    if (left <= 0) api.me().catch(() => {});
  }, [left]);

  if (!isDemo) return null;
  if (left < HOUR) {
    return (
      <p className="demo-banner demo-banner--ending" role="status">
        Your demo ends {timeLeftLabel(Math.max(0, left))} and everything in it is deleted ·{' '}
        {/* Sign-up is for signed-out visitors, so this ends the demo first. A full page
            load, because signing out would otherwise send the app to sign-in first. */}
        <button type="button" className="link-button demo-banner__link" onClick={() => logout().then(() => window.location.assign('/register'))}>
          Create an account
        </button>{' '}
        to keep playing
      </p>
    );
  }
  // The everyday reminder stays off the campaign pages; the last-hour warning above still shows there.
  if (pathname.startsWith('/campaigns')) return null;
  return <p className="demo-banner">Demo mode · this temporary account is deleted when you exit, or {timeLeftLabel(left)}</p>;
}
