/** A row of toggle chips. `isOn`, `isDisabled` and `note` take an option value. */
// For a single choice, pass `pick(current, set)` as onToggle so clicking the chosen chip clears it.
export const pick = (current, set) => (o) => set(current === o ? null : o);

export default function Chips({ options, isOn, isDisabled = () => false, onToggle, render = (o) => o, label }) {
  return (
    <div className="condition-row" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" className="chip" aria-pressed={isOn(o)} disabled={isDisabled(o)} onClick={() => onToggle(o)}>
          {render(o)}
        </button>
      ))}
    </div>
  );
}
