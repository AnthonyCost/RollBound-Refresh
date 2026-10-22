import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  mira,
  maxHp,
  strikeBonus,
  degreeOfSuccess,
  strikeDamage,
  rollDie,
  endOfTurn,
} from '@rollbound/rules';
import { api } from '../api.js';

const TableContext = createContext(null);

const STARTING_CONDITIONS = [{ id: 'frightened', value: 1 }];

/**
 * Holds everything happening "at the table" for one character: conditions,
 * the actions spent this turn, the last roll, and the GM-entered target AC.
 */
export function TableProvider({ children }) {
  const [character, setCharacter] = useState(null);
  const [characterId, setCharacterId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const [round, setRound] = useState(1);
  const [conditions, setConditions] = useState(STARTING_CONDITIONS);
  const [shieldRaised, setShieldRaised] = useState(false);
  const [used, setUsed] = useState([]);
  const [targetAC, setTargetAC] = useState(15);
  const [lastRoll, setLastRoll] = useState(null);

  // Load the first saved character from the API; fall back to the bundled sample.
  useEffect(() => {
    let cancelled = false;
    api
      .listCharacters()
      .then((rows) => {
        if (cancelled) return;
        if (rows.length) {
          setCharacterId(rows[0].id);
          setCharacter(rows[0].data);
        } else {
          setCharacter(mira);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setOffline(true);
        setCharacter(mira);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

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
      const damageMod = character.abilities.str; // melee Strikes add Strength to damage
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
      hp: character ? maxHp(character) : 0,
      loading,
      offline,
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
    [character, characterId, loading, offline, round, conditions, shieldRaised, used, actionsLeft, strikesSoFar, targetAC, lastRoll, takeAction, strike, endTurn, cycleCondition, resetEncounter],
  );

  return <TableContext.Provider value={value}>{children}</TableContext.Provider>;
}

export function useTable() {
  const ctx = useContext(TableContext);
  if (!ctx) throw new Error('useTable must be used inside <TableProvider>');
  return ctx;
}
