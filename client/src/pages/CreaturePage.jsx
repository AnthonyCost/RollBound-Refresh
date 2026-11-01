import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import Icon from '../components/Icon.jsx';
import { BESTIARY_LICENSE, creatureArt, creaturePath, creatureType, loadBestiary } from '../state/bestiary.js';
import { signed } from '../format.js';

/**
 * One creature, as the Bestiary's right-hand page: its quick numbers, art, lore, Recall
 * Knowledge DCs and full stat block, then its family. search keeps the index's filters
 * on links to family members; closeTo goes back to the index.
 */
export function CreatureEntry({ c, creatures, search, closeTo }) {
  const { type, icon } = creatureType(c);
  const kin = c.family.length ? creatures.filter((x) => x.id !== c.id && x.family.some((f) => c.family.includes(f))) : [];
  // Family members can be on another page of the index, so their links don't keep the page.
  const kinSearch = (() => {
    const p = new URLSearchParams(search);
    p.delete('page');
    const q = p.toString();
    return q ? `?${q}` : '';
  })();
  const quick = [
    ['HP', c.hp],
    ['AC', c.ac],
    ['Fort', signed(c.saves.fortitude)],
    ['Ref', signed(c.saves.reflex)],
    ['Will', signed(c.saves.will)],
    ['Perc', signed(c.perception)],
  ];
  return (
    <article className="creature book__turn">
      <Link to={closeTo} className="book__back">‹ Back to the index</Link>
      <header className="creature__head">
        <div className="creature__title">
          <span className="creature__type" title={type}><Icon name={icon} size={30} /></span>
          <h2 className="title">{c.name}</h2>
          <span className="creature__level">Creature {c.level}</span>
        </div>
        <p className="creature__traits">
          {c.rarity !== 'common' && <span className={`tag tag--rarity-${c.rarity}`}>{c.rarity}</span>}
          {c.size && <span className="tag">{c.size}</span>}
          {c.traits.map((t) => <span key={t} className="tag">{t}</span>)}
        </p>
        {c.formerly && <p className="rule-note">Called the {c.formerly} before the Remaster.</p>}
      </header>

      <dl className="creature__quick">
        {quick.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="creature__columns">
        <div className="creature__column">
          {/* The whole picture, uncropped; tap to open it full size. */}
          {creatureArt(c) && (
            <a className="creature__art" href={creatureArt(c)} target="_blank" rel="noreferrer" aria-label={`Open ${c.name}'s art full size`}>
              <img src={creatureArt(c)} alt={c.name} />
            </a>
          )}
          {c.description && <div className="creature__lore" dangerouslySetInnerHTML={{ __html: c.description }} />}
          {c.recall.length > 0 && (
            <section className="panel creature__recall" aria-labelledby="recall-title">
              <h2 id="recall-title" className="panel__title">Recall Knowledge</h2>
              <ul>
                {c.recall.map((r) => (
                  <li key={r.label}>
                    <span>
                      {r.label.replace(/^Recall Knowledge - /, '')}
                      {r.skills && <span className="muted"> ({r.skills})</span>}
                    </span>
                    <strong>DC {r.dc}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {c.sidebars.map((s) => (
            <aside key={s.title} className="creature__sidebar">
              <h2 className="eyebrow">{s.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: s.html }} />
            </aside>
          ))}
        </div>

        <div className="creature__column">
          <section className="statblock" aria-label={`${c.name} stat block`}>
            <div className="statblock__head">
              <span>{c.name}</span>
              <span>Creature {c.level}</span>
            </div>
            <div className="statblock__body" dangerouslySetInnerHTML={{ __html: c.statBlock }} />
          </section>
          <p className="creature__source">
            {c.book}{c.page && `, page ${c.page}`} ·{' '}
            <a href={c.aon} target="_blank" rel="noreferrer">Archives of Nethys</a>
          </p>
        </div>
      </div>

      {kin.length > 0 && (
        <section className="creature__kin" aria-labelledby="kin-title">
          <h2 id="kin-title" className="eyebrow">Also in the {c.family.join(' and ')} family</h2>
          <ul>
            {kin.map((k) => (
              <li key={k.id}>
                <Link to={`${creaturePath(k)}${kinSearch}`}>{k.name}</Link> <span className="muted">· {k.level}</span>
              </li>
            ))}
          </ul>
          <Link to={`/bestiary?family=${encodeURIComponent(c.family[0])}`} className="link-button">See the family in the bestiary</Link>
        </section>
      )}
      <p className="creature__license">{BESTIARY_LICENSE}</p>
    </article>
  );
}

/** /bestiary/creature/:creatureId, for links that only know a creature's id (saved encounters). */
export function CreatureByIdPage() {
  const { creatureId } = useParams();
  const [to, setTo] = useState(null);
  useEffect(() => {
    loadBestiary().then(
      (all) => setTo(all.find((c) => c.id === creatureId) ? creaturePath(all.find((c) => c.id === creatureId)) : '/bestiary'),
      () => setTo('/bestiary'),
    );
  }, [creatureId]);
  return to ? <Navigate to={to} replace /> : <PageShell crumbs={[{ label: 'Bestiary', to: '/bestiary' }]}><p className="muted italic center">Opening the tome…</p></PageShell>;
}
