import { signed } from '../format.js';

/** Shows a { total, parts } stat from the rules engine as labeled math. */
export default function Breakdown({ title, stat, signTotal = true }) {
  return (
    <section className="panel" aria-live="polite">
      <h2 className="panel__title">{title}</h2>
      <div className="breakdown">
        {stat.parts.map((p, i) => (
          <div key={`${p.label}-${i}`} className="breakdown__group">
            <div className="breakdown__row">
              <span className="breakdown__label">{p.label}</span>
              <span className="breakdown__value">{p.label === 'Base' ? p.value : signed(p.value)}</span>
            </div>
            {p.note && (
              <p className={`breakdown__note ${p.value < 0 || /caps/.test(p.note) ? 'breakdown__note--warn' : ''}`}>
                {p.note}
              </p>
            )}
          </div>
        ))}
        <div className="breakdown__rule" />
        <div className="breakdown__total">
          <span>TOTAL</span>
          <span>{signTotal ? signed(stat.total) : stat.total}</span>
        </div>
      </div>
    </section>
  );
}
