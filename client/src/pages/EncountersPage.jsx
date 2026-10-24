import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { budgets, creatureXp, dcByLevel, rateEncounter } from '@rollbound/rules';
import { api } from '../api.js';
import { useCampaign, useCampaignCrumbs } from './CampaignPage.jsx';
import { creaturePath, loadBestiary } from '../state/bestiary.js';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';
import Ornament from '../components/Ornament.jsx';

// What each threat means at the table (GM Core).
const THREAT_NOTES = {
  trivial: "A warm-up. The party won't need to spend much.",
  low: 'A real fight, but the party should come out fine.',
  moderate: 'A serious challenge. Expect to spend resources.',
  severe: 'The hardest fight most groups should face. Someone may go down.',
  extreme: 'A match for the whole party. Save these for climaxes.',
};
const LEVEL_DIFFS = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
const NAME_MAX = 80;
const NOTES_MAX = 5000;
const MAX_KINDS = 40;
const MAX_COUNT = 20;
const RESULTS = 20;

const newKey = () => Math.random().toString(36).slice(2, 10);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n)) || lo));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The party an encounter is built for when the GM hasn't set one: the campaign's
 * characters, at their average level. With nobody in the party yet, a table of four
 * at the campaign's party level.
 */
export function autoParty(campaign) {
  const chars = campaign.characters;
  if (!chars.length) return { size: 4, level: campaign.partyLevel, fromCharacters: false };
  const level = Math.round(chars.reduce((t, c) => t + c.level, 0) / chars.length);
  return { size: Math.min(8, chars.length), level: Math.max(1, Math.min(20, level)), fromCharacters: true };
}

/** The party an encounter uses: its own size and level where set, otherwise the campaign's. */
const partyFor = (encounter, campaign) => {
  const auto = autoParty(campaign);
  return { size: encounter.partySize ?? auto.size, level: encounter.partyLevel ?? auto.level };
};

const rate = (encounter, campaign) => {
  const party = partyFor(encounter, campaign);
  return { ...rateEncounter(encounter.creatures, party.level, party.size), party };
};

