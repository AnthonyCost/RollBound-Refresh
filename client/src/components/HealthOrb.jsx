import { useEffect, useRef, useState } from 'react';

/** How long the gold glow shows after healing, and the shake after a hit. */
const HEAL_GLOW_MS = 1200;
const HIT_MS = 420;

/**
 * Hit points as a globe of blood that fills to match: 10 of 20 is half full.
 * The number inside is current HP; the maximum sits underneath.
 */
export default function HealthOrb({ current, max }) {
  // A gold glow when hit points go up, a red shake when they go down. Each change swaps
  // between two copies of the animation, which restarts it without remounting the globe.
  const previous = useRef(current);
  const [changes, setChanges] = useState(0);
  const [effect, setEffect] = useState(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = current;
    if (current === before) return undefined;
    const healed = current > before;
    setChanges((n) => n + 1);
    setEffect(healed ? 'healed' : 'hit');
    const id = setTimeout(() => setEffect(null), healed ? HEAL_GLOW_MS : HIT_MS);
    return () => clearTimeout(id);
  }, [current]);

  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) * 100 : 0;
  return (
    <div className="vitals">
      <div
        className={`orb${current === 0 ? ' orb--down' : pct <= 25 ? ' orb--low' : ''}${effect ? ` orb--${effect} orb--${effect}-${changes % 2}` : ''}`}
        role="meter"
        aria-label="Hit points"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={current}
        aria-valuetext={`${current} of ${max} hit points`}
      >
        <div className="orb__fill" style={{ height: `${pct}%` }} />
        <span className="orb__hp">{current}</span>
      </div>
      <span className="vitals__max">
        Max HP <strong>{max}</strong>
      </span>
    </div>
  );
}
