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
import BookSpread from '../components/BookSpread.jsx';
import BookLeaf from '../builder/BookLeaf.jsx';
import { gearFacts } from '../builder/gearFacts.js';
import { sourceTag } from '../builder/labels.js';

const GEAR_TYPES = ['weapons', 'armor', 'shields', 'items'];
const KIND_OF = { weapons: 'weapon', armor: 'armor', shields: 'shield', items: 'item' };
const LIST_OF = { weapon: 'weapons', armor: 'armor', shield: 'shields', item: 'items' };
const MERCHANT_SECTIONS = [
  { key: 'armor', tab: 'Armor', name: 'Armor' },
  { key: 'shields', tab: 'Shields', name: 'Shields' },
  { key: 'weapons', tab: 'Weapons', name: 'Weapons' },
  { key: 'items', tab: 'Gear', name: 'Adventuring gear' },
];

const bulkLabel = (bulk) => (bulk >= 1 ? String(bulk) : bulk > 0 ? 'L' : '—');
const savedLabel = { waiting: 'Saving…', saving: 'Saving…', saved: 'Saved', error: "Couldn't save. Check your connection; your next change will try again." };

/**
 * What the character carries, as a purse and load, the gear they have equipped (what the
 * Sheet's AC and Strikes use), and their pack. New gear comes from the merchant, a book
 * of armor, shields, weapons and adventuring gear; buying pays from the purse.
 */
