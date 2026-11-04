import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  advanceTurn, currentCombatant, initiativeOrder, perception, startEncounter,
  savingThrow, classDc, spellDc, spellAttack, landSpeed, strikeBonus, damageModifier,
} from '@rollbound/rules';
import { api } from '../api.js';
import { useCampaign, useCampaignCrumbs } from './CampaignPage.jsx';
import { useCampaignService } from '../state/campaignService.js';
import { creaturePath, creatureThumb, creatureType, loadBestiary } from '../state/bestiary.js';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';
import Portrait from '../components/Portrait.jsx';
import DetailsDrawer from '../components/DetailsDrawer.jsx';
import HealthOrb from '../components/HealthOrb.jsx';
import { signed } from '../format.js';

/** A creature in the drawer: the bestiary's numbers and full stat block (its actions), with its HP in this fight. */
function creatureDetail(c, b) {
  return {
    kind: b ? `Creature ${b.level}` : 'Homebrew creature',
    name: c.name,
    icon: b ? creatureType(b).icon : 'creatureOther',
    value: c.hp ?? '?',
    unit: c.maxHp != null ? `/ ${c.maxHp} HP` : 'HP',
    facts: [
      ['Initiative', c.initiative ?? '—'],
      ['AC', c.ac ?? '—'],
      ...(b ? [['Fortitude', signed(b.saves.fortitude)], ['Reflex', signed(b.saves.reflex)], ['Will', signed(b.saves.will)], ['Perception', signed(b.perception)], ['Speed', b.speed]] : []),
      ['Condition', c.defeated ? 'Down' : c.maxHp && c.hp < c.maxHp ? `${c.maxHp - c.hp} damage` : 'Unhurt'],
    ],
    ...(b ? { html: b.statBlock, link: { to: creaturePath(b), label: 'Open in the Bestiary' } } : { note: 'A homebrew creature: it has no stat block.' }),
  };
}

/** A character in the drawer: their health orb and the numbers that matter in a fight, from their sheet as it is now. */
function characterDetail(c, row) {
  const ch = row?.data;
  if (!ch) return { kind: 'Character', name: c.name, icon: 'user', value: '…', note: row?.error ? "Couldn't load their sheet." : 'Opening their sheet…' };
  const caster = ch.spellcasting;
  return {
    kind: `Level ${ch.level} ${ch.className ?? 'character'}`,
    name: c.name,
    icon: 'user',
    value: row.summary.ac,
    unit: 'AC',
    tool: <HealthOrb current={row.currentHp} max={row.summary.maxHp} />,
    facts: [
      ['Initiative', c.initiative ?? '—'],
      ['Fortitude', signed(savingThrow(ch, 'fortitude').total)],
      ['Reflex', signed(savingThrow(ch, 'reflex').total)],
      ['Will', signed(savingThrow(ch, 'will').total)],
      ['Perception', signed(perception(ch).total)],
      ch.keyAbility && ['Class DC', classDc(ch).total],
      caster && ['Spell DC', spellDc(ch).total],
      caster && ['Spell attack', signed(spellAttack(ch).total)],
      ['Speed', `${landSpeed(ch).total} ft`],
    ].filter(Boolean),
    // shortcut: Strikes use the builder's weapons, not what their inventory has equipped; equip from row.inventory if that matters.
    sections: [{ title: 'Strikes', items: ch.weapons.map((w) => [w.name, `${signed(strikeBonus(ch, w).total)} to hit · 1d${w.die}${damageModifier(w, ch.abilities) ? signed(damageModifier(w, ch.abilities)) : ''} ${w.damageType ?? ''}`.trim()]) }],
  };
}

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
  // The bestiary, for creature portraits and the details drawer; the combatant open in the drawer; a character's sheet for it.
  const [bestiary, setBestiary] = useState(new Map());
  const [open, setOpen] = useState(null);
  const [sheet, setSheet] = useState(null);
  useEffect(() => {
    loadBestiary().then((all) => setBestiary(new Map(all.map((b) => [b.id, b]))), () => {});
  }, []);
  // Opening a character fetches their sheet fresh, so their Hit Points are current.
  const openPc = state?.combatants.find((c) => c.key === open && c.kind === 'pc');
  useEffect(() => {
    setSheet(null);
    if (!openPc) return undefined;
    let cancelled = false;
    campaigns.character(id, openPc.characterId).then((row) => !cancelled && setSheet(row), () => !cancelled && setSheet({ error: true }));
    return () => {
      cancelled = true;
    };
  }, [openPc?.characterId, id]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const portraitOf = (c) =>
    c.kind === 'pc' ? campaign.characters.find((x) => x.id === c.characterId)?.portraitUrl : (bestiary.get(c.creatureId) && creatureThumb(bestiary.get(c.creatureId)));
  const opened = state.combatants.find((c) => c.key === open);
  const detail = !opened ? null : opened.kind === 'pc' ? characterDetail(opened, sheet) : creatureDetail(opened, bestiary.get(opened.creatureId));

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
            <button type="button" className="tracker__name" aria-pressed={open === c.key} onClick={() => setOpen(open === c.key ? null : c.key)}>
              <Portrait url={portraitOf(c)} name={c.name} size="sm" />
              {c.key === state.current && <span className="tracker__now">Acting</span>}
              {c.name}
              <span className="tag">{c.kind === 'pc' ? 'Character' : 'Creature'}</span>
            </button>
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
      <p className="rule-note">Changes save as you go, so you can leave and come back to it. Tap anyone for their details.</p>
      <DetailsDrawer detail={detail} onClose={() => setOpen(null)} />
    </div>
  );
}
