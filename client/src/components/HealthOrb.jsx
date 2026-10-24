/**
 * Hit points as a globe of blood that fills to match: 10 of 20 is half full.
 * The number inside is current HP; the maximum sits underneath.
 */
export default function HealthOrb({ current, max }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) * 100 : 0;
  return (
    <div className="vitals">
      <div
        className={`orb${current === 0 ? ' orb--down' : pct <= 25 ? ' orb--low' : ''}`}
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
