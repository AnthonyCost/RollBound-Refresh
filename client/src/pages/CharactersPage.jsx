import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import PageShell from '../components/PageShell.jsx';
import Portrait from '../components/Portrait.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';
import { isOutdated } from '../state/rulesData.js';
import { artFor, bannerFor, hasOwnArt } from '../builder/art.js';

const SORTS = {
  name: { label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
  level: { label: 'Level: highest', compare: (a, b) => b.level - a.level || a.name.localeCompare(b.name) },
  newest: { label: 'Created: newest', compare: (a, b) => b.id - a.id },
  oldest: { label: 'Created: oldest', compare: (a, b) => a.id - b.id },
};
const SORT_KEY = 'rollbound.characterSort';
const savedSort = () => {
  try {
    return SORTS[localStorage.getItem(SORT_KEY)] ? localStorage.getItem(SORT_KEY) : 'name';
  } catch {
    return 'name';
  }
};

/** "Level 1 · Human · Fighter (Way of the Drifter)". */
const lineOf = (c) => [`Level ${c.level}`, c.data.ancestry?.name, c.data.className].filter(Boolean).join(' · ');

/** One character as a card: class art behind the portrait, then View, Edit and Delete. */
export function CharacterCard({ character: c, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  const slug = c.data.classSlug;
  // The class's own banner if it has one, otherwise its portrait, faded behind.
  const banner = slug ? bannerFor(slug) ?? (hasOwnArt('class', slug) ? artFor('class', slug) : null) : null;
  const isBanner = Boolean(slug && bannerFor(slug));
  const remove = async () => {
    setBusy(true);
    try {
      await api.deleteCharacter(c.id);
      onDelete(c.id);
    } catch (err) {
      setErrors(errorsFrom(err));
      setBusy(false);
    }
  };

  return (
    <li className="char-card">
      <Link to={`/play/${c.id}/sheet`} className="char-card__banner">
        {banner && <img className={`char-card__art ${isBanner ? 'char-card__art--banner' : ''}`} src={banner} alt="" />}
        <Portrait url={c.portraitUrl} name={c.name} size="lg" />
        <span className="char-card__text">
          <span className="char-card__name">{c.name}</span>
          <span className="char-card__line">{lineOf(c)}</span>
          <span className="char-card__campaign">
            {c.campaignName ?? 'No campaign'}
            {c.joinRequest && <span className="char-card__alert"> · Asked to join {c.joinRequest.campaignName}</span>}
            {isOutdated(c.data) && <span className="char-card__alert"> · Rules updated</span>}
          </span>
        </span>
      </Link>
      {confirming ? (
        <div className="char-card__confirm" role="alertdialog" aria-label={`Delete ${c.name}`}>
          <p>Delete {c.name} for good?{c.campaignName ? ` They leave ${c.campaignName}.` : ''}</p>
          <div className="btn-row">
            <button type="button" className="btn btn--small btn--grow" onClick={() => setConfirming(false)}>Keep</button>
            <button type="button" className="btn btn--small btn--blood btn--grow" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete'}</button>
          </div>
          <FormErrors errors={errors} />
        </div>
      ) : (
        <div className="char-card__actions">
          <Link to={`/play/${c.id}/sheet`}>View</Link>
          {c.data.build ? <Link to={`/characters/${c.id}/edit`}>Edit</Link> : <span className="char-card__off" title="Made before the builder kept its choices">Edit</span>}
          <button type="button" className="char-card__delete" onClick={() => setConfirming(true)}>Delete</button>
        </div>
      )}
    </li>
  );
}

/** Your characters: the home page. */
export default function CharactersPage() {
  const [characters, setCharacters] = useState(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(savedSort);

  useEffect(() => {
    api.listCharacters().then(setCharacters, () => setFailed(true));
  }, []);

  const shown = useMemo(() => {
    if (!characters) return [];
    const q = query.trim().toLowerCase();
    const match = (c) => !q || [c.name, String(c.level), c.data.ancestry?.name, c.data.className, c.campaignName].some((v) => v?.toLowerCase().includes(q));
    return characters.filter(match).sort(SORTS[sort].compare);
  }, [characters, query, sort]);

  const chooseSort = (next) => {
    setSort(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      // Not remembered; the choice still holds for this visit.
    }
  };

  return (
    <PageShell crumbs={[{ label: 'Characters' }]}>
      <header className="list-head">
        <div>
          <h1 className="title">My Characters</h1>
          {characters && <p className="list-head__count">{characters.length} character{characters.length === 1 ? '' : 's'}</p>}
        </div>
        <Link to="/create" className="btn btn--blood">Create a Character</Link>
      </header>

      {characters?.length > 0 && (
        <div className="panel list-tools">
          <label className="list-tools__search">
            <span className="visually-hidden">Search</span>
            <input id="character-search" type="search" value={query} placeholder="Search by name, level, ancestry, class or campaign" onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label className="list-tools__sort">
            <span>Sort by</span>
            <select id="character-sort" value={sort} onChange={(e) => chooseSort(e.target.value)}>
              {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </select>
          </label>
        </div>
      )}

      {failed && <p className="form-errors" role="alert">Couldn't load your characters. Try refreshing.</p>}
      {!characters && !failed && <p className="muted italic center">Gathering your party…</p>}
      {characters?.length === 0 && (
        <p className="panel panel--dashed muted italic center">No characters yet. Create one and they'll gather here.</p>
      )}
      {characters?.length > 0 && !shown.length && <p className="muted italic center">No characters match “{query}”.</p>}
      {shown.length > 0 && (
        <ul className="char-grid">
          {shown.map((c) => (
            <CharacterCard key={c.id} character={c} onDelete={(id) => setCharacters((list) => list.filter((x) => x.id !== id))} />
          ))}
        </ul>
      )}
    </PageShell>
  );
}
