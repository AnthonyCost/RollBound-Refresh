/**
 * A combatant's turn at a glance: 3 actions and 1 reaction, dimmed once spent. entry is
 * { used: 0–3, reaction: bool } (the encounter's actions; missing means all fresh). With
 * onChange (the GM's tracker) each pip is a button: an action pip sets how many are spent
 * (tap the last spent one to give it back), the reaction pip toggles.
 */
export default function ActionPips({ name, entry, onChange = null }) {
  const used = entry?.used ?? 0;
  const reaction = entry?.reaction ?? false;
  const summary = `${3 - used} of 3 actions left, reaction ${reaction ? 'used' : 'ready'}`;
  if (!onChange) {
    return (
      <span className="action-pips" role="img" aria-label={`${name}: ${summary}`}>
        {[0, 1, 2].map((i) => <span key={i} className={`action-pip ${i < used ? 'action-pip--spent' : ''}`}><span className="act act--1" /></span>)}
        <span className={`action-pip action-pip--reaction ${reaction ? 'action-pip--spent' : ''}`}><span className="act act--r" /></span>
      </span>
    );
  }
  return (
    <span className="action-pips" role="group" aria-label={`${name}: ${summary}`}>
      {[0, 1, 2].map((i) => (
        <button
          key={i}
          type="button"
          className={`action-pip ${i < used ? 'action-pip--spent' : ''}`}
          aria-label={`${name}: ${i + 1} action${i ? 's' : ''} spent`}
          aria-pressed={i < used}
          onClick={() => onChange({ used: used === i + 1 ? i : i + 1, reaction })}
        >
          <span className="act act--1" />
        </button>
      ))}
      <button
        type="button"
        className={`action-pip action-pip--reaction ${reaction ? 'action-pip--spent' : ''}`}
        aria-label={`${name}: reaction used`}
        aria-pressed={reaction}
        onClick={() => onChange({ used, reaction: !reaction })}
      >
        <span className="act act--r" />
      </button>
    </span>
  );
}
