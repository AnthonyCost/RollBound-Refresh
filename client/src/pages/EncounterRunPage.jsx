import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { advanceTurn, currentCombatant, initiativeOrder, perception, startEncounter } from '@rollbound/rules';
import { api } from '../api.js';
import { useCampaign, useCampaignCrumbs } from './CampaignPage.jsx';
import { useCampaignService } from '../state/campaignService.js';
import { loadBestiary } from '../state/bestiary.js';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';

/**
 * Everyone in the encounter, ready to roll: each creature (one per count, numbered) with its
 * bestiary Perception, HP and AC, and each of the campaign's characters with theirs.
 */
async function gatherCombatants(encounter, campaignId, campaign, campaigns) {
  const bestiary = new Map((await loadBestiary()).map((c) => [c.id, c]));
  const creatures = encounter.creatures.flatMap((e) => {
    const b = e.creatureId ? bestiary.get(e.creatureId) : null;
    return Array.from({ length: e.count }, (_, i) => ({
      key: `${e.key}-${i + 1}`,
      kind: 'creature',
      name: e.count > 1 ? `${e.name} ${i + 1}` : e.name,
      // shortcut: homebrew creatures have only a level, so Perception is guessed at level + 5 (about moderate); the GM can edit initiative.
      perception: b?.perception ?? e.level + 5,
      hp: b?.hp ?? null,
      maxHp: b?.hp ?? null,
      ac: b?.ac ?? null,
      creatureId: e.creatureId ?? null,
    }));
  });
  const sheets = await Promise.all(campaign.characters.map((c) => campaigns.character(campaignId, c.id)));
  const characters = campaign.characters.map((c, i) => ({
    key: `pc-${c.id}`,
    kind: 'pc',
    name: c.name,
    perception: perception(sheets[i].data).total,
    // Players track their own Hit Points on their sheets.
    hp: null,
    maxHp: null,
    ac: sheets[i].summary?.ac ?? null,
    characterId: c.id,
  }));
  return [...creatures, ...characters];
}

/** A creature's Hit Points, with an amount to take as damage or healing. At 0 it's defeated. */
function HpControls({ c, onChange }) {
  const [amount, setAmount] = useState('');
  const n = Math.max(0, Math.floor(Number(amount))) || 0;
  const apply = (delta) => {
    const hp = Math.max(0, Math.min(c.maxHp ?? Infinity, (c.hp ?? 0) + delta));
    // 0 HP is down; healing brings them back; damage leaves them as they were.
    onChange({ hp, defeated: hp === 0 || (delta < 0 && c.defeated) });
    setAmount('');
  };
  // Homebrew creatures have no HP until the GM sets it.
  if (c.hp == null) {
    return (
      <span className="tracker__hp">
        <input type="number" inputMode="numeric" min="1" value={amount} placeholder="HP" aria-label={`Hit Points for ${c.name}`} onChange={(e) => setAmount(e.target.value)} />
        <button type="button" className="btn btn--small" disabled={!n} onClick={() => { onChange({ hp: n, maxHp: n }); setAmount(''); }}>Set HP</button>
      </span>
    );
  }
  return (
    <span className="tracker__hp">
      <span className="tracker__hp-now">{c.hp}{c.maxHp != null && <small> / {c.maxHp}</small>}</span>
      <input type="number" inputMode="numeric" min="0" value={amount} placeholder="0" aria-label={`Damage or healing for ${c.name}`} onChange={(e) => setAmount(e.target.value)} />
      <button type="button" className="btn btn--small" disabled={!n} onClick={() => apply(-n)}>Damage</button>
      <button type="button" className="btn btn--small" disabled={!n} onClick={() => apply(n)}>Heal</button>
    </span>
  );
}

/**
 * The GM's initiative tracker for a saved encounter: roll initiative for every creature and
 * character, then step through turns and rounds, tracking creature Hit Points and who's
 * down. Every change is saved, so the encounter can be closed and resumed.
 */