/** The GM's saved encounters for this campaign. */
export function EncounterListPage() {
  const { id } = useParams();
  const { campaign } = useCampaign();
  const [list, setList] = useState(null);
  const [errors, setErrors] = useState([]);
  useCampaignCrumbs([{ label: 'Encounters' }]);

  useEffect(() => {
    if (campaign.isGm) api.listEncounters(id).then(setList, (err) => setErrors(errorsFrom(err)));
  }, [id, campaign.isGm]);

  if (!campaign.isGm) return <Navigate to={`/campaigns/${id}`} replace />;
  const auto = autoParty(campaign);
  return (
    <div className="encounters narrow">
      <header className="logs__head">
        <h1 className="title">Encounters</h1>
        <Link to="new" className="btn btn--blood btn--small">New encounter</Link>
      </header>
      <p className="rule-note">
        Only you can see these. Threats are rated for {auto.fromCharacters ? 'your party' : 'a party'} of {plural(auto.size, 'character')} at level {auto.level}
        {auto.fromCharacters ? '' : ' until characters join'}, unless an encounter sets its own.
      </p>
      <FormErrors errors={errors} />
      {!list && !errors.length && <p className="muted italic center">Gathering your notes…</p>}
      {list?.length === 0 && (
        <p className="panel panel--dashed muted italic center">No encounters yet. Build one from the bestiary and save it for your next session.</p>
      )}
      {list?.length > 0 && (
        <ul className="logs__list">
          {list.map((e) => {
            const r = rate(e, campaign);
            const total = e.creatures.reduce((t, c) => t + c.count, 0);
            return (
              <li key={e.id}>
                <Link to={String(e.id)} className="log-card encounter-card">
                  <span className="encounter-card__top">
                    <span className="log-card__title">{e.name}</span>
                    <span className={`encounter__threat encounter__threat--${r.threat.replace(' ', '-')}`}>{e.creatures.length ? r.threat : 'empty'}</span>
                  </span>
                  <span className="log-card__excerpt">
                    {e.creatures.length ? e.creatures.map((c) => `${c.count > 1 ? `${c.count} × ` : ''}${c.name}`).join(', ') : 'No creatures yet.'}
                  </span>
                  <span className="log-meta">
                    {r.xp ?? '—'} XP · {plural(total, 'creature')} · for {r.party.size} at level {r.party.level}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Choose bestiary creatures to add: search by name or trait, near the party's level by default. */
function BestiaryPicker({ partyLevel, onAdd, full }) {
  const [creatures, setCreatures] = useState(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [nearby, setNearby] = useState(true);
  useEffect(() => {
    loadBestiary().then(setCreatures, () => setFailed(true));
  }, []);

  const results = useMemo(() => {
    if (!creatures) return [];
    const q = query.trim().toLowerCase();
    return creatures
      .filter((c) => (!q || c.name.toLowerCase().includes(q) || c.traits.some((t) => t.toLowerCase() === q)) && (!nearby || Math.abs(c.level - partyLevel) <= 4))
      .sort((a, b) => Math.abs(a.level - partyLevel) - Math.abs(b.level - partyLevel) || a.name.localeCompare(b.name))
      .slice(0, RESULTS);
  }, [creatures, query, nearby, partyLevel]);

  return (
    <section className="panel picker" aria-labelledby="picker-title">
      <h2 id="picker-title" className="panel__title">Add from the bestiary</h2>
      <input id="picker-search" type="search" className="picker__search" value={query} placeholder="Search: wolf, goblin, undead…" onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} />
      <label className="toggle picker__nearby">
        <input type="checkbox" checked={nearby} onChange={(e) => setNearby(e.target.checked)} />
        <span>Only levels {Math.max(-1, partyLevel - 4)} to {partyLevel + 4}, the ones the budget prices</span>
      </label>
      {failed && <p className="rule-note rule-note--warn">Couldn't load the bestiary. Try refreshing.</p>}
      {!creatures && !failed && <p className="muted italic">Opening the tome…</p>}
      {creatures && !results.length && <p className="muted italic">No creatures match{nearby ? ' near this level' : ''}.</p>}
      {results.length > 0 && (
        <ul className="picker__results">
          {results.map((c) => (
            <li key={c.id} className="picker__result">
              <span className="picker__info">
                <Link to={creaturePath(c)} target="_blank" rel="noreferrer" className="picker__name">{c.name}</Link>
                <span className="muted">
                  Level {c.level} · {creatureXp(c.level, partyLevel) ?? 'too strong to price'}
                  {creatureXp(c.level, partyLevel) != null && ' XP'} · HP {c.hp} · AC {c.ac}
                </span>
              </span>
              <button type="button" className="btn btn--small" disabled={full} onClick={() => onAdd(c)} aria-label={`Add ${c.name}`}>+ Add</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * A creature from neither book: a name and a level. Not a <form>, since it sits
 * inside the encounter's form; Enter in the name adds it.
 */
function HomebrewForm({ partyLevel, onAdd, full }) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState(String(partyLevel));
  const add = () => {
    if (!name.trim() || full) return;
    onAdd({ name: name.trim(), level: clamp(level, -1, 25) });
    setName('');
  };
  const onKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    add();
  };
  return (
    <div className="homebrew" role="group" aria-label="Homebrew creature">
      <span className="eyebrow">Or a homebrew creature</span>
      <div className="homebrew__row">
        <input id="homebrew-name" value={name} maxLength={NAME_MAX} placeholder="Drowned bell-ringer" onChange={(e) => setName(e.target.value)} onKeyDown={onKeyDown} aria-label="Name" />
        <label className="encounter__num">
          <span>Lvl</span>
          <input id="homebrew-level" type="number" min="-1" max="25" value={level} onChange={(e) => setLevel(e.target.value)} onKeyDown={onKeyDown} />
        </label>
        <button type="button" className="btn btn--small" disabled={!name.trim() || full} onClick={add}>Add</button>
      </div>
    </div>
  );
}

/** Creating (no :encounterId) or editing one saved encounter. */
export function EncounterEditor() {
  const { id, encounterId } = useParams();
  const { campaign } = useCampaign();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(encounterId ? null : { name: '', notes: '', partySize: null, partyLevel: null, creatures: [] });
  const [form, setForm] = useState(saved);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState(null);
  useCampaignCrumbs([{ label: 'Encounters', to: `/campaigns/${id}/encounters` }, { label: encounterId ? form?.name || 'Encounter' : 'New' }]);

  useEffect(() => {
    if (!encounterId || !campaign.isGm) return;
    api.getEncounter(id, encounterId).then(
      (e) => {
        setSaved(e);
        setForm(e);
      },
      (err) => setErrors(errorsFrom(err)),
    );
  }, [id, encounterId, campaign.isGm]);

  if (!campaign.isGm) return <Navigate to={`/campaigns/${id}`} replace />;
  if (!form) {
    return (
      <div className="narrow">
        <FormErrors errors={errors} />
        {!errors.length && <p className="muted italic center">Gathering your notes…</p>}
      </div>
    );
  }

  const auto = autoParty(campaign);
  const party = partyFor(form, campaign);
  const rating = rateEncounter(form.creatures, party.level, party.size);
  const table = budgets(party.size);
  const tier = table.findIndex((b) => b.name === rating.threat);
  const top = table[table.length - 1].budget;
  const full = form.creatures.length >= MAX_KINDS;
  const changed = JSON.stringify({ ...form, updatedAt: 0 }) !== JSON.stringify({ ...saved, updatedAt: 0 });

  const update = (changes) => {
    setNotice(null);
    setForm((f) => ({ ...f, ...changes }));
  };
  const setCreature = (key, changes) => update({ creatures: form.creatures.map((c) => (c.key === key ? { ...c, ...changes } : c)) });
  const addFromBestiary = (c) => {
    const there = form.creatures.find((x) => x.creatureId === c.id);
    if (there) setCreature(there.key, { count: Math.min(MAX_COUNT, there.count + 1) });
    else update({ creatures: [...form.creatures, { key: newKey(), creatureId: c.id, name: c.name, level: c.level, count: 1 }] });
  };

  const save = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setErrors([]);
    try {
      const body = { name: form.name, notes: form.notes, partySize: form.partySize, partyLevel: form.partyLevel, creatures: form.creatures };
      if (encounterId) {
        const next = await api.updateEncounter(id, encounterId, body);
        setSaved(next);
        setForm(next);
        setNotice('Saved.');
      } else {
        const made = await api.createEncounter(id, body);
        navigate(`/campaigns/${id}/encounters/${made.id}`, { replace: true });
      }
    } catch (err) {
      setErrors(errorsFrom(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.deleteEncounter(id, encounterId);
      navigate(`/campaigns/${id}/encounters`, { replace: true });
    } catch (err) {
      setErrors(errorsFrom(err));
      setBusy(false);
    }
  };

  return (
    <form className="encounters" onSubmit={save}>
      <div className="encounter-head">
        <label className="form-field encounter-head__name">
          <span>Encounter name</span>
          <input id="encounter-name" value={form.name} maxLength={NAME_MAX} required placeholder="Ambush at the ford" onChange={(e) => update({ name: e.target.value })} />
        </label>
        <div className="encounter-head__actions">
          {notice && !changed && <span className="encounter-head__saved" role="status">{notice}</span>}
          {changed && encounterId && <span className="encounter-head__unsaved">Unsaved changes</span>}
          <Link to={`/campaigns/${id}/encounters`} className="btn btn--small">{changed ? 'Cancel' : 'Back'}</Link>
          <button type="submit" className="btn btn--blood btn--small" disabled={busy || !form.name.trim() || (encounterId && !changed)}>
            {busy ? 'Saving…' : encounterId ? 'Save' : 'Save encounter'}
          </button>
        </div>
      </div>
      <FormErrors errors={errors} />

      <div className="split">
        <div className="split__col">
          <section className="panel encounter" aria-labelledby="encounter-title">
            <h2 id="encounter-title" className="panel__title">Creatures</h2>
            <div className="encounter__total">
              <span className="encounter__xp">{rating.xp ?? '—'} XP</span>
              <span className={`encounter__threat encounter__threat--${rating.threat.replace(' ', '-')}`}>{form.creatures.length ? rating.threat : 'empty'}</span>
            </div>
            <div className="encounter__bar" aria-hidden="true">
              <div style={{ width: `${Math.min(100, ((rating.xp ?? top) / top) * 100)}%` }} />
              {table.map((t) => <span key={t.name} style={{ left: `${(t.budget / top) * 100}%` }} />)}
            </div>
            {rating.xp === null && <p className="rule-note rule-note--warn">A creature more than 4 levels above the party is beyond the budget table: expect it to beat them.</p>}
            {form.creatures.length > 0 ? (
              <ul className="encounter__list">
                {form.creatures.map((c) => {
                  const each = creatureXp(c.level, party.level);
                  return (
                    <li key={c.key} className="encounter__creature">
                      <span className="encounter__name">
                        {c.creatureId ? <Link to={`/bestiary/creature/${c.creatureId}`} target="_blank" rel="noreferrer">{c.name}</Link> : <span>{c.name} <span className="tag">Homebrew</span></span>}
                        {' '}<span className="muted">· Level {c.level}</span>
                      </span>
                      <span className="stepper" role="group" aria-label={`How many ${c.name}`}>
                        <button type="button" className="btn" aria-label="One fewer" disabled={c.count <= 1} onClick={() => setCreature(c.key, { count: c.count - 1 })}>−</button>
                        <span className="stepper__value">{c.count}</span>
                        <button type="button" className="btn" aria-label="One more" disabled={c.count >= MAX_COUNT} onClick={() => setCreature(c.key, { count: c.count + 1 })}>+</button>
                      </span>
                      <span className="encounter__each">{each === null ? 'Too strong' : `${each * c.count} XP`}</span>
                      <button type="button" className="icon-button" aria-label={`Remove ${c.name}`} onClick={() => update({ creatures: form.creatures.filter((x) => x.key !== c.key) })}>×</button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted italic">No creatures yet. Add some from the bestiary below.</p>
            )}
            {full && <p className="rule-note">That's the most kinds of creature an encounter can hold ({MAX_KINDS}).</p>}
            <HomebrewForm partyLevel={party.level} onAdd={(c) => update({ creatures: [...form.creatures, { key: newKey(), creatureId: null, count: 1, ...c }] })} full={full} />
          </section>

          <BestiaryPicker partyLevel={party.level} onAdd={addFromBestiary} full={full} />

          <label className="form-field">
            <span>Notes</span>
            <textarea id="encounter-notes" className="encounter__notes" rows={5} maxLength={NOTES_MAX} value={form.notes} placeholder="Terrain, tactics, treasure…" onChange={(e) => update({ notes: e.target.value })} />
          </label>
        </div>

        <div className="split__col">
          <section className="panel encounter-party" aria-labelledby="party-title">
            <h2 id="party-title" className="panel__title">The party</h2>
            {/* Each starts at the campaign's party and follows it; typing a number sets it for this encounter. */}
            <div className="party-tiles">
              {[
                ['partySize', 'Characters', 1, 8, auto.size],
                ['partyLevel', 'Party level', 1, 20, auto.level],
              ].map(([field, label, lo, hi, autoValue]) => (
                <label key={field} className={`party-tile ${form[field] === null ? '' : 'party-tile--set'}`}>
                  <span className="party-tile__label">{label}</span>
                  <input
                    id={`encounter-${field}`}
                    type="number"
                    min={lo}
                    max={hi}
                    value={form[field] ?? autoValue}
                    onChange={(e) => {
                      // Back at the party's own number, it follows the party again.
                      const value = clamp(e.target.value, lo, hi);
                      update({ [field]: value === autoValue ? null : value });
                    }}
                  />
                  {form[field] !== null && (
                    <button type="button" className="party-tile__reset" onClick={() => update({ [field]: null })} aria-label={`Reset ${label.toLowerCase()} to the party's ${autoValue}`}>
                      Reset to {autoValue}
                    </button>
                  )}
                </label>
              ))}
            </div>
          </section>

          <Ornament label="XP BUDGET" />
          <ul className="threats">
            {table.map((t, i) => (
              <li key={t.name} className={`threat ${i === tier && form.creatures.length ? 'threat--current' : ''}`}>
                <span className="threat__name">{t.name}</span>
                <span className="threat__xp">{t.budget} XP</span>
                <span className="threat__note">{THREAT_NOTES[t.name]}</span>
              </li>
            ))}
          </ul>
          <details className="feature xp-reference">
            <summary>What creatures are worth</summary>
            <table className="xp-table">
              <thead>
                <tr>
                  <th scope="col">Creature level</th>
                  <th scope="col">Compared to the party</th>
                  <th scope="col">XP</th>
                </tr>
              </thead>
              <tbody>
                {LEVEL_DIFFS.map((d) => (
                  <tr key={d} className={d === 0 ? 'xp-table__even' : ''}>
                    <td>{party.level + d < -1 ? '—' : party.level + d}</td>
                    <td>{d === 0 ? 'Same level' : d > 0 ? `${d} above` : `${-d} below`}</td>
                    <td>{creatureXp(party.level + d, party.level)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="rule-note">A level {party.level} challenge, like a lock or a lore check, is DC {dcByLevel(party.level)}.</p>
          </details>

          {encounterId && (
            <section className="panel danger" aria-labelledby="delete-encounter-title">
              <h2 id="delete-encounter-title" className="panel__title">Delete encounter</h2>
              {confirming ? (
                <div className="confirm confirm--inline" role="alertdialog" aria-label="Delete encounter">
                  <p>Delete “{saved.name}”? This can't be undone.</p>
                  <div className="btn-row">
                    <button type="button" className="btn btn--grow" onClick={() => setConfirming(false)}>Keep it</button>
                    <button type="button" className="btn btn--blood btn--grow" disabled={busy} onClick={remove}>Delete</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn" onClick={() => setConfirming(true)}>Delete encounter</button>
              )}
            </section>
          )}
        </div>
      </div>
    </form>
  );
}
