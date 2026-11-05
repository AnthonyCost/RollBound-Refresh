import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  advanceTurn, currentCombatant, cycleCondition, endTurn, moveCombatant, perception, placeByInitiative, startEncounter,
  savingThrow, classDc, spellDc, spellAttack, landSpeed, strikeBonus, damageModifier,
} from '@rollbound/rules';
import { api } from '../api.js';
import { useCampaign, useCampaignCrumbs } from './CampaignPage.jsx';
import { useCampaignService } from '../state/campaignService.js';
import { creaturePath, creatureThumb, creatureType, loadBestiary } from '../state/bestiary.js';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';
import Portrait from '../components/Portrait.jsx';
import DetailsDrawer from '../components/DetailsDrawer.jsx';
import RollDrawer from '../components/RollDrawer.jsx';
import { RollProvider, useTable } from '../state/TableContext.jsx';
import HealthOrb from '../components/HealthOrb.jsx';
import ShieldGauge from '../components/ShieldGauge.jsx';
import ConditionChips, { ConditionBadges } from '../components/ConditionChips.jsx';
import ActionPips from '../components/ActionPips.jsx';
import { useRunningEncounter } from '../state/runningEncounter.js';
import { signed } from '../format.js';

/** A creature in the drawer (the GM's alone): the bestiary's numbers and full stat block (its actions), with its HP in this fight. */
function creatureDetail(c, b, controls) {
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
    tool: controls,
    ...(b ? { html: b.statBlock, link: { to: creaturePath(b), label: 'Open in the Bestiary', newTab: true } } : { note: 'A homebrew creature: it has no stat block.' }),
  };
}

/**
 * A character's combat card for the drawer: the health orb beside the numbers a fight asks
 * for (AC first), the button to their full sheet, and their Strikes. controls: the GM's.
 */