export default function InventoryPage() {
  const { character, baseCharacter, readOnly, campaign, inventory, setInventory, inventoryStatus } = useTable();
  const rules = useRules(GEAR_TYPES);
  // The campaign's books limit what can be added from the rules; custom items are always allowed.
  const view = useMemo(() => (rules && !rules.error ? campaignData(rules, campaign?.books ?? null) : null), [rules, campaign]);
  // Until the first edit, the builder's gear and leftover gold; saved on the first change.
  const starting = useMemo(() => (rules && !rules.error ? startingInventory(baseCharacter, rules) : null), [baseCharacter, rules]);
  // Every equipped flag spelled out, including for inventories saved before equipping.
  const inv = useMemo(() => (inventory ?? starting) && withEquipped(inventory ?? starting), [inventory, starting]);
  const [shopping, setShopping] = useState(false);

  if (!inv) {
    return <p className="muted italic center">{rules?.error ? "Couldn't load the item list. Try refreshing." : 'Unpacking…'}</p>;
  }

  const update = (changes) => setInventory({ ...inv, ...changes });
  const setItem = (key, changes) => update({ items: inv.items.map((i) => (i.key === key ? { ...i, ...changes } : i)) });
  const ruleOf = (item) => rules?.[LIST_OF[item.kind]]?.find((x) => x.id === item.id);
  const equip = (key) => setInventory(toggleEquipped(inv, key));
  const total = bulkTotal(inv.items);
  const limits = bulkLimits(character);
  const load = total.bulk + total.light / 10;

  const equipped = inv.items.filter((i) => i.equipped);
  const pack = inv.items.filter((i) => !i.equipped);
  const groups = [
    ['Weapons and armor', pack.filter((i) => EQUIPPABLE.includes(i.kind))],
    ['Consumables', pack.filter((i) => i.kind === 'item' && ruleOf(i)?.category === 'consumable')],
    ['Treasure', pack.filter((i) => i.kind === 'item' && ruleOf(i)?.category === 'treasure')],
    ['Gear', pack.filter((i) => i.kind === 'custom' || (i.kind === 'item' && !['consumable', 'treasure'].includes(ruleOf(i)?.category)))],
  ].filter(([, list]) => list.length);

  return (
    <div className="sheet inventory-tab">
      <section className="sheet-panel purse-load" aria-labelledby="purse-title">
        <div className="purse-load__head">
          <h1 id="purse-title" className="sheet-panel__title">Purse and load</h1>
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
        <LoadMeter load={load} limits={limits} label={formatBulk(total)} name={character.name} />
      </section>

      <section className="sheet-panel" aria-labelledby="equipped-title">
        <h2 id="equipped-title" className="sheet-panel__title">Equipped</h2>
        <p className="rule-note" style={{ margin: '0 0 10px' }}>Your Sheet's AC and Strikes use what's equipped here.</p>
        <ul className="slot-cards">
          <SlotCard
            label="Armor"
            items={equipped.filter((i) => i.kind === 'armor')}
            empty="Unarmored"
            ruleOf={ruleOf}
            readOnly={readOnly}
            onUnequip={equip}
          />
          <SlotCard label="Shield" items={equipped.filter((i) => i.kind === 'shield')} empty="No shield" ruleOf={ruleOf} readOnly={readOnly} onUnequip={equip} />
          <SlotCard label="Weapons" items={equipped.filter((i) => i.kind === 'weapon')} empty="Fists only" ruleOf={ruleOf} readOnly={readOnly} onUnequip={equip} />
        </ul>
      </section>

      <section className="sheet-panel" aria-labelledby="pack-title">
        <h2 id="pack-title" className="sheet-panel__title">Pack</h2>
        {groups.length ? (
          groups.map(([label, list]) => (
            <div key={label} className="pack-group">
              <span className="sheet-panel__label">{label}</span>
              <ul className="pack-rows">
                {list.map((item) => (
                  <PackRow
                    key={item.key}
                    item={item}
                    rule={ruleOf(item)}
                    character={baseCharacter}
                    readOnly={readOnly}
                    onChange={(changes) => setItem(item.key, changes)}
                    onEquip={() => equip(item.key)}
                    onRemove={() => update({ items: inv.items.filter((i) => i.key !== item.key) })}
                  />
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="muted italic" style={{ margin: 0 }}>{readOnly ? 'Nothing else in the pack.' : 'Nothing else in the pack. Visit the merchant to add gear.'}</p>
        )}
      </section>

      {!readOnly && view && (
        <section className="merchant" aria-labelledby="merchant-title">
          <div className="merchant__head">
            <h2 id="merchant-title" className="sheet-panel__title">The merchant</h2>
            <button type="button" className={`btn ${shopping ? '' : 'btn--blood'}`} aria-expanded={shopping} onClick={() => setShopping((v) => !v)}>
              {shopping ? 'Close the shop' : 'Visit the merchant'}
            </button>
          </div>
          {shopping && (
            <Merchant
              view={view}
              coins={inv.coins}
              full={inv.items.length >= LIMITS.items}
              onAdd={(entry, coins) => update({ items: [...inv.items, entry], ...(coins && { coins }) })}
            />
          )}
        </section>
      )}

      {!readOnly && inventoryStatus !== 'idle' && (
        <p className={`rule-note center ${inventoryStatus === 'error' ? 'rule-note--warn' : ''}`} role="status">{savedLabel[inventoryStatus]}</p>
      )}
    </div>
  );
}

/** Bulk carried, as a bar with marks where the character becomes encumbered and where they can carry no more. */
function LoadMeter({ load, limits, label, name }) {
  const scale = Math.max(limits.max, load) * 1.1;
  const state = load > limits.max ? 'over' : load > limits.encumbered ? 'heavy' : 'ok';
  return (
    <div className="load">
      <div className="load__head">
        <span className="sheet-panel__label">Bulk</span>
        <span>
          <strong>{label}</strong> <span className="muted">of {limits.max}</span>
        </span>
      </div>
      <div
        className={`load__bar load__bar--${state}`}
        role="meter"
        aria-label="Bulk carried"
        aria-valuemin={0}
        aria-valuemax={limits.max}
        aria-valuenow={Math.min(load, limits.max)}
        aria-valuetext={`${label} Bulk; encumbered above ${limits.encumbered}, most ${limits.max}`}
      >
        <span className="load__fill" style={{ width: `${Math.min(100, (load / scale) * 100)}%` }} />
        <span className="load__mark" style={{ left: `${(limits.encumbered / scale) * 100}%` }} title={`Encumbered above ${limits.encumbered}`} />
        <span className="load__mark load__mark--max" style={{ left: `${(limits.max / scale) * 100}%` }} title={`Most you can carry: ${limits.max}`} />
      </div>
      <p className={`rule-note ${state === 'ok' ? '' : 'rule-note--warn'}`} style={{ margin: 0 }}>
        {state === 'over'
          ? `That's more than ${name} can carry.`
          : state === 'heavy'
            ? 'Encumbered: clumsy 1 and −10 feet to Speeds.'
            : `Encumbered above ${limits.encumbered} Bulk; the most ${name} can carry is ${limits.max}.`}
      </p>
    </div>
  );
}

/** What an equipped item does on the sheet, in a few words. */
function slotStat(item, rule) {
  if (!rule) return null;
  if (item.kind === 'armor') return `AC +${rule.acBonus}${rule.dexCap != null ? ` · Dex cap +${rule.dexCap}` : ''}`;
  if (item.kind === 'shield') return `+${rule.acBonus} AC raised · Hardness ${rule.hardness}`;
  if (item.kind === 'weapon') return `1d${rule.die} ${rule.damageType}${rule.range ? ` · ${rule.range} ft` : ''}`;
  return null;
}

/** One equipment slot: what's in it (or that it's empty), with unequip. */
function SlotCard({ label, items, empty, ruleOf, readOnly, onUnequip }) {
  return (
    <li className={`slot-card ${items.length ? '' : 'slot-card--empty'}`}>
      <span className="sheet-panel__label">{label}</span>
      {items.length ? (
        items.map((i) => (
          <div key={i.key} className="slot-card__item">
            <span className="slot-card__name">{i.name}</span>
            {slotStat(i, ruleOf(i)) && <span className="slot-card__stat">{slotStat(i, ruleOf(i))}</span>}
            {!readOnly && (
              <button type="button" className="link-button" onClick={() => onUnequip(i.key)}>
                {i.kind === 'armor' ? 'Take off' : 'Unequip'}
              </button>
            )}
          </div>
        ))
      ) : (
        <span className="slot-card__empty">{empty}{!readOnly && ': equip something from your pack.'}</span>
      )}
    </li>
  );
}

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

/** One line in the pack: name, quantity, Bulk and value, equip where it applies; details open below. */
function PackRow({ item, rule, character, readOnly, onChange, onEquip, onRemove }) {
  const [open, setOpen] = useState(false);
  const equippable = EQUIPPABLE.includes(item.kind);
  const untrained = equippable && untrainedNote(item, rule, character);
  const detailsId = `pack-${item.key}`;
  return (
    <li className={`pack-row ${open ? 'pack-row--open' : ''}`}>
      <div className="pack-row__line">
        <button type="button" className="pack-row__name" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((v) => !v)}>
          <span className="pack-row__caret" aria-hidden="true" />
          {item.name}
          {untrained && <span className="tag tag--warn">Untrained</span>}
        </button>
        {readOnly ? (
          <span className="pack-row__qty">×{item.qty}</span>
        ) : (
          <span className="pack-row__qty stepper" role="group" aria-label={`Quantity of ${item.name}`}>
            <button type="button" aria-label="One fewer" disabled={item.qty <= 1} onClick={() => onChange({ qty: item.qty - 1 })}>−</button>
            <span className="stepper__value">{item.qty}</span>
            <button type="button" aria-label="One more" disabled={item.qty >= LIMITS.qty} onClick={() => onChange({ qty: item.qty + 1 })}>+</button>
          </span>
        )}
        <span className="pack-row__bulk" title="Bulk each">{bulkLabel(item.bulk)}</span>
        <span className="pack-row__value">{item.price != null ? formatPrice(item.price * item.qty) : '—'}</span>
        <span className="pack-row__action">
          {equippable && !readOnly && (
            <button type="button" className="pack-row__equip" onClick={onEquip}>{item.kind === 'armor' ? 'Wear' : 'Equip'}</button>
          )}
        </span>
      </div>
      {open && (
        <div id={detailsId} className="pack-row__details">
          {untrained && <p className="rule-note rule-note--warn" style={{ margin: 0 }}>{untrained}</p>}
          <p className="inventory__facts muted">
            {item.price != null && <span>Price {formatPrice(item.price)} each</span>}
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
          {rule?.description && <div className="option__desc book__desc" dangerouslySetInnerHTML={{ __html: rule.description }} />}
          {!readOnly && (
            <button type="button" className="btn inventory__remove" onClick={onRemove}>Remove from pack</button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * The merchant: armor, shields, weapons and adventuring gear as a book. Open an item to
 * read it, then buy it (paid from the purse) or add it for free (loot, gifts). Custom
 * items are added below.
 */
function Merchant({ view, coins, full, onAdd }) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [custom, setCustom] = useState({ name: '', qty: '1', bulk: '0' });
  const [added, setAdded] = useState(null);
  const q = query.trim().toLowerCase();
  const all = useMemo(
    () =>
      MERCHANT_SECTIONS.flatMap(({ key }) =>
        [...(view[key] ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map((item) => ({ id: `${key}:${item.id}`, name: item.name, type: key, item })),
      ),
    [view],
  );
  const items = q ? all.filter((i) => i.name.toLowerCase().includes(q)) : all;
  const open = all.find((i) => i.id === openId) ?? null;
  const money = coinValue(coins);
  const customOk = custom.name.trim() && Number(custom.qty) >= 1;
  const add = (i, pay) => {
    onAdd(inventoryItem(KIND_OF[i.type], i.item), pay ? payCoins(coins, i.item.price) : null);
    setAdded(`${i.name} ${pay ? 'bought' : 'added'}.`);
  };

  return (
    <div className="merchant__body">
      {full && <p className="rule-note rule-note--warn">The inventory is full ({LIMITS.items} entries). Remove something first.</p>}
      <label className="filters__field">
        <span className="filters__label">Search the shelves</span>
        <input className="options__search" type="search" placeholder="Rope, healing potion, longsword…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <p className="visually-hidden" role="status">{added}</p>
      <BookSpread
        items={items}
        total={all.length}
        noun="items"
        sections={MERCHANT_SECTIONS}
        sectionOf={(i) => i.type}
        tabsOnTop
        open={open}
        onOpen={(i) => setOpenId(i.id)}
        resetKey={q}
        filtered={Boolean(q)}
        meta={(i) => (
          <>
            {i.item.rarity && i.item.rarity !== 'common' && <span className={`tag tag--rarity-${i.item.rarity}`}>{i.item.rarity}</span>}
            <span>{i.item.price ? formatPrice(i.item.price) : '—'}</span>
          </>
        )}
        emptyText={`Nothing matches “${query}”. Add it as a custom item below.`}
        leaf={open && (
          <BookLeaf
            key={open.id}
            eyebrow={`${MERCHANT_SECTIONS.find((s) => s.key === open.type).name} · ${sourceTag(open.item.source)}${open.item.rarity && open.item.rarity !== 'common' ? ` · ${open.item.rarity}` : ''}`}
            title={open.item.name}
            facts={gearFacts(KIND_OF[open.type], open.item)}
            description={open.item.description}
            onClose={() => setOpenId(null)}
          >
            <button
              type="button"
              className="btn btn--blood"
              disabled={full || !open.item.price || open.item.price > money}
              onClick={() => add(open, true)}
            >
              {open.item.price ? `Buy for ${formatPrice(open.item.price)}` : 'Not for sale'}
            </button>
            <button type="button" className="btn" disabled={full} onClick={() => add(open, false)}>Add for free</button>
            {open.item.price > money && <span className="rule-note">You have {formatPrice(money)}.</span>}
            {added && <span className="rule-note" aria-hidden="true">{added}</span>}
          </BookLeaf>
        )}
        blank={
          <>
            <p className="book__blank-title">The merchant's shelves</p>
            <p className="rule-note">Open an item to read it, then buy it from your purse or add it for free, for loot and gifts.</p>
          </>
        }
      />

      <form
        className="sheet-panel add-item__custom"
        onSubmit={(e) => {
          e.preventDefault();
          if (!customOk || full) return;
          onAdd(customItem(custom.name, Math.min(LIMITS.qty, Math.floor(Number(custom.qty))), Number(custom.bulk)));
          setAdded(`${custom.name.trim()} added.`);
          setCustom({ name: '', qty: '1', bulk: '0' });
        }}
      >
        <span className="sheet-panel__label">Or a custom item</span>
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
    </div>
  );
}
