import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import { BESTIARY_LICENSE, bookByKey, creaturePath, loadBestiary } from '../state/bestiary.js';
import { signed } from '../format.js';

/** One creature: its quick numbers, lore, Recall Knowledge DCs and full stat block. */
export default function CreaturePage() {
  const { book: key, slug } = useParams();
  const [creatures, setCreatures] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadBestiary().then(setCreatures, () => setFailed(true));
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [key, slug]);

  const book = bookByKey(key);
  const c = creatures?.find((x) => x.book === book && x.slug === slug);
  const kin = c && c.family.length ? creatures.filter((x) => x.id !== c.id && x.family.some((f) => c.family.includes(f))) : [];
  const crumbs = [{ label: 'Bestiary', to: '/bestiary' }, { label: c?.name ?? 'Creature' }];

  if (failed) return <PageShell crumbs={crumbs}><p className="form-errors" role="alert">Couldn't load the bestiary. Try refreshing.</p></PageShell>;
  if (!creatures) return <PageShell crumbs={crumbs}><p className="muted italic center">Opening the tome…</p></PageShell>;
  if (!c) {
    return (
      <PageShell crumbs={crumbs}>
        <p className="muted italic center">There's no such creature in the bestiary. <Link to="/bestiary">Back to the bestiary</Link></p>
      </PageShell>
    );
  }

  const quick = [
    ['HP', c.hp],
    ['AC', c.ac],
    ['Fort', signed(c.saves.fortitude)],
    ['Ref', signed(c.saves.reflex)],
    ['Will', signed(c.saves.will)],
    ['Perc', signed(c.perception)],
  ];
  return (
    <PageShell crumbs={crumbs}>
      <article className="creature">
        <header className="creature__head">
          <div className="creature__title">
            <h1 className="title">{c.name}</h1>
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

        <div className="split">
          <div className="split__col">
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

          <div className="split__col">
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
                  <Link to={creaturePath(k)}>{k.name}</Link> <span className="muted">· {k.level}</span>
                </li>
              ))}
            </ul>
            <Link to={`/bestiary?family=${encodeURIComponent(c.family[0])}`} className="link-button">See the family in the bestiary</Link>
          </section>
        )}
        <p className="creature__license">{BESTIARY_LICENSE}</p>
      </article>
    </PageShell>
  );
}
