import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  maxHp,
  strikeBonus,
  damageModifier,
  rollDie,
  rollDice,
  endOfTurn,
  cycleCondition as nextConditions,
  equipCharacter,
  withEquipped,
  preparedSpells,
  shieldState,
  setItemDamage,
  startingInventory,
} from '@rollbound/rules';
import { api } from '../api.js';
import { useDelayedSave } from './useDelayedSave.js';
import { useRules } from './useRules.js';
import { useCampaignService } from './campaignService.js';
import { useRunningEncounter } from './runningEncounter.js';

const TableContext = createContext(null);

/** A d20 check: d20 + stat.total ({ total, parts }). */
const newCheck = (label, stat) => {
  const natural = rollDie(20);
  return { kind: 'check', label, natural, bonus: stat, total: natural + stat.total };
};
/** Damage dice ("1d8+4", "2d6"): { kind: 'damage', dice, mod, total }, or null if expr isn't dice. */
const newDamage = (label, expr, damageType = '') => {
  const r = rollDice(expr);
  return r && { kind: 'damage', label, expr, damageType, ...r };
};

/**
 * The roller without a character, for the GM's encounter tracker: just the last roll and the
 * two ways to make one, on the same context, so the roll drawer (RollView) works as on a sheet.
 * gm: the roller leaves out "ask your GM". targets: the combatants an attack can be aimed at ({ key, name, ac }).
 */
export function RollProvider({ targets = [], children }) {
  const [lastRoll, setLastRoll] = useState(null);
  const value = useMemo(() => ({
    gm: true,
    targets,
    lastRoll,
    rollCheck: (label, stat) => { const roll = newCheck(label, stat); setLastRoll(roll); return roll; },
    rollDamage: (label, expr, damageType) => { const roll = newDamage(label, expr, damageType); if (roll) setLastRoll(roll); return roll; },
  }), [lastRoll, targets]);
  return <TableContext.Provider value={value}>{children}</TableContext.Provider>;
}


// Characters start with no conditions. (This used to be a sample Frightened 1 to
// show off condition math; with the Turn tab hidden there'd be no way to clear it.)
const STARTING_CONDITIONS = [];


/** How long to wait after the last change before saving it. */
const HP_SAVE_DELAY = 500;
const INVENTORY_SAVE_DELAY = 600;
const BACKSTORY_SAVE_DELAY = 1000;
const PREPARED_SAVE_DELAY = 600;

// What equipping from the inventory needs from the rules data.
const GEAR_TYPES = ['weapons', 'armor', 'shields'];

/**
 * Holds everything happening "at the table" for one character: hit points,
 * conditions, the actions spent this turn, the last roll, and the GM-entered
 * target AC. Given a shareId instead of a characterId, it loads someone's shared
 * sheet read-only; given party ({ campaignId, characterId }), a party member's
 * sheet read-only, which only the campaign's GM and players can open.
 */
