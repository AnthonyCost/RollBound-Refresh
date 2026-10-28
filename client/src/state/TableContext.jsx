import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  maxHp,
  strikeBonus,
  degreeOfSuccess,
  strikeDamage,
  damageModifier,
  rollDie,
  endOfTurn,
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

const TableContext = createContext(null);


// Characters start with no conditions. (This used to be a sample Frightened 1 to
// show off condition math; with the Turn tab hidden there'd be no way to clear it.)
const STARTING_CONDITIONS = [];

/**
 * Whether the character is in an active encounter. The Turn, Roll and GM screens
 * only show during one. Always false until the campaign manager's encounter
 * tracker exists; then it should be true when this character's campaign has an
 * encounter with an active status that includes them.
 */
const ENCOUNTER_ACTIVE = false;

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
  const [targetAC, setTargetAC] = useState(15);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const strikesSoFar = used.filter((a) => a.id === 'strike').length;
  const actionsLeft = 3 - used.length;

  const takeAction = useCallback(
    (action, detail = '') => {
      if (used.length >= 3) return false;
      setUsed((u) => [...u, { id: action.id, name: action.name, detail }]);
      if (action.id === 'shield') setShieldRaised(true);
      return true;
    },
    [used.length],
  );

  const strike = useCallback(
    (weapon) => {
      if (used.length >= 3) return null;
      const bonus = strikeBonus(character, weapon, { attacksSoFar: strikesSoFar, conditions });
      const natural = rollDie(20);
      const total = natural + bonus.total;
      const degree = degreeOfSuccess(total, targetAC, natural);
      const damageRoll = rollDie(weapon.die);
      const damageMod = damageModifier(weapon, character.abilities);
      const damage = strikeDamage(damageRoll, damageMod, degree.name);

      const roll = {
        weapon,
        natural,
        bonus,
        total,
        dc: targetAC,
        degree,
        damageRoll,
        damageMod,
        damage,
        attackNumber: strikesSoFar + 1,
      };
      setLastRoll(roll);
      setUsed((u) => [...u, { id: 'strike', name: 'Strike', detail: `${total} vs AC ${targetAC}: ${degree.name}` }]);
      return roll;
    },
    [character, conditions, strikesSoFar, targetAC, used.length],
  );

  const endTurn = useCallback(() => {
    setUsed([]);
    setConditions((c) => endOfTurn(c));
    setShieldRaised(false); // a raised shield lasts until the start of your next turn
    setRound((r) => r + 1);
  }, []);

  const cycleCondition = useCallback((id, valued) => {
    setConditions((list) => {
      const current = list.find((c) => c.id === id);
      if (!valued) return current ? list.filter((c) => c.id !== id) : [...list, { id }];
      if (!current) return [...list, { id, value: 1 }];
      if (current.value >= 3) return list.filter((c) => c.id !== id);
      return list.map((c) => (c.id === id ? { ...c, value: c.value + 1 } : c));
    });
  }, []);

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
      encounterActive: ENCOUNTER_ACTIVE && !readOnly,
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
      loading: loading || !gearReady,
      notFound,
      round,
      conditions,
      shieldRaised,
      used,
      actionsLeft,
      strikesSoFar,
      targetAC,
      setTargetAC,
      lastRoll,
      takeAction,
      strike,
      endTurn,
      cycleCondition,
      resetEncounter,
    }),
    [character, baseCharacter, gearReady, characterId, readOnly, portraitUrl, campaign, shareId, max, currentHp, setHp, hpError, inventory, setInventory, inventoryStatus, backstory, setBackstory, backstoryStatus, prepared, setPrepared, preparedStatus, shield, setShieldDamage, loading, notFound, round, conditions, shieldRaised, used, actionsLeft, strikesSoFar, targetAC, lastRoll, takeAction, strike, endTurn, cycleCondition, resetEncounter],
  );

  return <TableContext.Provider value={value}>{children}</TableContext.Provider>;
}

export function useTable() {
  const ctx = useContext(TableContext);
  if (!ctx) throw new Error('useTable must be used inside <TableProvider>');
  return ctx;
}
