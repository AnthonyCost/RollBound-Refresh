import { useState } from 'react';
import { useTable } from '../state/TableContext.jsx';

/**
 * The equipped shield's Hit Points: Shield Block an attack (its Hardness stops part of
 * the damage, and the shield and you each take the rest) or repair it.
 */
export default function ShieldTracker() {
  const { shield, setShieldDamage } = useTable();
  const [amount, setAmount] = useState('1');
  const [last, setLast] = useState(null);
  if (!shield) return null;
  const n = Math.max(0, Math.floor(Number(amount))) || 0;
  const damage = shield.max - shield.current;

  const block = () => {
    const through = Math.max(0, n - shield.hardness);
    setShieldDamage(damage + through);
    setLast(
      through
        ? `Hardness ${shield.hardness} stopped ${n - through}. ${shield.name} and you each take ${through}.`
        : `Hardness ${shield.hardness} stopped all ${n} damage.`,
    );
  };
  const repair = (by) => {
    setShieldDamage(Math.max(0, damage - by));
    setLast(null);
  };

  return (
    <section className="panel hp-tracker" aria-labelledby="shield-tracker-title">
      <div className="hp-tracker__head">
        <h2 id="shield-tracker-title" className="panel__title">{shield.name}</h2>
        <span className="hp-tracker__now">
          {shield.current} / {shield.max}
        </span>
      </div>
      <div className="hp-tracker__row">
        <label className="hp-tracker__amount">
          <span className="visually-hidden">Damage from the attack</span>
          <input type="number" inputMode="numeric" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <button type="button" className="btn btn--blood btn--grow" disabled={!n || shield.destroyed} onClick={block}>
          Shield Block
        </button>
        <button type="button" className="btn btn--grow" disabled={!n || !damage} onClick={() => repair(n)}>
          Repair
        </button>
      </div>
      <p className="rule-note" role="status" style={{ margin: 0 }}>
        {last ?? `Enter the attack's damage and Shield Block: Hardness ${shield.hardness} stops part of it, and the shield and you each take the rest.`}
      </p>
      {shield.destroyed ? (
        <p className="rule-note rule-note--warn" style={{ margin: 0 }}>Destroyed. It can't be repaired; you'll need a new shield.</p>
      ) : shield.broken ? (
        <p className="rule-note rule-note--warn" style={{ margin: 0 }}>Broken: at {shield.brokenAt} Hit Points or fewer it can't be raised or used to block until it's repaired.</p>
      ) : null}
      {damage > 0 && !shield.destroyed && (
        <button type="button" className="link-button hp-tracker__full" onClick={() => repair(damage)}>
          Repair fully
        </button>
      )}
    </section>
  );
}
