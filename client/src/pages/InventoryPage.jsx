import { useMemo, useState } from 'react';
import {
  COINS,
  COIN_NAMES,
  LIMITS,
  bulkLimits,
  bulkTotal,
  campaignData,
  coinValue,
  customItem,
  formatBulk,
  formatPrice,
  inventoryItem,
  payCoins,
  startingInventory,
  toggleEquipped,
  withEquipped,
  EQUIPPABLE,
  toWeapon,
  weaponRank,
} from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import { useRules } from '../state/useRules.js';
import Ornament from '../components/Ornament.jsx';

const GEAR_TYPES = ['weapons', 'armor', 'shields', 'items'];
const KIND_OF = { weapons: 'weapon', armor: 'armor', shields: 'shield', items: 'item' };
const LIST_OF = { weapon: 'weapons', armor: 'armor', shield: 'shields', item: 'items' };
const MATCHES_SHOWN = 12;

const bulkLabel = (bulk) => (bulk >= 1 ? String(bulk) : bulk > 0 ? 'L' : '—');
const savedLabel = { waiting: 'Saving…', saving: 'Saving…', saved: 'Saved', error: "Couldn't save. Check your connection; your next change will try again." };

/** What the character carries and their coins. The owner can change both. */
export default function InventoryPage() {
  const { character, baseCharacter, readOnly, campaign, inventory, setInventory, inventoryStatus } = useTable();
  const rules = useRules(GEAR_TYPES);
  // The campaign's books limit what can be added from the rules; custom items are always allowed.
  const view = useMemo(() => (rules && !rules.error ? campaignData(rules, campaign?.books ?? null) : null), [rules, campaign]);
  // Until the first edit, the builder's gear and leftover gold; saved on the first change.
  const starting = useMemo(() => (rules && !rules.error ? startingInventory(baseCharacter, rules) : null), [baseCharacter, rules]);
  // Every equipped flag spelled out, including for inventories saved before equipping.
  const inv = useMemo(() => (inventory ?? starting) && withEquipped(inventory ?? starting), [inventory, starting]);

  if (!inv) {
    return (
      <div className="narrow">
        <Ornament label="INVENTORY" />
        <p className="muted italic center">{rules?.error ? "Couldn't load the item list. Try refreshing." : 'Unpacking…'}</p>
      </div>
    );
  }

  const update = (changes) => setInventory({ ...inv, ...changes });
  const setItem = (key, changes) => update({ items: inv.items.map((i) => (i.key === key ? { ...i, ...changes } : i)) });
  const total = bulkTotal(inv.items);
  const limits = bulkLimits(character);
  const load = total.bulk + total.light / 10;

  return (
    <div className="narrow">
      <Ornament label="INVENTORY" />

      <section className="panel coins" aria-labelledby="coins-title">
        <div className="coins__head">
          <h1 id="coins-title" className="panel__title">Coins</h1>
          <span className="muted">Worth {formatPrice(coinValue(inv.coins))}</span>
        </div>
        <div className="coins__row">
          {COINS.map((c) => (
            <label key={c} className={`coin coin--${c}`}>
              <span className="coin__name">{COIN_NAMES[c]}</span>
              {readOnly ? (
                <span className="coin__value">{inv.coins[c]}</span>
              ) : (
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max={LIMITS.coins}
                  value={inv.coins[c]}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(LIMITS.coins, Math.floor(Number(e.target.value)) || 0));
                    update({ coins: { ...inv.coins, [c]: n } });
                  }}
                />
              )}
              <span className="coin__abbr">{c}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="panel bulk" aria-label="Bulk">
        <span>
          Bulk <strong>{formatBulk(total)}</strong>
        </span>
        <span className="muted">
          Encumbered above {limits.encumbered} · Most you can carry {limits.max}
        </span>
        {load > limits.max ? (
          <p className="rule-note rule-note--warn">That's more than {character.name} can carry.</p>
        ) : load > limits.encumbered ? (
          <p className="rule-note rule-note--warn">Encumbered: clumsy 1 and −10 feet to Speeds.</p>
        ) : null}
      </section>

      {inv.items.length ? (
        <ul className="inventory">
          {inv.items.map((item) => (
            <InventoryRow
              key={item.key}
              item={item}
              rule={rules?.[LIST_OF[item.kind]]?.find((x) => x.id === item.id)}
              readOnly={readOnly}
              character={baseCharacter}
              onChange={(changes) => setItem(item.key, changes)}
              onToggleEquipped={() => setInventory(toggleEquipped(inv, item.key))}
              onRemove={() => update({ items: inv.items.filter((i) => i.key !== item.key) })}
            />
          ))}
        </ul>
      ) : (
        <p className="panel panel--dashed muted italic center">{readOnly ? 'Carrying nothing.' : 'Nothing here yet. Add gear below.'}</p>
      )}

      {!readOnly && view && (
        <AddItem
          view={view}
          coins={inv.coins}
          full={inv.items.length >= LIMITS.items}
          onAdd={(entry, coins) => update({ items: [...inv.items, entry], ...(coins && { coins }) })}
        />
      )}

      {!readOnly && inventoryStatus !== 'idle' && (
        <p className={`rule-note center ${inventoryStatus === 'error' ? 'rule-note--warn' : ''}`} role="status">{savedLabel[inventoryStatus]}</p>
      )}
    </div>
  );
}

