import { useEffect, useState } from 'react';
import { loadRules } from './rulesData.js';

/**
 * The rules data for some types, e.g. useRules(['spells']). Returns null while it
 * loads, or { error } if it couldn't. types must be a constant, not a new array
 * each render.
 */
export function useRules(types) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    loadRules({ types }).then(
      (d) => !cancelled && setData(d),
      () => !cancelled && setData({ error: true }),
    );
    return () => {
      cancelled = true;
    };
  }, [types]);
  return data;
}
