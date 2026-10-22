import { Link } from 'react-router-dom';
import { degreeRanges } from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import Ornament from '../components/Ornament.jsx';
import { titleCase } from '../format.js';

const DEGREE_COLOR = {
  'critical success': 'var(--deg-crit)',
  success: 'var(--deg-success)',
  failure: 'var(--deg-fail)',
  'critical failure': 'var(--deg-critfail)',
};

const DEGREE_EXPLAIN = {
  'critical success': 'You beat the AC by 10 or more. Your Strike deals double damage.',
  success: 'You met or beat the AC. Your Strike hits for normal damage.',
  failure: 'You missed the AC by less than 10. Your Strike misses.',
  'critical failure': 'You missed the AC by 10 or more. Your Strike misses.',
};

function rangeText(r) {
  if (r.max === null) return `${r.min} or higher`;
  if (r.min === null) return `${r.max} or lower`;
  return `${r.min} – ${r.max}`;
}

function TargetAC() {
  const { targetAC, setTargetAC } = useTable();
  return (
    <div className="panel field">
      <label htmlFor="target-ac">Target AC (ask your GM)</label>
      <input
        id="target-ac"
        type="number"
        inputMode="numeric"
        min="1"
        max="60"
        value={targetAC}
        onChange={(e) => setTargetAC(Number(e.target.value) || 0)}
      />
    </div>
  );
}

export default function RollPage() {
  const { lastRoll, strike, character, actionsLeft } = useTable();

  if (!lastRoll) {
    return (
      <>
        <h1 className="title center" style={{ paddingTop: 16 }}>No roll yet</h1>
        <p className="italic muted center">Choose Strike on your turn and the result lands here, explained.</p>
        <TargetAC />
        <Link to="/turn" className="btn btn--blood">Go to your turn</Link>
      </>
    );
  }

  const { natural, bonus, total, dc, degree, damageRoll, damageMod, damage, weapon, attackNumber } = lastRoll;
  const color = DEGREE_COLOR[degree.name];
  const gemClass =
    degree.name === 'critical success' ? '' : degree.name === 'critical failure' ? 'roll__gem--critfail' : 'roll__gem--plain';
  const natNote =
    natural === 20 ? 'Natural 20: the result moved up one step.' : natural === 1 ? 'Natural 1: the result moved down one step.' : null;

  return (
    <>
      <p className="eyebrow center" style={{ margin: '4px 0 0' }}>
        Strike #{attackNumber} · {weapon.name}
      </p>

      <section className="roll" aria-live="polite">
        <div className={`roll__gem ${gemClass}`}>
          <div className="roll__inner">
            <span className="roll__total">{total}</span>
            <span className="eyebrow" style={{ color }}>Total</span>
          </div>
        </div>
        <div className="roll__math">
          d20 <strong>{natural}</strong> + bonus <strong>{bonus.total}</strong> vs. AC <strong>{dc}</strong>
        </div>
      </section>

      <Ornament />

      <section className="center" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 className="verdict" style={{ color }}>{degree.name}</h1>
        <p className="italic" style={{ margin: 0, color: 'var(--text-soft)' }}>{DEGREE_EXPLAIN[degree.name]}</p>
        {natNote && <p className="italic" style={{ margin: 0, color: 'var(--gold)' }}>{natNote}</p>}
        {damage > 0 && (
          <p className="eyebrow" style={{ color: 'var(--text)', fontSize: 15, margin: '4px 0 0' }}>
            ({damageRoll} + {damageMod}){degree.name === 'critical success' ? ' × 2' : ''} ={' '}
            <span style={{ color: 'var(--blood-text)' }}>{damage} {weapon.damageType}</span>
          </p>
        )}
      </section>

      <section className="panel">
        <h2 className="panel__title">The four degrees of success</h2>
        <div className="ladder">
          {degreeRanges(dc).map((r) => (
            <div
              key={r.name}
              className={`ladder__row ${r.name === degree.name ? 'ladder__row--active' : ''}`}
              style={{ color: DEGREE_COLOR[r.name] }}
            >
              <span className="ladder__gem" />
              <span className="ladder__name">{titleCase(r.name)}</span>
              <span className="ladder__range">{rangeText(r)}</span>
            </div>
          ))}
        </div>
        <p className="italic muted center" style={{ fontSize: 13, margin: '10px 0 0' }}>
          A natural 20 raises the result one step; a natural 1 lowers it one step.
        </p>
      </section>

      <TargetAC />

      <div className="btn-row">
        <button type="button" className="btn btn--grow" disabled={actionsLeft <= 0} onClick={() => strike(character.weapons[0])}>
          Strike again
        </button>
        <Link to="/turn" className="btn btn--blood btn--grow">Back to turn</Link>
      </div>
    </>
  );
}
