import { useState } from 'react';
import { PREGENS } from '@rollbound/rules';
import { artFor } from './art.js';
import Icon from '../components/Icon.jsx';
import buildArt from '../assets/start/build-your-own.webp';
import iconicArt from '../assets/start/iconic-hero.webp';

// Heroes whose class art shows someone else have their own portrait.
const PORTRAITS = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/pregens/portraits/*.webp', { eager: true, query: '?url', import: 'default' })).map(([path, url]) => [
    path.split('/').pop().replace('.webp', ''),
    url,
  ]),
);

/**
 * The builder's first screen for a new character: build your own step by step, or
 * start from one of Paizo's pregenerated heroes. Picking a hero hands their build to
 * onPregen with their headshot's URL (npm run art:pregens), preloaded as their portrait,
 * which opens it at Review.
 */
export default function StartStep({ onCustom, onPregen }) {
  const [browsing, setBrowsing] = useState(false);

  if (browsing) {
    return (
      <section className="pregens" aria-labelledby="pregens-title">
        <div className="pregens__head">
          <h2 id="pregens-title" className="panel__title">Pregenerated heroes</h2>
          <button type="button" className="chip" onClick={() => setBrowsing(false)}>Back</button>
        </div>
        <ul className="pregens__grid">
          {PREGENS.map((p) => (
            <li key={p.slug} className="pregen">
              <button type="button" className="pregen__pick" onClick={() => onPregen(p, `/stock/${p.slug}.webp`)}>
                <span className="pregen__frame">
                  <img className="pregen__art" src={PORTRAITS[p.slug] ?? artFor('class', p.classSlug)} alt="" loading="lazy" />
                </span>
                <span className="pregen__text">
                  <span className="pregen__name">{p.name}</span>
                  <span className="pregen__line">Level 1 · {p.ancestry} · {p.className}</span>
                </span>
              </button>
              {p.pdf && (
                <a className="pregen__pdf" href={`/${p.pdf}`} target="_blank" rel="noreferrer">
                  Original sheet (PDF) <Icon name="external" size={14} />
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <ul className="start-choices">
      <li>
        <button type="button" className="start-choice" onClick={onCustom}>
          {/* Framed on the party climbing the stairs. */}
          <img className="start-choice__art" src={buildArt} alt="" style={{ objectPosition: '40% 100%' }} />
          <span className="start-choice__text">
            <span className="start-choice__name">Build your own</span>
            <span className="start-choice__blurb">Pick an ancestry, background and class, then the rest. Each step explains what your choices do.</span>
          </span>
        </button>
      </li>
      <li>
        <button type="button" className="start-choice" disabled={!PREGENS.length} onClick={() => setBrowsing(true)}>
          {/* Framed on the three heroes, centred on the swordsman. */}
          <img className="start-choice__art" src={iconicArt} alt="" style={{ objectPosition: '50% 20%' }} />
          <span className="start-choice__text">
            <span className="start-choice__name">Take an iconic hero</span>
            <span className="start-choice__blurb">
              {PREGENS.length ? `Choose from ${PREGENS.length} heroes ready to play at level 1. You can rename them and change anything later.` : 'Coming soon.'}
            </span>
          </span>
        </button>
      </li>
    </ul>
  );
}
