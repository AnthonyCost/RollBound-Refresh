import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { degreeRanges } from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import Ornament from '../components/Ornament.jsx';
import Icon from '../components/Icon.jsx';
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
// A check from the sheet (a skill, a save…): what each result means against the DC.
const CHECK_EXPLAIN = {
  'critical success': 'You beat the DC by 10 or more: the best outcome.',
  success: 'You met or beat the DC.',
  failure: 'You fell short of the DC by less than 10.',
  'critical failure': 'You missed the DC by 10 or more: the worst outcome.',
};

// Each roll object gets its own id, so "Strike again" replays the cast even when the numbers repeat.
const rollIds = new WeakMap();
let nextRollId = 0;
function rollId(roll) {
  if (!rollIds.has(roll)) rollIds.set(roll, ++nextRollId);
  return rollIds.get(roll);
}

const TUMBLE_MS = 520;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The die tumbles through random faces, slowing as it goes, then lands on the real total. */
function useTumble(final) {
  const [shown, setShown] = useState(() => (reducedMotion() ? final : Math.ceil(Math.random() * 20)));
  const [landed, setLanded] = useState(reducedMotion);
  useEffect(() => {
    const land = () => { setShown(final); setLanded(true); };
    if (reducedMotion()) return land();
    let frame;
    let last = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = (now - start) / TUMBLE_MS;
      if (t >= 1) return land();
      // Faces change quickly at first, then slower, like a die running out of energy.
      if (now - last > 30 + t * t * 110) {
        last = now;
        setShown(Math.ceil(Math.random() * 20));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [final]);
  return [shown, landed];
}

function RollTotal({ total }) {
  const [shown, landed] = useTumble(total);
  return (
    <span className={`roll__total ${landed ? 'roll__total--landed' : ''}`}>
      <span aria-hidden="true">{shown}</span>
      <span className="visually-hidden">{total}</span>
    </span>
  );
}

// A d20 seen face-on (an icosahedron): a hexagon outline cut into triangular faces, with the
// big middle face holding the total. Faces take the theme's colours through --die-* (theme.css),
// so the die matches every theme and the result (gold for a crit, the crit-fail colour for a fumble).
const D20_FACES = {
  light: ['50,2 8,26 50,18', '50,2 92,26 50,18'],
  side: ['8,26 18,70 50,18', '92,26 82,70 50,18', '8,26 8,74 18,70', '92,26 92,74 82,70'],
  low: ['8,74 18,70 50,98', '18,70 82,70 50,98', '82,70 92,74 50,98'],
};
function D20() {
  return (
    <svg className="roll__die" viewBox="0 0 100 100" aria-hidden="true">
      {Object.entries(D20_FACES).flatMap(([shade, faces]) => faces.map((pts) => <polygon key={pts} className={`roll__die-face roll__die-face--${shade}`} points={pts} />))}
      <polygon className="roll__die-face roll__die-face--front" points="50,18 82,70 18,70" />
    </svg>
  );
}

function rangeText(r) {
  if (r.max === null) return `${r.min} or higher`;
  if (r.min === null) return `${r.max} or lower`;
  return `${r.min} – ${r.max}`;
}

function TargetAC({ what = 'AC' }) {
  const { targetAC, setTargetAC } = useTable();
  return (
    <div className="panel field">
      <label htmlFor="target-ac">{what === 'AC' ? 'Target AC' : 'DC'} (ask your GM)</label>
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

/**
 * The last Strike: the die, the total against the target's AC, what the result means and
 * the damage, then the four degrees of success, the target's AC and Strike again. Laid out
 * as two columns on the Roll page, or stacked in the Combat tab's roll drawer (onBack closes it).
 */
export function RollView({ onBack = null }) {
  const { lastRoll, strike, rollCheck, actionsLeft } = useTable();

  if (!lastRoll) {
    return (
      <div className="narrow">
        <h1 className="title center" style={{ paddingTop: 16 }}>No roll yet</h1>
        <p className="italic muted center">Choose Strike on your turn, and the result shows up here with what it means.</p>
        <TargetAC />
        {!onBack && <Link to="../combat" className="btn btn--blood">Go to the Combat tab</Link>}
      </div>
    );
  }

  const { natural, bonus, total, dc, degree, damageRoll, damageMod, damage, weapon, attackNumber } = lastRoll;
  // A Combat-tab Strike spends an action and counts toward the multiple attack penalty; a check from the sheet doesn't.
  const check = lastRoll.kind === 'check';
  const against = weapon ? 'AC' : 'DC';
  const color = DEGREE_COLOR[degree.name];
  const gemClass =
    degree.name === 'critical success' ? '' : degree.name === 'critical failure' ? 'roll__gem--critfail' : 'roll__gem--plain';
  const id = rollId(lastRoll);
  const degreeClass = `roll--${degree.name.replace(' ', '-')}`;
  const natNote =
    natural === 20 ? 'Natural 20: the result moved up one step.' : natural === 1 ? 'Natural 1: the result moved down one step.' : null;

  return (
    <div className={onBack ? 'roll-view roll-view--stacked' : 'split'}>
      <div className={`split__col roll-cast ${degreeClass}`} key={id}>
      <p className="eyebrow center" style={{ margin: '4px 0 0' }}>
        {check ? lastRoll.label : `Strike #${attackNumber} · ${weapon.name}`}
      </p>

      <section className="roll" aria-live="polite">
        <div className={`roll__gem ${gemClass}`}>
          <D20 />
          <div className="roll__inner">
            <span className="visually-hidden">Total </span>
            <RollTotal total={total} />
          </div>
        </div>
        <div className="roll__math">
          d20 <strong>{natural}</strong> {bonus.total < 0 ? '−' : '+'} bonus <strong>{Math.abs(bonus.total)}</strong> vs. {against} <strong>{dc}</strong>
        </div>
      </section>

      <Ornament />

      <section className="center" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 className="verdict" style={{ color }}>{degree.name}</h1>
        <p className="italic" style={{ margin: 0, color: 'var(--text-soft)' }}>{(weapon ? DEGREE_EXPLAIN : CHECK_EXPLAIN)[degree.name]}</p>
        {natNote && <p className="italic" style={{ margin: 0, color: 'var(--gold)' }}>{natNote}</p>}
        {damage > 0 && (
          <p className="eyebrow roll__damage" style={{ color: 'var(--text)', fontSize: 15, margin: '4px 0 0' }}>
            <span className="roll__damage-die" title={`d${weapon.die}`}><Icon name={`dieD${weapon.die}`} size={20} /></span>
            ({damageRoll} {damageMod < 0 ? '−' : '+'} {Math.abs(damageMod)}){degree.name === 'critical success' ? ' × 2' : ''} ={' '}
            <span style={{ color: 'var(--blood-text)' }}>{damage} {weapon.damageType}</span>
          </p>
        )}
      </section>

      </div>
      <div className="split__col">
      <section className="panel">
        <h2 className="panel__title">The four degrees of success</h2>
        <div className="ladder" key={id}>
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

      <TargetAC what={against} />

      <div className="btn-row">
        {check ? (
          <button type="button" className="btn btn--grow" onClick={() => rollCheck(lastRoll.label, lastRoll.bonus, lastRoll.weapon)}>Roll again</button>
        ) : (
          <button type="button" className="btn btn--grow" disabled={actionsLeft <= 0} onClick={() => strike(lastRoll.weapon)}>
            Strike again
          </button>
        )}
        {onBack ? (
          <button type="button" className="btn btn--blood btn--grow" onClick={onBack}>{check ? 'Close' : 'Back to your turn'}</button>
        ) : (
          <Link to="../combat" className="btn btn--blood btn--grow">Back to your turn</Link>
        )}
      </div>
      </div>
    </div>
  );
}

export default function RollPage() {
  return <RollView />;
}