export function TableProvider({ characterId, shareId: sharedId, party, children }) {
  const readOnly = Boolean(sharedId || party);
  const campaigns = useCampaignService();
  // The sheet as built (saved, and replaced by rules updates or builder edits).
  const [baseCharacter, setCharacter] = useState(null);
  const [portraitUrl, setPortraitUrl] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [shareId, setShareId] = useState(null);
  const [storedHp, setStoredHp] = useState(null);
  // null until first edited: the Inventory tab starts from the builder's gear.
  const [inventory, setStoredInventory] = useState(null);
  const [backstory, setStoredBackstory] = useState('');
  // null until first changed: the first spells they know (see preparedSpells).
  const [storedPrepared, setStoredPrepared] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [round, setRound] = useState(1);
  const [conditions, setConditions] = useState(STARTING_CONDITIONS);
  const [shieldRaised, setShieldRaised] = useState(false);
  const [used, setUsed] = useState([]);
  const [lastRoll, setLastRoll] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (party ? campaigns.character(party.campaignId, party.characterId) : sharedId ? api.getSharedSheet(sharedId) : api.getCharacter(characterId))
      .then((row) => {
        if (cancelled) return;
        setCharacter(row.data);
        setPortraitUrl(row.portraitUrl);
        setCampaign(row.campaignName ? { id: row.campaignId ?? null, name: row.campaignName, books: row.campaignBooks ?? null } : null);
        setShareId(row.shareId ?? null);
        setStoredHp(row.currentHp);
        setStoredInventory(row.inventory ?? null);
        setStoredBackstory(row.backstory ?? '');
        setStoredPrepared(row.prepared ?? null);
      })
      .catch(() => !cancelled && setNotFound(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // party is a new object each render; its ids are what matter.
  }, [characterId, sharedId, readOnly, party?.campaignId, party?.characterId, campaigns]);

  // The sheet everyone reads: the built sheet with the inventory's equipped weapons,
  // armor and shield. With an inventory, wait for the gear data so AC doesn't jump.
  const gear = useRules(GEAR_TYPES);
  const gearReady = !inventory || Boolean(gear);
  const character = useMemo(
    () => (baseCharacter && inventory && gear && !gear.error ? equipCharacter(baseCharacter, inventory, gear) : baseCharacter),
    [baseCharacter, inventory, gear],
  );

  // Changes save a moment after the last edit. The read-only views never save.
  const [scheduleHp, hpStatus] = useDelayedSave((v) => api.setHp(characterId, v), HP_SAVE_DELAY);
  const [scheduleInventory, inventoryStatus] = useDelayedSave((v) => api.setInventory(characterId, v), INVENTORY_SAVE_DELAY);
  const [scheduleBackstory, backstoryStatus] = useDelayedSave((v) => api.setBackstory(characterId, v), BACKSTORY_SAVE_DELAY);
  const [schedulePrepared, preparedStatus] = useDelayedSave((v) => api.setPrepared(characterId, v), PREPARED_SAVE_DELAY);

  // Hit points: null means full.
  const max = character ? maxHp(character) : 0;
  const currentHp = Math.min(storedHp ?? max, max);
  const setHp = useCallback(
    (value) => {
      if (readOnly) return;
      const hp = Math.max(0, Math.min(max, Math.round(value)));
      setStoredHp(hp);
      scheduleHp(hp);
    },
    [readOnly, max, scheduleHp],
  );
  const setInventory = useCallback(
    (changed) => {
      if (readOnly) return;
      // Spell out every equipped flag, so an inventory from before equipping keeps its gear on.
      const next = withEquipped(changed);
      setStoredInventory(next);
      scheduleInventory(next);
    },
    [readOnly, scheduleInventory],
  );
  const setBackstory = useCallback(
    (text) => {
      if (readOnly) return;
      setStoredBackstory(text);
      scheduleBackstory(text);
    },
    [readOnly, scheduleBackstory],
  );
  // The equipped shield's Hit Points, Hardness and Broken Threshold; null without one.
  // Before the inventory is first edited, the shield is the builder's.
  const currentInventory = useMemo(
    () => inventory ?? (baseCharacter && gear && !gear.error ? startingInventory(baseCharacter, gear) : null),
    [inventory, baseCharacter, gear],
  );
  const shield = useMemo(() => (gear && !gear.error ? shieldState(currentInventory, gear) : null), [currentInventory, gear]);
  /** Sets the equipped shield's damage (Hit Points lost), saved with the inventory. */
  const setShieldDamage = useCallback(
    (damage) => {
      if (readOnly || !shield || !currentInventory) return;
      setInventory(setItemDamage(currentInventory, shield.key, Math.min(shield.max, damage)));
    },
    [readOnly, shield, currentInventory, setInventory],
  );
  /**
   * Shield Block (Player Core): the raised shield prevents damage equal to its Hardness,
   * and the shield and you each take whatever is left. A broken shield can't block.
   * Returns { stopped, through }, or null when there's no shield that can block.
   */
  const shieldBlock = useCallback(
    (amount) => {
      if (readOnly || !shield || shield.broken) return null;
      const through = Math.max(0, amount - shield.hardness);
      setShieldDamage(shield.max - shield.current + through);
      if (through) setHp(currentHp - through);
      return { stopped: amount - through, through };
    },
    [readOnly, shield, setShieldDamage, setHp, currentHp],
  );
  // Spells prepared today, for casters who prepare from the spells they know; null for others.
  const prepared = useMemo(() => preparedSpells(character, storedPrepared), [character, storedPrepared]);
  /** Saves a prepared list: { cantrips, slots } of spell keys (see preparedValue). */
  const setPrepared = useCallback(
    (value) => {
      if (readOnly) return;
      setStoredPrepared(value);
      schedulePrepared(value);
    },
    [readOnly, schedulePrepared],
  );
  const hpError = hpStatus === 'error' ? "Couldn't save hit points. Check your connection and try again." : null;

  // While this is your own character in a campaign, follow the GM's running encounter.
  const encounter = useRunningEncounter(campaign?.id ?? null, !readOnly);
  const me = encounter?.combatants.find((c) => String(c.characterId) === String(characterId)) ?? null;
  const encounterActive = Boolean(me) && !readOnly;
  // The GM can change your Hit Points and shield from the tracker. Take a change from the feed
  // only when the server's value has moved since we last saw it, so a change of yours that's
  // still saving is never undone by an older answer.
  const seen = useRef({});
  const feedHp = me?.hp;
  const feedShield = me?.shield ? `${me.shield.key}:${me.shield.current}` : null;
  useEffect(() => {
    if (feedHp == null) return;
    if (seen.current.hp !== undefined && feedHp !== seen.current.hp) setStoredHp(feedHp);
    seen.current.hp = feedHp;
  }, [feedHp]);
  // Conditions the GM sets on you in the tracker. They're only kept with the encounter, so
  // take them on first sight too (a fresh page starts with none); after that, on each change.
  const feedConditions = me?.conditions ? JSON.stringify(me.conditions) : null;
  useEffect(() => {
    if (!feedConditions) return;
    if (feedConditions !== seen.current.conditions) setConditions(me.conditions);
    seen.current.conditions = feedConditions;
  }, [feedConditions]);
  useEffect(() => {
    if (!feedShield) return;
    // On our own equipped shield: an inventory that was never edited gets fresh item keys
    // wherever it's built, so the server's key needn't match ours.
    if (seen.current.shield !== undefined && feedShield !== seen.current.shield && currentInventory && shield) {
      setStoredInventory(setItemDamage(currentInventory, shield.key, me.shield.max - me.shield.current));
    }
    seen.current.shield = feedShield;
  }, [feedShield]);
  const myTurn = encounterActive && encounter.current === me.key;
  // A new turn of yours: three fresh actions (a reaction spent earlier this round stays spent),
  // and a raised shield comes down. A new round refreshes your actions and reaction, as the table's do.
  const encounterRound = encounterActive ? encounter.round : null;
  useEffect(() => {
    if (encounterRound != null) setUsed([]);
  }, [encounterRound]);
  useEffect(() => {
    if (!myTurn) return;
    setUsed((u) => u.filter((a) => a.reaction));
    setShieldRaised(false);
  }, [myTurn, encounter?.round]);

  // In a running encounter, your actions and reaction go to the table (the tracker and the
  // Encounter tab show everyone's). Only after you change them here, so opening the page
  // doesn't wipe what the GM marked; a new turn of yours clears them on the server already.
  const spent = Math.min(3, used.reduce((n, a) => n + (a.cost ?? 1), 0));
  const reactionUsed = used.some((a) => a.reaction);
  const pushed = useRef(null);
  useEffect(() => {
    const entry = JSON.stringify({ used: spent, reaction: reactionUsed });
    if (!encounterActive) { pushed.current = null; return; }
    if (pushed.current === null) { pushed.current = entry; return; }
    if (entry === pushed.current) return;
    pushed.current = entry;
    api.setEncounterActions(campaign.id, me.key, { used: spent, reaction: reactionUsed }).catch(() => {}); // a missed push is caught up by the next
  }, [encounterActive, spent, reactionUsed]);

  const strikesSoFar = used.filter((a) => a.id === 'strike').length;
  // Each action spent this turn has a cost: 1, 2 or 3 actions (reactions and free actions cost none).
  const actionsLeft = 3 - spent;

  const takeAction = useCallback(
    (action, detail = '', cost = 1) => {
      if (cost > actionsLeft) return false;
      setUsed((u) => [...u, { id: action.id, name: action.name, detail, cost, reaction: action.cost === 'reaction' }]);
      if (action.id === 'shield') setShieldRaised(true);
      return true;
    },
    [actionsLeft],
  );

  const strike = useCallback(
    (weapon) => {
      if (actionsLeft < 1) return null;
      const bonus = strikeBonus(character, weapon, { attacksSoFar: strikesSoFar, conditions });
      const natural = rollDie(20);
      const total = natural + bonus.total;
      // The target's AC, the result and the damage it deals are settled after the roll (RollPage).
      const roll = {
        weapon,
        natural,
        bonus,
        total,
        damageRoll: rollDie(weapon.die),
        damageMod: damageModifier(weapon, character.abilities),
        attackNumber: strikesSoFar + 1,
      };
      setLastRoll(roll);
      setUsed((u) => [...u, { id: 'strike', name: `Strike (${weapon.name})`, detail: `${total} to hit`, cost: 1 }]);
      return roll;
    },
    [character, conditions, strikesSoFar, actionsLeft],
  );

  /**
   * Rolls a check from the sheet (d20 + a modifier: a skill, a save, Perception, a spell
   * attack, or a weapon's attack, which also rolls its damage); the DC is entered after it.
   * It spends no actions; the Combat tab's Strike does that. label names it, stat is its { total, parts }.
   */
  const rollCheck = useCallback(
    (label, stat, weapon = null) => {
      const roll = newCheck(label, stat);
      if (weapon) Object.assign(roll, { weapon, damageRoll: rollDie(weapon.die), damageMod: damageModifier(weapon, character.abilities) });
      setLastRoll(roll);
      return roll;
    },
    [character],
  );

  /** Rolls damage ("1d8+4", "2d6"), for a weapon or a spell's text: { kind: 'damage', dice, mod, total }. */
  const rollDamage = useCallback((label, expr, damageType = '') => {
    const roll = newDamage(label, expr, damageType);
    if (roll) setLastRoll(roll);
    return roll;
  }, []);
  // Healing from an item (a potion): rolled like damage, shown as Hit Points regained.
  // applied false: only rolled (from an item's rules text), not added to Hit Points.
  const rollHealing = useCallback((label, expr, applied = true) => {
    const roll = newDamage(label, expr);
    if (roll) setLastRoll({ ...roll, heal: true, applied });
    return roll;
  }, []);

  const endTurn = useCallback(() => {
    setUsed([]);
    setConditions((c) => endOfTurn(c));
    setShieldRaised(false); // a raised shield lasts until the start of your next turn
    setRound((r) => r + 1);
  }, []);

  const cycleCondition = useCallback((id) => setConditions((list) => nextConditions(list, id)), []);

  const resetEncounter = useCallback(() => {
    setUsed([]);
    setConditions(STARTING_CONDITIONS);
    setShieldRaised(false);
    setRound(1);
    setLastRoll(null);
  }, []);

  const value = useMemo(
    () => ({
      character,
      baseCharacter,
      characterId,
      setCharacter,
      readOnly,
      encounterActive,
      encounter: encounterActive ? encounter : null,
      myTurn,
      portraitUrl,
      setPortraitUrl,
      campaign,
      campaignName: campaign?.name ?? null,
      shareId,
      setShareId,
      maxHp: max,
      currentHp,
      setHp,
      hpError,
      inventory,
      // What they carry now: the saved inventory, or the builder's until it's first edited.
      carried: currentInventory,
      setInventory,
      inventoryStatus,
      backstory,
      setBackstory,
      backstoryStatus,
      prepared,
      setPrepared,
      preparedStatus,
      shield,
      setShieldDamage,
      shieldBlock,
      loading: loading || !gearReady,
      notFound,
      // In a running encounter, the GM's round; otherwise the practice round on the Combat tab.
      round: encounterActive ? encounter.round : round,
      conditions,
      shieldRaised,
      used,
      actionsLeft,
      strikesSoFar,
      lastRoll,
      rollCheck,
      rollDamage,
      rollHealing,
      takeAction,
      strike,
      endTurn,
      cycleCondition,
      resetEncounter,
    }),
    [encounter, encounterActive, myTurn, character, baseCharacter, gearReady, characterId, readOnly, portraitUrl, campaign, shareId, max, currentHp, setHp, hpError, inventory, currentInventory, setInventory, inventoryStatus, backstory, setBackstory, backstoryStatus, prepared, setPrepared, preparedStatus, shield, setShieldDamage, shieldBlock, loading, notFound, round, conditions, shieldRaised, used, actionsLeft, strikesSoFar, lastRoll, rollCheck, rollDamage, rollHealing, takeAction, strike, endTurn, cycleCondition, resetEncounter],
  );

  return <TableContext.Provider value={value}>{children}</TableContext.Provider>;
}

export function useTable() {
  const ctx = useContext(TableContext);
  if (!ctx) throw new Error('useTable must be used inside <TableProvider>');
  return ctx;
}
