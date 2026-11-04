import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import RankPips from './RankPips.jsx';
import ActionCost from './ActionCost.jsx';
import { signed } from '../format.js';

const COST_WORDS = { exploration: 'Exploration', downtime: 'Downtime', varies: 'Varies' };

/** A detail's headline number: signed for modifiers, plain for DCs, AC and Speed. */
export const detailValue = (d) => d.value ?? (d.unsigned ? d.stat.total : signed(d.stat.total));

/**
 * The character sheet's details drawer. Tap a number and it slides in (from the right on
 * wide screens, up from the bottom on phones) with where the number comes from and the
 * rules behind it. It has no backdrop, so tapping another number swaps what it shows.
 *
 * detail: { kind, name, icon, stat?, value?, unsigned?, unit?, total?, totalLabel?, rank?, ability?, actions?,
 *           facts?: [label, value][], rules?: string[], html?: rules text as HTML, note?,
 *           sections?: { title, items: [name, text][], empty? }[], uses?: [name, cost, trainedOnly][], link?: { to, label },
 *           link.newTab opens it in a new tab; tool?: controls for the thing itself, under its facts (a shield's Shield Block and Repair) }
 * inline: shown in place, not sliding over the page (for previews such as the style lab).
 */
export default function DetailsDrawer({ detail: d, onClose, inline = false }) {
  useEffect(() => {
    if (!d) return undefined;
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [d, onClose]);

  return (
    <aside className={inline ? 'details details--inline' : `details ${d ? 'details--open' : ''}`} aria-label="Details" aria-live="polite">
      {d && (
        <div className="details__panel" key={`${d.kind}-${d.name}`}>
          <div className="details__top">
            <span className="details__kind">{d.kind}</span>
            <button type="button" className="details__close" onClick={onClose} aria-label="Close details">
              <Icon name="close" size={16} />
            </button>
          </div>

          <header className="details__head">
            <span className="details__icon"><Icon name={d.icon} size={30} /></span>
            <h2 className="details__name">
              {d.name}
              {d.actions && <> <ActionCost actions={d.actions} /></>}
            </h2>
            <span className="details__value">
              {detailValue(d)}
              {d.unit && <small> {d.unit}</small>}
            </span>
          </header>

          {(d.rank || d.ability) && (
            <p className="details__meta">
              {d.ability && <span>{d.ability.toUpperCase()}</span>}
              {d.rank && (
                <>
                  <RankPips rank={d.rank} /> <span className="details__rank">{d.rank}</span>
                </>
              )}
            </p>
          )}

          {d.stat && (
            <dl className="details__math">
              {d.stat.parts.map((p, i) => (
                <div key={`${p.label}-${i}`} className={p.value < 0 ? 'details__row details__row--minus' : 'details__row'}>
                  <dt>
                    {p.label}
                    {p.note && <small>{p.note}</small>}
                  </dt>
                  <dd>{p.label === 'Base' || (d.unit && i === 0) ? p.value : signed(p.value)}</dd>
                </div>
              ))}
              <div className="details__row details__total">
                <dt>{d.totalLabel ?? 'Total'}</dt>
                <dd>{d.total ?? detailValue(d)}</dd>
              </div>
            </dl>
          )}

          {d.facts?.length > 0 && (
            <dl className="details__facts">
              {d.facts.map(([k, v]) => (
                <div key={k} className="details__row">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {d.tool && <div className="details__tool">{d.tool}</div>}

          {d.rules?.length > 0 && (
            <div className="details__rules">
              {d.rules.map((r) => <p key={r.slice(0, 40)}>{r}</p>)}
            </div>
          )}
          {d.note && <p className="details__note">{d.note}</p>}
          {d.html && <div className="option__desc details__html" dangerouslySetInnerHTML={{ __html: d.html }} />}

          {d.sections?.map((sec) => (sec.items.length > 0 || sec.empty) && (
            <section key={sec.title}>
              <h3 className="details__sub">{sec.title}</h3>
              {sec.items.length > 0 ? (
                <dl className="details__traits">
                  {sec.items.map(([name, text]) => (
                    <div key={name}>
                      <dt>{name}</dt>
                      {text && <dd>{text}</dd>}
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="details__note">{sec.empty}</p>
              )}
            </section>
          ))}

          {d.uses?.length > 0 && (
            <>
              <h3 className="details__sub">Actions with {d.name}</h3>
              <ul className="details__uses">
                {d.uses.map(([name, cost, trained]) => (
                  <li key={name} className={trained && d.rank === 'untrained' ? 'details__use--locked' : undefined}>
                    <span>{name}</span>
                    {trained && <span className="details__gate">Trained</span>}
                    {COST_WORDS[cost] ? <span className="details__cost">{COST_WORDS[cost]}</span> : <ActionCost actions={String(cost)} />}
                  </li>
                ))}
              </ul>
            </>
          )}
          {d.link && <Link to={d.link.to} className="details__link" {...(d.link.newTab && { target: '_blank', rel: 'noreferrer' })}>{d.link.label}{d.link.newTab && <span className="visually-hidden"> (opens in a new tab)</span>}</Link>}
        </div>
      )}
    </aside>
  );
}
