import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { budgets, creatureXp, dcByLevel, rateEncounter } from '@rollbound/rules';
import { useCampaign, useCampaignCrumbs } from './CampaignPage.jsx';
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
const MAX_LEVEL = 25;

const draftKey = (id) => `rollbound.encounter.${id}`;
function loadDraft(id) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(id))) ?? null;
  } catch {
    return null;
  }
}
const newKey = () => Math.random().toString(36).slice(2, 10);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n)) || lo));

/**
 * The Encounters tab, for the GM only: the party's XP budget for each threat, what
 * a creature of each level is worth, and an encounter to build and rate. Until the
 * bestiary exists, creatures are a name and a level.
 */
export default function EncountersPage() {
  const { id } = useParams();
  const { campaign } = useCampaign();
  useCampaignCrumbs([{ label: 'Encounters' }]);
  const saved = loadDraft(id);
  const [partySize, setPartySize] = useState(saved?.partySize ?? Math.max(1, campaign.characters.length || 4));
  const [partyLevel, setPartyLevel] = useState(saved?.partyLevel ?? campaign.partyLevel);
  const [creatures, setCreatures] = useState(saved?.creatures ?? []);

  // The draft stays on this device, per campaign, until the encounter tracker saves encounters.
  useEffect(() => {
    try {
      localStorage.setItem(draftKey(id), JSON.stringify({ partySize, partyLevel, creatures }));
    } catch {
      // Not kept; the builder still works for this visit.
    }
  }, [id, partySize, partyLevel, creatures]);

  if (!campaign.isGm) return <Navigate to={`/campaigns/${id}`} replace />;

  const table = budgets(partySize);
  const rating = rateEncounter(creatures, partyLevel, partySize);
  const tier = table.findIndex((b) => b.name === rating.threat);
  const top = table[table.length - 1].budget;
  const addCreature = (level = partyLevel) => setCreatures((list) => [...list, { key: newKey(), name: '', level, count: 1 }]);
  const setCreature = (key, changes) => setCreatures((list) => list.map((c) => (c.key === key ? { ...c, ...changes } : c)));

  return (
    <div className="encounters">
      <div className="split">
        <div className="split__col">
          <section className="panel encounter-party" aria-labelledby="party-title">
            <h1 id="party-title" className="panel__title">The party</h1>
            <div className="encounter-party__fields">
              <label className="field">
                <span>Characters</span>
                <input type="number" min="1" max="8" value={partySize} onChange={(e) => setPartySize(clamp(e.target.value, 1, 8))} />
              </label>
              <label className="field">
                <span>Party level</span>
                <input type="number" min="1" max="20" value={partyLevel} onChange={(e) => setPartyLevel(clamp(e.target.value, 1, 20))} />
              </label>
            </div>
            <p className="rule-note">
              Starts from {campaign.name}: {campaign.characters.length || 'no'} character{campaign.characters.length === 1 ? '' : 's'}, party level {campaign.partyLevel}.
              Change these to plan for a different group.
            </p>
          </section>

          <Ornament label="XP BUDGET" />
          <ul className="threats">
            {table.map((t, i) => (
              <li key={t.name} className={`threat ${i === tier ? 'threat--current' : ''}`}>
                <span className="threat__name">{t.name}</span>
                <span className="threat__xp">{t.budget} XP</span>
                <span className="threat__note">{THREAT_NOTES[t.name]}</span>
              </li>
            ))}
          </ul>
          <p className="rule-note">
            Budgets are for {partySize} character{partySize === 1 ? '' : 's'}: each character above or below four adds or takes away a little from every threat.
          </p>

          <Ornament label="WHAT CREATURES ARE WORTH" />
          <table className="xp-table">
            <thead>
              <tr>
                <th scope="col">Creature level</th>
                <th scope="col">Compared to the party</th>
                <th scope="col">XP</th>
                <th scope="col"><span className="visually-hidden">Add</span></th>
              </tr>
            </thead>
            <tbody>
              {LEVEL_DIFFS.map((d) => {
                const level = partyLevel + d;
                return (
                  <tr key={d} className={d === 0 ? 'xp-table__even' : ''}>
                    <td>{level < -1 ? '—' : level}</td>
                    <td>{d === 0 ? 'Same level' : d > 0 ? `${d} above` : `${-d} below`}</td>
                    <td>{creatureXp(level, partyLevel)}</td>
                    <td>
                      {level >= -1 && (
                        <button type="button" className="chip" onClick={() => addCreature(level)} aria-label={`Add a level ${level} creature`}>+ Add</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="rule-note">
            Creatures more than 4 levels above the party are too dangerous to price; ones more than 4 below are worth nothing.
            A level {partyLevel} challenge, like a lock or a lore check, is DC {dcByLevel(partyLevel)}.
          </p>
        </div>

        <div className="split__col">
          <section className="panel encounter" aria-labelledby="encounter-title">
            <h2 id="encounter-title" className="panel__title">This encounter</h2>
            <div className="encounter__total">
              <span className="encounter__xp">{rating.xp ?? '—'} XP</span>
              <span className={`encounter__threat encounter__threat--${rating.threat.replace(' ', '-')}`}>{creatures.length ? rating.threat : 'empty'}</span>
            </div>
            <div className="encounter__bar" aria-hidden="true">
              <div style={{ width: `${Math.min(100, ((rating.xp ?? top) / top) * 100)}%` }} />
              {table.map((t) => <span key={t.name} style={{ left: `${(t.budget / top) * 100}%` }} />)}
            </div>
            {rating.xp === null && <p className="rule-note rule-note--warn">A creature more than 4 levels above the party is beyond the budget table: expect it to beat them.</p>}

            {creatures.length > 0 ? (
              <ul className="encounter__list">
                {creatures.map((c) => {
                  const each = creatureXp(c.level, partyLevel);
                  return (
                    <li key={c.key} className="encounter__creature">
                      <label className="encounter__name">
                        <span className="visually-hidden">Name</span>
                        <input value={c.name} maxLength={60} placeholder={`Level ${c.level} creature`} onChange={(e) => setCreature(c.key, { name: e.target.value })} />
                      </label>
                      <label className="encounter__num">
                        <span>Lvl</span>
                        <input type="number" min="-1" max={MAX_LEVEL} value={c.level} onChange={(e) => setCreature(c.key, { level: clamp(e.target.value, -1, MAX_LEVEL) })} />
                      </label>
                      <label className="encounter__num">
                        <span>×</span>
                        <input type="number" min="1" max="20" value={c.count} onChange={(e) => setCreature(c.key, { count: clamp(e.target.value, 1, 20) })} />
                      </label>
                      <span className="encounter__each">{each === null ? 'Too strong' : `${each * c.count} XP`}</span>
                      <button type="button" className="icon-button" aria-label={`Remove ${c.name || `level ${c.level} creature`}`} onClick={() => setCreatures((list) => list.filter((x) => x.key !== c.key))}>×</button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted italic">No creatures yet. Add one here, or from the table of creature levels.</p>
            )}
            <div className="btn-row">
              <button type="button" className="btn btn--grow" onClick={() => addCreature()}>Add a creature</button>
              {creatures.length > 0 && <button type="button" className="btn" onClick={() => setCreatures([])}>Clear</button>}
            </div>
            <p className="rule-note">
              This draft stays on this device. Soon you'll pick creatures from a bestiary (Monster Core, Monster Core 2 and Adventure Paths) instead of typing them in.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