export default function EncounterRunPage() {
  const { id, encounterId } = useParams();
  const navigate = useNavigate();
  const { campaign } = useCampaign();
  const campaigns = useCampaignService();
  const [encounter, setEncounter] = useState(null);
  const [state, setState] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  useCampaignCrumbs([
    { label: 'Encounters', to: `/campaigns/${id}/encounters` },
    { label: encounter?.name ?? 'Encounter', to: `/campaigns/${id}/encounters/${encounterId}` },
    { label: 'Run' },
  ]);

  useEffect(() => {
    if (!campaign.isGm) return;
    api.getEncounter(id, encounterId).then(
      (e) => {
        setEncounter(e);
        setState(e.state ?? null);
      },
      (err) => setErrors(errorsFrom(err)),
    );
  }, [id, encounterId, campaign.isGm]);

  if (!campaign.isGm) return <Navigate to={`/campaigns/${id}`} replace />;
  if (!encounter) return <div className="narrow"><FormErrors errors={errors} />{!errors.length && <p className="muted italic center">Opening the encounter…</p>}</div>;

  // Every change goes to the server; if a save fails, say so and keep the change on screen.
  const save = (next) => {
    setState(next);
    setErrors([]);
    api.saveEncounterState(id, encounterId, next).catch((err) => setErrors(errorsFrom(err)));
  };
  const start = async () => {
    setBusy(true);
    setErrors([]);
    try {
      save(startEncounter(await gatherCombatants(encounter, id, campaign, campaigns)));
    } catch (err) {
      setErrors(errorsFrom(err));
    } finally {
      setBusy(false);
    }
  };
  const end = async () => {
    setBusy(true);
    try {
      await api.endEncounter(id, encounterId);
      navigate(`/campaigns/${id}/encounters/${encounterId}`);
    } catch (err) {
      setErrors(errorsFrom(err));
      setBusy(false);
    }
  };
  const setCombatant = (key, patch) => save({ ...state, combatants: state.combatants.map((c) => (c.key === key ? { ...c, ...patch } : c)) });

  if (!state) {
    const total = encounter.creatures.reduce((n, c) => n + c.count, 0);
    return (
      <div className="narrow tracker">
        <h1 className="title center">{encounter.name}</h1>
        <p className="muted center">
          {total} creature{total === 1 ? '' : 's'} and {campaign.characters.length} character{campaign.characters.length === 1 ? '' : 's'}.
          Everyone rolls initiative (d20 + Perception); you can change any roll afterwards.
        </p>
        <FormErrors errors={errors} />
        <button type="button" className="btn btn--blood" disabled={busy || !total} onClick={start}>
          {busy ? 'Rolling…' : 'Roll initiative and begin'}
        </button>
        {!total && <p className="rule-note center">Add some creatures to the encounter first.</p>}
      </div>
    );
  }

  const order = initiativeOrder(state.combatants);
  const now = currentCombatant(state);

  return (
    <div className="tracker">
      <header className="tracker__head">
        <div>
          <span className="eyebrow">{encounter.name}</span>
          <h1 className="title" aria-live="polite">Round {state.round}{now ? ` · ${now.name}’s turn` : ''}</h1>
        </div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => save(advanceTurn(state, -1))}>Previous</button>
          <button type="button" className="btn btn--blood" disabled={!now} onClick={() => save(advanceTurn(state))}>Next turn</button>
        </div>
      </header>
      <FormErrors errors={errors} />
      {!now && <p className="rule-note">Everyone is down. End the encounter, or bring someone back.</p>}

      <ol className="tracker__order" aria-label="Initiative order">
        {order.map((c) => (
          <li key={c.key} className={`tracker__row ${c.defeated ? 'tracker__row--down' : ''}`} aria-current={c.key === state.current ? 'true' : undefined}>
            <label className="tracker__init">
              <span className="visually-hidden">Initiative for {c.name}</span>
              <input type="number" inputMode="numeric" value={c.initiative ?? ''} onChange={(e) => setCombatant(c.key, { initiative: e.target.value === '' ? null : Math.trunc(Number(e.target.value)) })} />
            </label>
            <span className="tracker__name">
              {c.key === state.current && <span className="tracker__now">Acting</span>}
              {c.name}
              <span className="tag">{c.kind === 'pc' ? 'Character' : 'Creature'}</span>
            </span>
            <span className="tracker__stat">AC {c.ac ?? '—'}</span>
            {c.kind === 'creature' ? <HpControls c={c} onChange={(patch) => setCombatant(c.key, patch)} /> : <span className="tracker__hp muted">HP on their sheet</span>}
            <label className="toggle tracker__down">
              <input type="checkbox" checked={c.defeated} onChange={(e) => setCombatant(c.key, { defeated: e.target.checked })} />
              <span>Down</span>
            </label>
          </li>
        ))}
      </ol>

      <div className="btn-row">
        <Link to={`/campaigns/${id}/encounters/${encounterId}`} className="btn">Back to the encounter</Link>
        {confirmEnd ? (
          <>
            <button type="button" className="btn" onClick={() => setConfirmEnd(false)}>Keep going</button>
            <button type="button" className="btn btn--blood" disabled={busy} onClick={end}>End encounter</button>
          </>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirmEnd(true)}>End encounter…</button>
        )}
      </div>
      <p className="rule-note">Changes save as you go, so you can leave and come back to it.</p>
    </div>
  );
}