function CharacterCard({ c, row, sheetUrl, controls }) {
  const ch = row.data;
  const caster = ch.spellcasting;
  const tiles = [
    ['AC', row.summary.ac, true],
    ch.keyAbility && ['Class DC', classDc(ch).total, true],
    caster && ['Spell DC', spellDc(ch).total],
    caster && ['Spell attack', signed(spellAttack(ch).total)],
    ['Perception', signed(perception(ch).total)],
    ['Fortitude', signed(savingThrow(ch, 'fortitude').total)],
    ['Reflex', signed(savingThrow(ch, 'reflex').total)],
    ['Will', signed(savingThrow(ch, 'will').total)],
    ['Speed', `${landSpeed(ch).total} ft`],
    ['Initiative', c.initiative ?? '—'],
  ].filter(Boolean);
  return (
    <div className="pc-card">
      <div className="pc-card__top">
        <div className="pc-card__vitals">
          <HealthOrb current={row.currentHp} max={row.summary.maxHp} />
          {row.summary.shield && <ShieldGauge shield={row.summary.shield} />}
        </div>
        <dl className="pc-card__tiles">
          {tiles.map(([k, v, big]) => (
            <div key={k} className={big ? 'pc-card__tile pc-card__tile--big' : 'pc-card__tile'}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <a href={sheetUrl} target="_blank" rel="noreferrer" className="btn btn--blood pc-card__sheet">
        View character sheet<span className="visually-hidden"> (opens in a new tab)</span> ↗
      </a>
      {controls}
      <h3 className="details__sub">Strikes</h3>
      {/* shortcut: the builder's weapons, not what their inventory has equipped; equip from row.inventory if that matters. */}
      <ul className="pc-card__strikes">
        {ch.weapons.map((w) => {
          const mod = damageModifier(w, ch.abilities);
          return (
            <li key={w.name}>
              <span className="pc-card__strike-name">{w.name}</span>
              <span className="pc-card__strike-hit">{signed(strikeBonus(ch, w).total)}</span>
              <span className="pc-card__strike-dmg">1d{w.die}{mod ? signed(mod) : ''} {w.damageType ?? ''}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A character in the drawer: their combat card once their sheet has loaded. */
function characterDetail(c, row, controls, sheetUrl) {
  const ch = row?.data;
  if (!ch) return { kind: 'Character', name: c.name, icon: 'user', value: '…', tool: controls, note: row?.error ? "Couldn't load their sheet." : 'Opening their sheet…' };
  return {
    kind: `Level ${ch.level} ${ch.className ?? 'character'}`,
    name: c.name,
    icon: 'user',
    value: row.currentHp,
    unit: `/ ${row.summary.maxHp} HP`,
    tool: <CharacterCard c={c} row={row} sheetUrl={sheetUrl} controls={controls} />,
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
 * A character's Hit Points and shield, changed by the GM: damage, heal, Shield Block (their
 * shield's Hardness stops part of the hit) and repair. The server works it out (see the rules'
 * applyCombatAction) and the player's sheet follows. onDone gets { currentHp, shield }.
 */
function CharacterHpControls({ campaignId, c, shield, onDone }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const n = Math.max(0, Math.floor(Number(amount))) || 0;
  const act = async (action) => {
    setBusy(true);
    try {
      const r = await api.characterCombat(campaignId, c.characterId, action, n);
      onDone(r);
      setNote(
        action === 'block'
          ? r.through ? `Hardness ${shield.hardness} stopped ${r.stopped}. ${shield.name} and ${c.name} each take ${r.through}.` : `Hardness ${shield.hardness} stopped all ${n}.`
          : action === 'repair' ? `Repaired ${shield.name} by ${n}.` : `${action === 'damage' ? 'Took' : 'Healed'} ${n}: ${r.currentHp} of ${r.maxHp} HP.`,
      );
      setAmount('');
    } catch (err) {
      setNote(errorsFrom(err).join(' '));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="tracker__pc-hp">
      <label className="tracker__amount">
        <span className="eyebrow">Amount</span>
        <input type="number" inputMode="numeric" min="1" value={amount} placeholder="0" aria-label={`Damage or healing for ${c.name}`} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <div className="tracker__pc-buttons">
        <button type="button" className="btn btn--blood" disabled={!n || busy} onClick={() => act('damage')}>Damage</button>
        <button type="button" className="btn" disabled={!n || busy} onClick={() => act('heal')}>Heal</button>
        {shield && (
          <>
            <button type="button" className="btn" disabled={!n || busy || shield.broken} onClick={() => act('block')}>Shield Block</button>
            <button type="button" className="btn" disabled={!n || busy || shield.destroyed || shield.current === shield.max} onClick={() => act('repair')}>Repair shield</button>
          </>
        )}
      </div>
      <p className="rule-note" role="status" style={{ margin: 0 }}>
        {note ?? (shield ? `${shield.name}: Hardness ${shield.hardness}, broken at ${shield.brokenAt}${shield.broken ? ' (broken now: it can’t block)' : ''}.` : 'Their sheet updates as you go.')}
      </p>
    </div>
  );
}

/**
 * In the drawer (the GM's): Hit Points controls (a creature's here, a character's through their
 * sheet), conditions (a character's reach their sheet and change its numbers), and Down.
 */
function DrawerControls({ c, onChange, pc }) {
  const conditions = c.conditions ?? [];
  return (
    <div className="tracker__controls">
      {c.kind === 'creature' && <HpControls c={c} onChange={onChange} />}
      {pc}
      <div className="tracker__conditions">
        <span className="eyebrow">Conditions · tap to add or raise</span>
        <ConditionChips conditions={conditions} label={`${c.name}'s conditions`} onToggle={(id) => onChange({ conditions: cycleCondition(conditions, id) })} />
      </div>
      <label className="toggle tracker__down">
        <input type="checkbox" checked={c.defeated} onChange={(e) => onChange({ defeated: e.target.checked })} />
        <span>Down (skipped in the turn order)</span>
      </label>
    </div>
  );
}

/** A creature's Hit Points as a bar in its row (the GM's view), or what's missing. */
function HpBar({ c, vitals }) {
  if (c.kind === 'pc') {
    if (!vitals) return <span className="tracker__hpbar tracker__hpbar--none">HP on their sheet</span>;
    c = { ...c, hp: vitals.hp, maxHp: vitals.maxHp };
  }
  if (c.hp == null) return <span className="tracker__hpbar tracker__hpbar--none">HP not set</span>;
  const pct = c.maxHp ? Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100)) : 100;
  return (
    <span className="tracker__hpbar" role="meter" aria-label={`${c.name}'s Hit Points`} aria-valuemin={0} aria-valuemax={c.maxHp ?? c.hp} aria-valuenow={c.hp}>
      <span className="tracker__hpbar-track"><span className={`tracker__hpbar-fill ${pct <= 25 ? 'tracker__hpbar-fill--low' : ''}`} style={{ width: `${pct}%` }} /></span>
      <span className="tracker__hpbar-num">{c.hp}<small>/{c.maxHp ?? '?'}</small></span>
    </span>
  );
}

/** Portraits: a character's own, a creature's bestiary thumbnail, or (in the row) their initial. */
function usePortraits(campaign) {
  const [bestiary, setBestiary] = useState(new Map());
  useEffect(() => {
    loadBestiary().then((all) => setBestiary(new Map(all.map((b) => [b.id, b]))), () => {});
  }, []);
  const portraitOf = (c) =>
    c.kind === 'pc' ? campaign.characters.find((x) => x.id === c.characterId)?.portraitUrl : (bestiary.get(c.creatureId) && creatureThumb(bestiary.get(c.creatureId)));
  return { bestiary, portraitOf };
}

/** A character's sheet as the campaign sees it, fetched fresh each time they're opened (so their HP is current). */
function usePartySheet(campaignId, characterId, version) {
  const campaigns = useCampaignService();
  const [sheet, setSheet] = useState(null);
  useEffect(() => {
    setSheet(null);
    if (!characterId) return undefined;
    let cancelled = false;
    campaigns.character(campaignId, characterId).then((row) => !cancelled && setSheet(row), () => !cancelled && setSheet({ error: true }));
    return () => {
      cancelled = true;
    };
  }, [campaignId, characterId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  return [sheet, setSheet];
}

/** The round, who's acting and who's next, and (for the GM) the turn buttons. */
function TrackerHead({ name, state, portraitOf, mine, children }) {
  const now = currentCombatant(state);
  const next = now && currentCombatant(advanceTurn(state));
  const standing = state.combatants.filter((c) => !c.defeated);
  const foes = standing.filter((c) => c.kind === 'creature').length;
  const yours = now && mine?.has(now.characterId);
  return (
    <header className={`tracker__head ${yours ? 'tracker__head--yours' : ''}`}>
      <div className="tracker__round">
        <span className="eyebrow">{name}</span>
        <span className="tracker__round-num" aria-live="polite">Round {state.round}</span>
        <span className="tracker__tally">{foes} foe{foes === 1 ? '' : 's'} standing · {standing.length - foes} character{standing.length - foes === 1 ? '' : 's'}</span>
      </div>
      <div className="tracker__spotlight" aria-live="polite">
        {now ? (
          <>
            <Portrait url={portraitOf(now)} name={now.name} size="md" />
            <span className="tracker__spotlight-text">
              <span className="eyebrow">{yours ? 'Your turn' : 'Now acting'}</span>
              <span className="tracker__spotlight-name">{now.name}</span>
              {next && next.key !== now.key && <span className="tracker__up-next">Up next: {next.name}</span>}
            </span>
          </>
        ) : (
          <span className="tracker__spotlight-text"><span className="tracker__spotlight-name">Everyone is down</span></span>
        )}
      </div>
      {children}
    </header>
  );
}

/**
 * The turn order as rows. With gm (the GM's tracker): initiatives to edit, Hit Points bars
 * and AC, and moving anyone by dragging (or the up and down buttons, for keyboards and
 * touch). Without it (a player watching): names and initiatives only, and only characters
 * open in the drawer; creatures' details stay the GM's.
 */
function OrderList({ combatants, current, open, onOpen, portraitOf, gm, vitals = new Map(), linkOf, actions = {}, onActions = null }) {
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const drop = (target) => {
    if (dragging && dragging !== target) gm.move(dragging, combatants.findIndex((c) => c.key === target));
    setDragging(null);
    setOver(null);
  };
  return (
    <ol className={`tracker__order ${gm ? '' : 'tracker__order--watch'}`} aria-label="Initiative order">
      {combatants.map((c, i) => {
        // The GM opens anyone in the drawer; players open a character's sheet in a new tab.
        const link = !gm && c.kind === 'pc' && linkOf?.(c);
        const who = (
          <>
            <Portrait url={portraitOf(c)} name={c.name} size="sm" />
            <span className="tracker__who">
              <span className="tracker__who-name">{c.name}</span>
              <span className="tracker__who-sub">
                {c.key === current ? <span className="tracker__now">Acting</span> : c.defeated ? <span className="tracker__downtag">Down</span> : null}
                {c.kind === 'pc' ? 'Character' : 'Creature'}
              </span>
              <ConditionBadges conditions={c.conditions} />
            </span>
          </>
        );
        return (
          <li
            key={c.key}
            className={`tracker__row tracker__row--${c.kind} ${c.defeated ? 'tracker__row--down' : ''} ${open === c.key ? 'tracker__row--open' : ''} ${dragging === c.key ? 'tracker__row--dragging' : ''} ${over === c.key && dragging !== c.key ? 'tracker__row--over' : ''}`}
            aria-current={c.key === current ? 'true' : undefined}
            onDragOver={gm ? (e) => { e.preventDefault(); setOver(c.key); } : undefined}
            onDrop={gm ? (e) => { e.preventDefault(); drop(c.key); } : undefined}
          >
            {gm && (
              <span
                className="tracker__grip"
                draggable
                title="Drag to move in the order"
                aria-hidden="true"
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', c.key);
                  e.dataTransfer.setDragImage(e.currentTarget.parentElement, 24, 24);
                  setDragging(c.key);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
              >
                ⠿
              </span>
            )}
            {gm ? (
              <label className="tracker__init">
                <span className="visually-hidden">Initiative for {c.name}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={c.initiative ?? ''}
                  onChange={(e) => gm.setInitiative(c.key, e.target.value === '' ? null : Math.trunc(Number(e.target.value)))}
                  onBlur={() => gm.place(c.key)}
                />
              </label>
            ) : (
              <span className="tracker__init tracker__init--read">{c.initiative ?? '—'}</span>
            )}
            {gm ? (
              <button type="button" className="tracker__name" aria-pressed={open === c.key} onClick={() => onOpen(open === c.key ? null : c.key)}>{who}</button>
            ) : link ? (
              <a className="tracker__name" href={link} target="_blank" rel="noreferrer">
                {who}
                <span className="visually-hidden"> (opens their sheet in a new tab)</span>
              </a>
            ) : (
              <span className="tracker__name tracker__name--still">{who}</span>
            )}
            {(gm || c.kind === 'pc') ? <HpBar c={c} vitals={vitals.get(c.characterId)} /> : <span />}
            {gm && <span className="tracker__ac" title="Armor Class"><small>AC</small>{c.ac ?? '—'}</span>}
            {gm && (
              <span className="tracker__move">
                <button type="button" className="icon-button" aria-label={`Move ${c.name} up the order`} disabled={i === 0} onClick={() => gm.move(c.key, i - 1)}>▲</button>
                <button type="button" className="icon-button" aria-label={`Move ${c.name} down the order`} disabled={i === combatants.length - 1} onClick={() => gm.move(c.key, i + 1)}>▼</button>
              </span>
            )}
            {/* Last, so it takes its own line under the row without pushing the cells above. */}
            <span className="tracker__actions">
              <ActionPips name={c.name} entry={actions[c.key]} onChange={onActions && ((entry) => onActions(c.key, entry))} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The GM's initiative tracker for a saved encounter: roll initiative for every creature and
 * character, then step through turns and rounds, tracking creature Hit Points and who's
 * down, and moving anyone in the order. Every change is saved, so the encounter can be
 * closed and resumed, and the players follow it (EncounterWatchPage).
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
  const [open, setOpen] = useState(null);
  const { bestiary, portraitOf } = usePortraits(campaign);
  const openPc = state?.combatants.find((c) => c.key === open && c.kind === 'pc');
  const [sheet, setSheet] = usePartySheet(id, openPc?.characterId);
  // Characters' Hit Points and shields as they are now (the players change them too).
  const live = useRunningEncounter(id, Boolean(state));
  const vitals = new Map((live?.combatants ?? []).filter((c) => c.kind === 'pc').map((c) => [c.characterId, c]));
  // Everyone's actions this turn: the feed's (players mark their own), with the GM's marks shown at once.
  const [actions, setActions] = useState({});
  const liveActions = JSON.stringify(live?.actions ?? {});
  useEffect(() => setActions(JSON.parse(liveActions)), [liveActions]);
  const markActions = (key, entry) => {
    setActions((a) => ({ ...a, [key]: entry }));
    api.setEncounterActions(id, key, entry).then(({ actions: saved }) => setActions(saved), (err) => setErrors(errorsFrom(err)));
  };
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

  if (!campaign.isGm) return <Navigate to={`/campaigns/${id}/encounter`} replace />;
  if (!encounter) return <div className="narrow"><FormErrors errors={errors} />{!errors.length && <p className="muted italic center">Opening the encounter…</p>}</div>;

  // Every change goes to the server; if a save fails, say so and keep the change on screen.
  const save = (next) => {
    // A new round gives everyone fresh actions, and a turn moving to someone gives them theirs (the server clears them too).
    if (next.round !== state?.round) setActions({});
    else if (next.current && next.current !== state?.current) setActions(({ [next.current]: _, ...rest }) => rest);
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

  const now = currentCombatant(state);
  const opened = state.combatants.find((c) => c.key === open);
  const pcControls = opened?.kind === 'pc' && sheet?.summary && (
    <CharacterHpControls
      key={opened.key}
      campaignId={id}
      c={opened}
      shield={sheet.summary.shield}
      onDone={(r) => setSheet((s) => ({ ...s, currentHp: r.currentHp, summary: { ...s.summary, shield: r.shield } }))}
    />
  );
  const controls = opened && <DrawerControls c={opened} pc={pcControls} onChange={(patch) => setCombatant(opened.key, patch)} />;
  const detail = !opened
    ? null
    : opened.kind === 'pc'
      ? characterDetail(opened, sheet, controls, `/campaigns/${id}/characters/${opened.characterId}/sheet`)
      : creatureDetail(opened, bestiary.get(opened.creatureId), controls);
  const gm = {
    // Typing a new initiative keeps the row still; it moves to its place when you leave the box.
    setInitiative: (key, initiative) => setCombatant(key, { initiative }),
    place: (key) => save(placeByInitiative(state, key)),
    move: (key, toIndex) => save(moveCombatant(state, key, toIndex)),
  };

  return (
    <RollProvider targets={state.combatants.filter((c) => !c.defeated && c.ac != null)}>
    <div className="tracker">
      <TrackerHead name={encounter.name} state={state} portraitOf={portraitOf}>
        <div className="tracker__turn-buttons">
          <button type="button" className="btn" onClick={() => save(advanceTurn(state, -1))}>Previous</button>
          <button type="button" className="btn btn--blood tracker__next" disabled={!now} onClick={() => save(endTurn(state))}>Next turn</button>
        </div>
      </TrackerHead>
      <FormErrors errors={errors} />
      <OrderList combatants={state.combatants} current={state.current} open={open} onOpen={setOpen} portraitOf={portraitOf} gm={gm} vitals={vitals} actions={actions} onActions={markActions} />
      <p className="rule-note">
        Tap the diamonds to mark the actions and reaction someone has spent; everyone at the table sees them, and players mark their own from the Combat tab.
        Tap anyone for their details, Hit Points and actions. Drag a row by its handle (or use its arrows) to move someone in the order.
        Changes save as you go, and your players see the order, never your creatures' numbers.
      </p>

      <div className="tracker__foot">
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
      <Drawers detail={detail} onClose={() => setOpen(null)} />
    </div>
    </RollProvider>
  );
}

/**
 * The tracker's drawers: someone's details on the right, where a creature's attack bonuses and
 * damage dice roll (as on a character sheet), and the roll on the left.
 */
function Drawers({ detail, onClose }) {
  const { rollCheck, rollDamage } = useTable();
  const [rolling, setRolling] = useState(false);
  const closeRoll = useCallback(() => setRolling(false), []);
  const rolled = (roll) => roll && setRolling(true);
  return (
    <>
      <RollDrawer open={rolling} onClose={closeRoll} />
      <DetailsDrawer
        detail={detail}
        onClose={() => { setRolling(false); onClose(); }}
        onRollAttack={(label, bonus) => rolled(rollCheck(label, { total: bonus, parts: [] }))}
        onRollDice={(label, expr, type) => rolled(rollDamage(label, expr, type))}
      />
    </>
  );
}

/**
 * A player's view of the campaign's running encounter (the Encounter tab, there while one
 * runs): the round, who's acting and the order, following the GM every few seconds.
 * Characters open in the drawer; creatures don't, and their HP and AC never reach players.
 */
export function EncounterWatchPage() {
  const { id } = useParams();
  const { campaign, running } = useCampaign();
  const { portraitOf } = usePortraits(campaign);
  useCampaignCrumbs([{ label: running?.name ?? 'Encounter' }]);

  if (campaign.isGm) return <Navigate to={`/campaigns/${id}/encounters`} replace />;
  if (!running) {
    return <p className="panel panel--dashed muted italic center">No encounter is running right now. When your GM starts one, it shows up here.</p>;
  }
  const mine = new Set(campaign.characters.filter((c) => c.mine).map((c) => c.id));
  const vitals = new Map(running.combatants.filter((c) => c.kind === 'pc').map((c) => [c.characterId, c]));
  // Your own character opens to play (their Combat tab); anyone else's opens their sheet.
  const linkOf = (c) => (mine.has(c.characterId) ? `/play/${c.characterId}/combat` : `/campaigns/${id}/characters/${c.characterId}/sheet`);
  return (
    <div className="tracker">
      <TrackerHead name={running.name} state={running} portraitOf={portraitOf} mine={mine} />
      <OrderList combatants={running.combatants} current={running.current} portraitOf={portraitOf} gm={null} vitals={vitals} linkOf={linkOf} actions={running.actions} />
      <p className="rule-note">Your GM runs the turns; this follows along. Tap a character to open their sheet in a new tab.</p>
    </div>
  );
}
