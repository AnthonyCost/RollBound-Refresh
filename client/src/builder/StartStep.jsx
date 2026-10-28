import { useState } from 'react';
import { PREGENS } from '@rollbound/rules';
import { artFor, hasOwnArt, PLACEHOLDER_ART } from './art.js';
import Icon from '../components/Icon.jsx';

// Each hero's headshot (npm run art:pregens), preloaded as their portrait when picked.
const HEADSHOTS = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/pregens/*.webp', { eager: true, query: '?url', import: 'default' })).map(([path, url]) => [
    path.split('/').pop().replace('.webp', ''),
    url,
  ]),
);

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
 * onPregen (with their headshot's URL, if there is one), which opens it at Review.
 */
export default function StartStep({ onCustom, onPregen }) {
  const [browsing, setBrowsing] = useState(false);
  const pregenArt = hasOwnArt('class', 'fighter') ? artFor('class', 'fighter') : PLACEHOLDER_ART;

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
              <button type="button" className="pregen__pick" onClick={() => onPregen(p, HEADSHOTS[p.slug] ?? null)}>
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
          <img className="start-choice__art" src={PLACEHOLDER_ART} alt="" />
          <span className="start-choice__text">
            <span className="eyebrow">Step by step</span>
            <span className="start-choice__name">Build your own</span>
            <span className="start-choice__blurb">Choose an ancestry, background and class, then attributes, skills, feats and gear. Every choice is explained.</span>
          </span>
        </button>
      </li>
      <li>
        <button type="button" className="start-choice" disabled={!PREGENS.length} onClick={() => setBrowsing(true)}>
          <img className="start-choice__art" src={pregenArt} alt="" />
          <span className="start-choice__text">
            <span className="eyebrow">{PREGENS.length ? `${PREGENS.length} heroes` : 'Coming soon'}</span>
            <span className="start-choice__name">Play a pregenerated hero</span>
            <span className="start-choice__blurb">Pick one of Pathfinder’s iconic heroes, ready to play at level 1. You can rename them and change anything later.</span>
          </span>
        </button>
      </li>
    </ul>
  );
}
