import { useEffect, useRef, useState } from 'react';
import { artFor, emptyArtFor, hasOwnArt, iconFor, iconIsFramed, tileFocusFor } from './art.js';
import { sourceTag } from './labels.js';

const firstParagraph = (html = '') => /<p>[\s\S]*?<\/p>/.exec(html)?.[0] ?? '';
/** Centers a tile crop on a chosen point; translate % is relative to the image itself. */
const focusProps = (focus) =>
  focus && {
    className: 'tile__focus',
    style: { width: `${focus.zoom * 100}%`, transform: `translate(-${focus.x}%, -${focus.y}%)` },
  };

const monogram = (name) => name.replace(/^The /, '')[0];

/** An option's round emblem: its icon, a crop of its portrait, or its first letter. */
export function Emblem({ kind, item }) {
  const icon = iconFor(kind, item.slug);
  if (icon) {
    return (
      <span className={`tile__emblem ${iconIsFramed(kind) ? 'tile__emblem--framed' : 'tile__emblem--icon'}`} aria-hidden="true">
        <img src={icon} alt="" loading="lazy" />
      </span>
    );
  }
  const own = hasOwnArt(kind, item.slug);
  return (
    <span className={`tile__emblem ${own ? 'tile__emblem--framed tile__emblem--art' : ''}`} aria-hidden="true">
      {own ? <img src={artFor(kind, item.slug)} alt="" loading="lazy" {...focusProps(tileFocusFor(kind, item.slug))} /> : <span className="tile__letter">{monogram(item.name)}</span>}
    </span>
  );
}

/**
 * A character-select screen: small emblem tiles plus a large art stage that shows
 * the selected option's portrait, name, key stats, and opening description.
 * Tiles follow the radio-group pattern: arrow keys move between them and select.
 * Clicking the selected tile again unselects it (onSelect(null)).
 * Selection uses item IDs; art is looked up by slug, which file names use.
 */
export default function Showcase({ kind, label, items, selected, onSelect, stats, prompt }) {
  const current = items.find((i) => i.id === selected) ?? null;
  const tileRefs = useRef([]);
  const stripRef = useRef(null);

  // On phones the tiles are a sideways strip; keep the selected one in view without moving the page.
  useEffect(() => {
    const strip = stripRef.current;
    const tile = tileRefs.current[items.findIndex((i) => i.id === selected)];
    if (!strip || !tile || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollLeft = tile.offsetLeft - strip.offsetLeft - (strip.clientWidth - tile.offsetWidth) / 2;
  }, [selected, items]);
  const [brokenArt, setBrokenArt] = useState({});

  const onKeyDown = (e, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const jump = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : null;
    if (step == null && jump == null) return;
    e.preventDefault();
    const next = jump ?? (index + step + items.length) % items.length;
    tileRefs.current[next]?.focus();
    onSelect(items[next].id);
  };

  const empty = current ? null : emptyArtFor(kind);
  const art = current ? artFor(kind, current.slug) : empty.url;
  const showArt = Boolean(art) && !brokenArt[art];

  return (
    <section className="showcase" aria-label={label}>
      <div className={`showcase__art ${current ? '' : 'showcase__art--empty'}`} aria-hidden="true">
        <div className="showcase__glow" />
        {showArt ? (
          <img
            key={current?.slug ?? 'none'}
            className={`showcase__img ${empty?.fill ? 'showcase__img--fill' : ''}`}
            src={art}
            alt=""
            onError={() => setBrokenArt((b) => ({ ...b, [art]: true }))}
          />
        ) : (
          <span key={current?.slug ?? 'none'} className="showcase__img showcase__monogram">
            {current ? monogram(current.name) : '?'}
          </span>
        )}
        {!current && <p className="showcase__prompt">{prompt}</p>}
      </div>

      <div ref={stripRef} className="showcase__tiles" role="radiogroup" aria-label={label}>
        {items.map((item, i) => {
          const on = item.id === selected;
          const focusable = on || (!current && i === 0);
          return (
            <button
              key={item.id}
              ref={(el) => (tileRefs.current[i] = el)}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={focusable ? 0 : -1}
              className={`tile ${on ? 'tile--on' : ''}`}
              onClick={() => onSelect(on ? null : item.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <Emblem kind={kind} item={item} />
              <span className="tile__name">{item.name}</span>
            </button>
          );
        })}
      </div>

      <div className="showcase__info" aria-live="polite">
        {current ? (
          <>
            <span className="eyebrow">
              {sourceTag(current.source)}
              {current.rarity !== 'common' && ` · ${current.rarity}`}
            </span>
            <h2 className="showcase__name">{current.name}</h2>
            <dl className="showcase__stats">
              {stats(current).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="showcase__lede" dangerouslySetInnerHTML={{ __html: firstParagraph(current.description) }} />
            <details className="feature">
              <summary>Full rules text</summary>
              <div className="option__desc" dangerouslySetInnerHTML={{ __html: current.description }} />
            </details>
          </>
        ) : (
          <p className="rule-note" style={{ margin: 0 }}>Select a tile to see what it brings to your character.</p>
        )}
      </div>
    </section>
  );
}
