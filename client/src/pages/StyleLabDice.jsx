import { useState } from 'react';
import { Die, DieShape, TUMBLE_MS, dieTextAt, useTumble } from '../components/Dice.jsx';

const SIDES = [4, 6, 8, 10, 12, 20, 100];
const rollOf = (sides) => ({ value: Math.ceil(Math.random() * sides), id: Math.random() });

/** One die in a box, rolled as the roller rolls it; a new roll remounts it so the spin starts over. */
function DieBox({ sides }) {
  const [roll, setRoll] = useState(() => rollOf(sides));
  return (
    <button type="button" className="panel lab-die roll-cast" onClick={() => setRoll(rollOf(sides))} aria-label={`Roll a d${sides}`}>
      <span className="eyebrow">d{sides}</span>
      {sides === 100 ? (
        <Die key={roll.id} sides={100} value={roll.value} size={92} tumble={TUMBLE_MS} />
      ) : (
        <Gem key={roll.id} sides={sides} value={roll.value} />
      )}
      <span className="visually-hidden" aria-live="polite">Rolled {roll.value}</span>
    </button>
  );
}

/** A die as the roller shows it; on the d20 a natural 20 or 1 flares gold or shakes red as it lands. */
function Gem({ sides, value }) {
  const [shown, landed] = useTumble(value, sides);
  const nat = sides === 20 && landed ? { 20: 'roll__gem--nat20', 1: 'roll__gem--critfail roll__gem--nat1' }[value] : null;
  return (
    <span className={`roll__gem ${nat ?? 'roll__gem--plain'}`}>
      <DieShape sides={sides} className="roll__die" spin={TUMBLE_MS} />
      <span className="roll__inner" style={dieTextAt(sides)}>
        <span className={`roll__total ${landed ? 'roll__total--landed' : ''}`} aria-hidden="true">{shown}</span>
      </span>
    </span>
  );
}

/** Every die, each in a box you click to roll, to see how they look and land in the current theme. */
export default function StyleLabDice() {
  return (
    <div className="lab-dice">
      {SIDES.map((s) => <DieBox key={s} sides={s} />)}
    </div>
  );
}
