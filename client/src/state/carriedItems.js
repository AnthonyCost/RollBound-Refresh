import { useEffect, useState } from 'react';
import { consumableUse } from '@rollbound/rules';
import { loadArmory, loadItemDetails } from './armory.js';

const USABLE = new Set(['Consumables', 'Alchemical Items']);

/**
 * The consumables a character carries that can be activated, matched to the armory by name
 * (a grade's name too: Healing Potion (Minor)), with how they're used:
 * [{ key, name, qty, cost, heal, text }]. Loads the armory, and each item's rules text, on first use.
 */
export function useCarriedConsumables(inventory) {
  const [found, setFound] = useState([]);
  const names = (inventory?.items ?? []).map((i) => `${i.key}:${i.name}:${i.qty}`).join('|');
  useEffect(() => {
    const items = inventory?.items ?? [];
    if (!items.length) return setFound([]);
    let live = true;
    loadArmory()
      .then(async (armory) => {
        const byName = new Map();
        for (const a of armory) {
          if (!USABLE.has(a.category)) continue;
          byName.set(a.name.toLowerCase(), a);
          for (const v of a.variants ?? []) byName.set(v.name.toLowerCase(), a);
        }
        const out = [];
        for (const i of items) {
          const a = byName.get(i.name.trim().toLowerCase());
          if (!a) continue;
          const use = consumableUse(await loadItemDetails(a), i.name);
          if (use.cost) out.push({ key: i.key, name: i.name, qty: i.qty, ...use });
        }
        if (live) setFound(out);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [names]);
  return found;
}
