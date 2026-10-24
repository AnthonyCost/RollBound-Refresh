import { useEffect, useRef, useState } from 'react';

/** How long the gold glow shows after healing. */
const HEAL_GLOW_MS = 1200;

/**
 * Hit points as a globe of blood that fills to match: 10 of 20 is half full.
 * The number inside is current HP; the maximum sits underneath.
 */
export default function HealthOrb({ current, max }) {
  // A gold glow when hit points go up. Each heal swaps between two copies of the
  // animation, which restarts it without remounting the globe.
  const previous = useRef(current);
  const [heals, setHeals] = useState(0);
  const [glowing, setGlowing] = useState(false);
  useEffect(() => {
    if (current > previous.current) {
      setHeals((n) => n + 1);
      setGlowing(true);
      const id = setTimeout(() => setGlowing(false), HEAL_GLOW_MS);
      previous.current = current;
      return () => clearTimeout(id);
    }
    previous.current = current;
  }, [current]);

  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) * 100 : 0;
  return (
    <div className="vitals">
      <div
        className={`orb${current === 0 ? ' orb--down' : pct <= 25 ? ' orb--low' : ''}${glowing ? ` orb--healed orb--healed-${heals % 2}` : ''}`}
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
