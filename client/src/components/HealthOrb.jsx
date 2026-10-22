export default function HealthOrb({ current, max }) {
  const pct = Math.max(0, Math.min(1, current / max)) * 100;
  return (
    <div className="orb" role="img" aria-label={`${current} of ${max} hit points`}>
      <div className="orb__fill" style={{ height: `${pct}%` }} />
      <div className="orb__label">
        <span className="orb__hp">{current}</span>
        <span className="orb__max">/ {max} HP</span>
      </div>
    </div>
  );
}
