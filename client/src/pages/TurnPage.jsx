import { useNavigate } from 'react-router-dom';
import { strikeBonus, damageModifier, describeCondition, landSpeed, CONDITIONS } from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import Ornament from '../components/Ornament.jsx';
import { signed } from '../format.js';

const ACTIONS = [
  { id: 'strike', name: 'Strike' },
  { id: 'stride', name: 'Stride', hint: (c) => `Move up to ${landSpeed(c).total} ft` },
  { id: 'step', name: 'Step', hint: () => 'Move 5 ft without triggering reactions' },
  { id: 'shield', name: 'Raise a Shield', hint: () => '+2 AC until your next turn' },
  { id: 'demoralize', name: 'Demoralize', hint: () => 'Intimidation: frighten a foe' },
  { id: 'interact', name: 'Interact', hint: () => 'Draw, grab, or open something' },
];

function mapNote(n) {
  if (n === 0) return 'First attack this turn: no penalty';
  if (n === 1) return '2nd attack: −5 multiple attack penalty';
  return '3rd+ attack: −10 multiple attack penalty';
}

export default function TurnPage() {
  const navigate = useNavigate();
  const { character, conditions, used, actionsLeft, strikesSoFar, takeAction, strike, endTurn, cycleCondition, resetEncounter, shieldRaised } =
    useTable();

  const weapon = character.weapons[0];
  const next = strikeBonus(character, weapon, { attacksSoFar: strikesSoFar, conditions });
  const condPenalty = next.parts.find((p) => p.note === 'Status penalty from a condition.');
  const outOfActions = actionsLeft <= 0;

  const onAction = (a) => {
    if (a.id === 'strike') {
      if (strike(weapon)) navigate('../roll');
      return;
    }
    takeAction(a);
  };

  return (
    <div className="split">
      <div className="split__col">
      <section className="center" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
        <h1 className="title">{character.name.split(' ')[0]}'s turn</h1>
        <div className="pips" role="img" aria-label={`${actionsLeft} of 3 actions remaining`}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`pip ${i >= used.length ? 'pip--open' : ''}`} />
          ))}
        </div>
        <p className="italic" style={{ margin: 0, color: 'var(--text-soft)' }}>
          {actionsLeft} of 3 actions remain · 1 reaction{shieldRaised ? ' · shield raised' : ''}
        </p>
      </section>

      <section aria-label="Conditions" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="condition-row">
          {Object.entries(CONDITIONS).map(([id, def]) => {
            const active = conditions.find((c) => c.id === id);
            return (
              <button key={id} type="button" className="chip" aria-pressed={!!active} onClick={() => cycleCondition(id, def.valued)}>
                {def.name.toUpperCase()}
                {def.valued && active ? ` ${active.value}` : ''}
              </button>
            );
          })}
        </div>
        {conditions.map((c) => {
          const d = describeCondition(c);
          return (
            <div key={c.id} className="panel panel--hot condition">
              <span className="condition__name">{d.name}</span>
              <span style={{ fontSize: 14 }}>{d.summary}</span>
            </div>
          );
        })}
      </section>

      <section className="panel next-strike">
        <div>
          <div className="eyebrow" style={{ color: 'var(--bronze)' }}>Next Strike · {weapon.name}</div>
          <div className="italic" style={{ color: 'var(--text-soft)' }}>
            {mapNote(strikesSoFar)}
            {condPenalty ? `; ${signed(condPenalty.value)} from ${condPenalty.label}` : ''}
          </div>
        </div>
        <span className="next-strike__value">{signed(next.total)}</span>
      </section>

      </div>
      <div className="split__col">
      <Ornament label="CHOOSE AN ACTION" />

      <div className="actions">
        {ACTIONS.map((a) => (
          <button key={a.id} type="button" className="action" disabled={outOfActions} onClick={() => onAction(a)}>
            <span className="action__name">{a.name}</span>
            <span className="action__hint">
              {a.id === 'strike' ? `${signed(next.total)} to hit · 1d${weapon.die}${damageModifier(weapon, character.abilities) ? signed(damageModifier(weapon, character.abilities)) : ''}` : a.hint(character)}
            </span>
          </button>
        ))}
      </div>

      <section className="panel panel--dashed">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="eyebrow" style={{ color: 'var(--text)' }}>Reaction · Reactive Strike</span>
          <span className="eyebrow" style={{ color: 'var(--bronze)' }}>Ready</span>
        </div>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
          Strike a foe in reach that moves, manipulates, or makes a ranged attack. It doesn't use your 3 actions.
        </p>
      </section>

      <ol className="log" aria-label="This turn">
        {used.length === 0 && <li className="italic" style={{ color: 'var(--text-dim)' }}>Nothing yet. Choose an action above.</li>}
        {used.map((u, i) => (
          <li key={i}>
            {i + 1}. {u.name}
            {u.detail ? ` (${u.detail})` : ''}
          </li>
        ))}
      </ol>

      <div className="btn-row">
        <button type="button" className="btn" onClick={resetEncounter}>Reset</button>
        <button type="button" className="btn btn--blood btn--grow" onClick={endTurn}>End turn</button>
      </div>
      </div>
    </div>
  );
}
