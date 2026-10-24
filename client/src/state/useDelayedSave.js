import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Saves a value a moment after the last change, so a burst of edits makes one
 * request. Leaving the page (or closing or reloading the tab) sends a change still
 * waiting. Returns [schedule(value), status], where status is 'idle', 'waiting',
 * 'saving', 'saved' or 'error'.
 */
export function useDelayedSave(save, delay) {
  const [status, setStatus] = useState('idle');
  const timer = useRef(null);
  const unsaved = useRef(undefined);
  // The newest save function, so a flush on leaving uses the current character.
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (unsaved.current === undefined) return;
    const value = unsaved.current;
    unsaved.current = undefined;
    setStatus('saving');
    saveRef.current(value).then(
      () => unsaved.current === undefined && setStatus('saved'),
      () => setStatus('error'),
    );
  }, []);

  const schedule = useCallback(
    (value) => {
      unsaved.current = value;
      setStatus('waiting');
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [flush, delay],
  );

  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  return [schedule, status];
}