/** What equipping does, by kind. */
const EQUIP_NOTE = {
  weapon: 'Equipped weapons are your Strikes on the Sheet.',
  armor: 'Your AC uses the armor you wear. Wearing this takes off any other armor.',
  shield: 'Your AC uses this shield when you Raise a Shield. Equipping it puts away any other shield.',
};

/** Why equipping this would hurt: armor or a weapon the character isn't trained with. */
function untrainedNote(item, rule, character) {
  if (!rule) return null;
  if (item.kind === 'armor' && rule.category !== 'unarmored' && (character.proficiencies.armor?.[rule.category] ?? 'untrained') === 'untrained') {
    return `${character.name} isn't trained in ${rule.category} armor, so it adds no proficiency to AC. Wearing it can lower AC.`;
  }
  if (item.kind === 'weapon' && weaponRank(character, toWeapon(rule)) === 'untrained') {
    return `${character.name} isn't trained with ${rule.category} weapons, so Strikes with it add no proficiency.`;
  }
  return null;
}

function InventoryRow({ item, rule, readOnly, character, onChange, onRemove, onToggleEquipped }) {
  const equippable = EQUIPPABLE.includes(item.kind);
  const untrained = equippable && untrainedNote(item, rule, character);
  return (
    <li className={`inventory__item ${item.equipped ? 'inventory__item--equipped' : ''}`}>
      <details className="feature">
        <summary>
          <span className="inventory__name">
            {item.name}
            {item.kind !== 'item' && <span className="tag">{item.kind}</span>}
            {item.equipped && <span className="tag tag--equipped">{item.kind === 'armor' ? 'Worn' : 'Equipped'}</span>}
            {untrained && <span className="tag tag--warn">Untrained</span>}
          </span>
          <span className="inventory__meta">
            {item.qty > 1 && <span>×{item.qty}</span>}
            <span>Bulk {bulkLabel(item.bulk)}</span>
          </span>
        </summary>
        <div className="inventory__body">
          {!readOnly && (
            <div className="inventory__controls">
              <div className="stepper" role="group" aria-label="Quantity">
                <button type="button" className="btn" aria-label="One fewer" disabled={item.qty <= 1} onClick={() => onChange({ qty: item.qty - 1 })}>−</button>
                <span className="stepper__value">{item.qty}</span>
                <button type="button" className="btn" aria-label="One more" disabled={item.qty >= LIMITS.qty} onClick={() => onChange({ qty: item.qty + 1 })}>+</button>
              </div>
              <span className="btn-row">
                {equippable && (
                  <button type="button" className={`btn ${item.equipped ? '' : 'btn--blood'}`} aria-pressed={item.equipped} onClick={onToggleEquipped}>
                    {item.equipped ? (item.kind === 'armor' ? 'Take off' : 'Unequip') : item.kind === 'armor' ? 'Wear' : 'Equip'}
                  </button>
                )}
                <button type="button" className="btn inventory__remove" onClick={onRemove}>Remove</button>
              </span>
            </div>
          )}
          {!readOnly && equippable && <p className="rule-note inventory__equip-note">{EQUIP_NOTE[item.kind]}</p>}
          {untrained && <p className="rule-note rule-note--warn inventory__equip-note">{untrained}</p>}
          <p className="inventory__facts muted">
            {item.price != null && <span>Price {formatPrice(item.price)}</span>}
            <span>Bulk {bulkLabel(item.bulk)} each</span>
            {rule?.level > 0 && <span>Level {rule.level}</span>}
          </p>
          {readOnly ? (
            item.note && <p className="inventory__note">{item.note}</p>
          ) : (
            <label className="inventory__note-field">
              <span className="eyebrow">Note</span>
              <input type="text" maxLength={LIMITS.note} value={item.note} placeholder="Where it came from, charges left…" onChange={(e) => onChange({ note: e.target.value })} />
            </label>
          )}
          {rule?.description && <div className="option__desc" dangerouslySetInnerHTML={{ __html: rule.description }} />}
        </div>
      </details>
    </li>
  );
}

