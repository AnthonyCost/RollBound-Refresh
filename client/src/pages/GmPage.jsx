import { useMemo, useState } from 'react';
import { rateEncounter, dcByLevel, rollDie } from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import Ornament from '../components/Ornament.jsx';

const SHORT = { trivial: 'Trivial', low: 'Low', moderate: 'Mod', severe: 'Severe', extreme: 'Extreme' };

const START = [
  { id: 'w1', name: 'Wolf A', kind: 'creature', level: 1, init: 22, hp: 14, maxHp: 24, note: 'Off-Guard' },
  { id: 'pc', name: null, kind: 'pc', init: 21 },
  { id: 'theo', name: 'Theo · Cleric', kind: 'ally', init: 17 },
  { id: 'w2', name: 'Wolf B', kind: 'creature', level: 1, init: 15, hp: 24, maxHp: 24 },
  { id: 'sel', name: 'Sel · Rogue', kind: 'ally', init: 14 },
  { id: 'bram', name: 'Bram · Wizard', kind: 'ally', init: 9 },
];

export default function GmPage() {
  const { character, conditions } = useTable();
  const [combatants, setCombatants] = useState(START);
  const [active, setActive] = useState(1);
  const [partySize, setPartySize] = useState(4);

  const partyLevel = character.level;
  const order = useMemo(() => [...combatants].sort((a, b) => b.init - a.init), [combatants]);
  const creatures = combatants.filter((c) => c.kind === 'creature');
  const rating = rateEncounter(creatures.map((c) => ({ level: c.level })), partyLevel, partySize);
  const tierIndex = rating.budgets.findIndex((b) => b.name === rating.threat);

  const addCreature = () => {
    const n = creatures.length + 1;
    setCombatants((list) => [
      ...list,
      { id: `c${Date.now()}`, name: `Creature ${n}`, kind: 'creature', level: partyLevel, init: rollDie(20) + 5, hp: 20, maxHp: 20 },
    ]);
  };

  const pcLabel = `${character.name.split(' ')[0]} · ${character.className}`;
  const pcSub = conditions.length
    ? conditions.map((c) => (c.value ? `${c.id[0].toUpperCase()}${c.id.slice(1)} ${c.value}` : c.id)).join(', ')
    : null;

  return (
    <>
      <h1 className="title center" style={{ paddingTop: 8 }}>Wolves at the Ford</h1>

      <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="eyebrow" style={{ margin: 0, color: 'var(--bronze)', letterSpacing: 3 }}>Encounter budget</h2>
          <label className="italic muted" style={{ fontSize: 14 }}>
            <select
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
              style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)', marginRight: 6 }}
              aria-label="Party size"
            >
              {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            heroes · level {partyLevel}
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="stat__value" style={{ fontSize: 28 }}>{rating.xp ?? '—'} XP</span>
          <span className="eyebrow" style={{ color: 'var(--blood-text)', fontSize: 14 }}>{rating.threat}</span>
        </div>
        <div className="budget-bar" aria-hidden="true">
          {rating.budgets.map((b, i) => <div key={b.name} className={i <= tierIndex || tierIndex === -1 ? 'filled' : ''} />)}
        </div>
        <div className="budget-labels">
          {rating.budgets.map((b) => (
            <span key={b.name} className={b.name === rating.threat ? 'current' : ''} title={`${b.name}: ${b.budget} XP`}>
              {SHORT[b.name]}<br />{b.budget}
            </span>
          ))}
        </div>
        <p className="italic muted" style={{ margin: 0, fontSize: 13 }}>
          A creature of the party's level is worth 40 XP. Each level above or below changes that.
        </p>
      </section>

      <Ornament label="INITIATIVE" />

      <ol className="initiative">
        {order.map((c, i) => (
          <li key={c.id} className={`combatant ${i === active ? 'combatant--active' : ''}`} aria-current={i === active ? 'true' : undefined}>
            <span className="combatant__init">{c.init}</span>
            <div className="combatant__body">
              <span className="combatant__name">{c.kind === 'pc' ? pcLabel : c.name}</span>
              {i === active && <span className="combatant__sub">Acting now{c.kind === 'pc' && pcSub ? ` · ${pcSub}` : ''}</span>}
              {i !== active && c.note && <span className="combatant__sub" style={{ color: 'var(--blood-text)' }}>{c.note}</span>}
            </div>
            {c.kind === 'creature' ? (
              <span style={{ fontSize: 14, color: 'var(--text-soft)' }}>HP {c.hp}/{c.maxHp}</span>
            ) : (
              <span className="combatant__tag">HERO</span>
            )}
          </li>
        ))}
      </ol>

      <section className="panel panel--dashed" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-soft)' }}>
          A level {partyLevel} challenge is <strong className="breakdown__value" style={{ color: 'var(--text)' }}>DC {dcByLevel(partyLevel)}</strong>
        </span>
      </section>

      <div className="btn-row">
        <button type="button" className="btn" onClick={addCreature}>Add creature</button>
        <button type="button" className="btn btn--blood btn--grow" onClick={() => setActive((a) => (a + 1) % order.length)}>
          Next turn
        </button>
      </div>
    </>
  );
}
