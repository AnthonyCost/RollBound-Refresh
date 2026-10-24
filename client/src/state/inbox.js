// Tells open screens the inbox or a join request changed, so the badge and the
// campaign page refresh without a reload.
const EVENT = 'rollbound:inbox-changed';

export const inboxChanged = () => window.dispatchEvent(new Event(EVENT));

/** Calls fn whenever the inbox changes. Returns the cleanup for useEffect. */
export function onInboxChanged(fn) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
