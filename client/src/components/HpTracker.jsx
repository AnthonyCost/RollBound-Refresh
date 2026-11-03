import { useEffect, useState } from 'react';
import { useTable } from '../state/TableContext.jsx';

/**
 * Heal or take damage by an amount, as a stack beside the health orb in the sheet's
 * header: Heal, the amount, Damage. With a shield that can still block, Damage first asks
 * whether to Shield Block: yes, and its Hardness stops part of the hit and the shield and
 * you each take the rest; no, and you take all of it.
 */
export default function HpTracker() {
  const { currentHp, maxHp, setHp, shield, shieldBlock } = useTable();
  const [amount, setAmount] = useState('1');
  const [asking, setAsking] = useState(false);
  const n = Math.max(0, Math.floor(Number(amount))) || 0;
  const canBlock = Boolean(shield && !shield.broken);
  const stopped = canBlock ? Math.min(n, shield.hardness) : 0;
  const through = n - stopped;

  useEffect(() => {
    if (!asking) return undefined;
    const esc = (e) => e.key === 'Escape' && setAsking(false);
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [asking]);

  const damage = () => (canBlock ? setAsking(true) : setHp(currentHp - n));
  const block = () => {
    shieldBlock(n);
    setAsking(false);
  };
  const takeIt = () => {
    setHp(currentHp - n);
    setAsking(false);
  };

  return (
    <>
      <div className="hp-tracker" role="group" aria-label="Change hit points">
        <button type="button" className="hp-tracker__btn hp-tracker__btn--heal" disabled={!n || currentHp === maxHp} onClick={() => setHp(currentHp + n)}>
          Heal
        </button>
        <label className="hp-tracker__amount">
          <span className="visually-hidden">Amount</span>
          <input type="number" inputMode="numeric" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <button type="button" className="hp-tracker__btn hp-tracker__btn--damage" disabled={!n || (currentHp === 0 && !canBlock)} aria-expanded={canBlock ? asking : undefined} onClick={damage}>
          Damage
        </button>
      </div>

      {asking && canBlock && (
        <div className="confirm hp-block" role="alertdialog" aria-labelledby="hp-block-q" aria-describedby="hp-block-math">
          <p id="hp-block-q" className="hp-block__q">Block with your {shield.name}?</p>
          <p id="hp-block-math" className="hp-block__math">
            Hardness {shield.hardness} stops {stopped} of the {n} damage
            {through ? <>, then the shield and you each take <strong>{through}</strong>.</> : ', so neither of you takes any.'}
          </p>
          <p className="rule-note hp-block__note">Shield Block works against physical damage from an attack, with your shield raised.</p>
          <div className="btn-row">
            <button type="button" className="btn btn--blood btn--grow" autoFocus onClick={block}>Yes, block</button>
            <button type="button" className="btn btn--grow" onClick={takeIt}>No, take all {n}</button>
          </div>
        </div>
      )}
    </>
  );
}
