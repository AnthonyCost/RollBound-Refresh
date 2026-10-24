import { useState } from 'react';
import { useTable } from '../state/TableContext.jsx';

/** Take damage or heal by an amount; the globe on the sheet follows. */
export default function HpTracker() {
  const { currentHp, maxHp, setHp, hpError } = useTable();
  const [amount, setAmount] = useState('1');
  const n = Math.max(0, Math.floor(Number(amount))) || 0;

  return (
    <section className="panel hp-tracker" aria-labelledby="hp-tracker-title">
      <div className="hp-tracker__head">
        <h2 id="hp-tracker-title" className="panel__title">Hit points</h2>
        <span className="hp-tracker__now">
          {currentHp} / {maxHp}
        </span>
      </div>
      <div className="hp-tracker__row">
        <label className="hp-tracker__amount">
          <span className="visually-hidden">Amount</span>
          <input type="number" inputMode="numeric" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <button type="button" className="btn btn--blood btn--grow" disabled={!n || currentHp === 0} onClick={() => setHp(currentHp - n)}>
          Damage
        </button>
        <button type="button" className="btn btn--grow" disabled={!n || currentHp === maxHp} onClick={() => setHp(currentHp + n)}>
          Heal
        </button>
      </div>
      {currentHp < maxHp && (
        <button type="button" className="link-button hp-tracker__full" onClick={() => setHp(maxHp)}>
          Restore to full
        </button>
      )}
      {hpError && <p className="rule-note rule-note--warn" role="alert">{hpError}</p>}
    </section>
  );
}
