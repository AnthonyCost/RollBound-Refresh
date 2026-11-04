import { CONDITIONS, describeCondition } from '@rollbound/rules';
import Icon from './Icon.jsx';

/** A condition's icon (client/scripts/build-icons.js): 'off-guard' is conditionOffGuard. */
export const conditionIcon = (id) => `condition${id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')}`;

function Chip({ id, on, onToggle }) {
  const def = CONDITIONS[id];
  return (
    <button type="button" className="chip condition-chip" aria-pressed={Boolean(on)} title={def.summary(on?.value ?? 1)} onClick={() => onToggle(id)}>
      <Icon name={conditionIcon(id)} size={16} />
      {def.name.toUpperCase()}
      {def.valued && on ? ` ${on.value}` : ''}
    </button>
  );
}

/**
 * The conditions as toggles with their icons: the ones in effect first (tap to raise a
 * valued one, or clear it), then every condition in a list that opens. Tapping adds, raises,
 * and clears after the highest value (the rules' cycleCondition); onToggle gets the id.
 * Used by the Combat tab and the GM's encounter tracker.
 */
export default function ConditionChips({ conditions, onToggle, label = 'Conditions' }) {
  return (
    <div className="condition-chips" role="group" aria-label={label}>
      {conditions.length > 0 ? (
        <div className="condition-row">
          {conditions.map((c) => <Chip key={c.id} id={c.id} on={c} onToggle={onToggle} />)}
        </div>
      ) : (
        <p className="rule-note" style={{ margin: 0 }}>No conditions.</p>
      )}
      <details className="condition-chips__all">
        <summary>Add a condition</summary>
        <div className="condition-chips__grid">
          {Object.keys(CONDITIONS).map((id) => <Chip key={id} id={id} on={conditions.find((c) => c.id === id)} onToggle={onToggle} />)}
        </div>
      </details>
    </div>
  );
}

/** A combatant's conditions as small icons (with their values), for a row in the turn order. */
export function ConditionBadges({ conditions }) {
  if (!conditions?.length) return null;
  return (
    <span className="condition-badges">
      {conditions.map((c) => {
        const { name } = describeCondition(c);
        return (
          <span key={c.id} className="condition-badge" title={name}>
            <Icon name={conditionIcon(c.id)} size={14} />
            {c.value && <small aria-hidden="true">{c.value}</small>}
            <span className="visually-hidden">{name}</span>
          </span>
        );
      })}
    </span>
  );
}