/** Search the rules' gear to add or buy, or add something made up. */
function AddItem({ view, coins, full, onAdd }) {
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState({ name: '', qty: '1', bulk: '0' });
  const all = useMemo(
    () => GEAR_TYPES.flatMap((type) => (view[type] ?? []).map((item) => ({ type, item }))).sort((a, b) => a.item.name.localeCompare(b.item.name)),
    [view],
  );
  const q = query.trim().toLowerCase();
  const matches = q ? all.filter(({ item }) => item.name.toLowerCase().includes(q)).slice(0, MATCHES_SHOWN) : [];
  const money = coinValue(coins);
  const customOk = custom.name.trim() && Number(custom.qty) >= 1;

  return (
    <section className="panel add-item" aria-labelledby="add-item-title">
      <h2 id="add-item-title" className="panel__title">Add to inventory</h2>
      {full && <p className="rule-note rule-note--warn">The inventory is full ({LIMITS.items} entries). Remove something first.</p>}
      <label className="add-item__search">
        <span className="visually-hidden">Search gear</span>
        <input type="search" placeholder="Search gear: rope, healing potion, longsword…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {q && !matches.length && <p className="muted italic">No gear matches “{query}”. Add it as a custom item below.</p>}
      {matches.length > 0 && (
        <ul className="add-item__results">
          {matches.map(({ type, item }) => (
            <li key={`${type}-${item.id}`} className="add-item__result">
              <span className="add-item__info">
                <strong>{item.name}</strong>
                <span className="muted">
                  {formatPrice(item.price ?? 0)} · Bulk {bulkLabel(item.bulk ?? 0)}
                  {item.level > 0 && ` · Level ${item.level}`}
                </span>
              </span>
              <span className="btn-row">
                <button type="button" className="btn" disabled={full} onClick={() => onAdd(inventoryItem(KIND_OF[type], item))}>Add</button>
                <button
                  type="button"
                  className="btn btn--blood"
                  disabled={full || !item.price || item.price > money}
                  title={item.price > money ? "Not enough coins" : `Pay ${formatPrice(item.price ?? 0)}`}
                  onClick={() => onAdd(inventoryItem(KIND_OF[type], item), payCoins(coins, item.price))}
                >
                  Buy
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form
        className="add-item__custom"
        onSubmit={(e) => {
          e.preventDefault();
          if (!customOk || full) return;
          onAdd(customItem(custom.name, Math.min(LIMITS.qty, Math.floor(Number(custom.qty))), Number(custom.bulk)));
          setCustom({ name: '', qty: '1', bulk: '0' });
        }}
      >
        <span className="eyebrow">Or a custom item</span>
        <div className="add-item__custom-row">
          <label className="add-item__custom-name">
            <span className="visually-hidden">Name</span>
            <input type="text" maxLength={LIMITS.name} placeholder="Grandmother's locket" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
          </label>
          <label>
            <span className="visually-hidden">Quantity</span>
            <input type="number" min="1" max={LIMITS.qty} value={custom.qty} onChange={(e) => setCustom({ ...custom, qty: e.target.value })} aria-label="Quantity" />
          </label>
          <label>
            <span className="visually-hidden">Bulk</span>
            <select value={custom.bulk} onChange={(e) => setCustom({ ...custom, bulk: e.target.value })} aria-label="Bulk">
              <option value="0">No Bulk</option>
              <option value="0.1">Bulk L</option>
              {[1, 2, 3, 4, 5].map((b) => <option key={b} value={b}>Bulk {b}</option>)}
            </select>
          </label>
          <button type="submit" className="btn" disabled={!customOk || full}>Add</button>
        </div>
      </form>
    </section>
  );
}
