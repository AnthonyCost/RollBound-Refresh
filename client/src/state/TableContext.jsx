import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  mira,
  maxHp,
  strikeBonus,
  degreeOfSuccess,
  strikeDamage,
  damageModifier,
  rollDie,
  endOfTurn,
} from '@rollbound/rules';
import { api } from '../api.js';
import { DEMO_ID_PREFIX, getDemoCharacter } from './demoCharacters.js';
import { demoPortraitUrl } from './portraits.js';
import { demoMemberships } from './demoCampaigns.js';

const TableContext = createContext(null);

export const DEMO_CHARACTER_ID = 'demo';

const STARTING_CONDITIONS = [{ id: 'frightened', value: 1 }];

/** How long to wait after the last hit point change before saving it. */
const HP_SAVE_DELAY = 500;

/**
 * Holds everything happening "at the table" for one character: hit points,
 * conditions, the actions spent this turn, the last roll, and the GM-entered
 * target AC. Given a shareId instead of a characterId, it loads someone's shared
 * sheet read-only.
 */
export function TableProvider({ characterId, shareId: sharedId, children }) {
  const readOnly = Boolean(sharedId);
  const [character, setCharacter] = useState(null);
  const [portraitUrl, setPortraitUrl] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [shareId, setShareId] = useState(null);
  const [storedHp, setStoredHp] = useState(null);
  const [hpError, setHpError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [round, setRound] = useState(1);
  const [conditions, setConditions] = useState(readOnly ? [] : STARTING_CONDITIONS);
  const [shieldRaised, setShieldRaised] = useState(false);
  const [used, setUsed] = useState([]);
  const [targetAC, setTargetAC] = useState(15);
  const [lastRoll, setLastRoll] = useState(null);

  useEffect(() => {
    if (!readOnly && (characterId === DEMO_CHARACTER_ID || characterId.startsWith(DEMO_ID_PREFIX))) {
      const local = characterId === DEMO_CHARACTER_ID ? mira : getDemoCharacter(characterId)?.data;
      if (local) {
        const joined = demoMemberships()[characterId];
        setCharacter(local);
        setPortraitUrl(demoPortraitUrl(characterId));
        setCampaign(joined ? { id: joined.id, name: joined.name } : null);
      } else setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (readOnly ? api.getSharedSheet(sharedId) : api.getCharacter(characterId))
      .then((row) => {
        if (cancelled) return;
        setCharacter(row.data);
        setPortraitUrl(row.portraitUrl);
        setCampaign(row.campaignName ? { id: row.campaignId ?? null, name: row.campaignName } : null);
        setShareId(row.shareId ?? null);
        setStoredHp(row.currentHp);
      })
      .catch(() => !cancelled && setNotFound(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [characterId, sharedId, readOnly]);

  // Hit points: null means full. Demo characters keep them for this visit only;
  // saved characters save them shortly after the last change.
  const max = character ? maxHp(character) : 0;
  const currentHp = Math.min(storedHp ?? max, max);
  const saveTimer = useRef(null);
  const unsaved = useRef(null);
  const saveHp = useCallback(() => {
    clearTimeout(saveTimer.current);
    if (unsaved.current === null) return;
    const hp = unsaved.current;
    unsaved.current = null;
    api.setHp(characterId, hp).catch(() => setHpError("Couldn't save hit points. Check your connection and try again."));
  }, [characterId]);
  const setHp = useCallback(
    (value) => {
      if (readOnly) return;
      const hp = Math.max(0, Math.min(max, Math.round(value)));
      setStoredHp(hp);
      setHpError(null);
      if (characterId === DEMO_CHARACTER_ID || characterId.startsWith(DEMO_ID_PREFIX)) return;
      unsaved.current = hp;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(saveHp, HP_SAVE_DELAY);
    },
    [readOnly, max, characterId, saveHp],
  );
  // Leaving the character, or closing or reloading the tab, saves a change still
  // waiting on the timer.
  useEffect(() => {
    window.addEventListener('pagehide', saveHp);
    return () => {
      window.removeEventListener('pagehide', saveHp);
      saveHp();
    };
  }, [saveHp]);

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
      characterId,
      setCharacter,
      readOnly,
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
      loading,
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
    [character, characterId, readOnly, portraitUrl, campaign, shareId, max, currentHp, setHp, hpError, loading, notFound, round, conditions, shieldRaised, used, actionsLeft, strikesSoFar, targetAC, lastRoll, takeAction, strike, endTurn, cycleCondition, resetEncounter],
  );

  return <TableContext.Provider value={value}>{children}</TableContext.Provider>;
}

export function useTable() {
  const ctx = useContext(TableContext);
  if (!ctx) throw new Error('useTable must be used inside <TableProvider>');
  return ctx;
}
