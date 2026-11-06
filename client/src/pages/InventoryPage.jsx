import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  COINS,
  COIN_NAMES,
  LIMITS,
  bulkLimits,
  bulkTotal,
  coinValue,
  customItem,
  formatBulk,
  formatPrice,
  inventoryItem,
  payCoins,
  gradeText,
  startingInventory,
  toggleEquipped,
  withEquipped,
  EQUIPPABLE,
  toWeapon,
  weaponRank,
} from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import { useRules } from '../state/useRules.js';
import Icon from '../components/Icon.jsx';
import Portrait from '../components/Portrait.jsx';
import RollDrawer from '../components/RollDrawer.jsx';
import { boxDice } from '../components/Dice.jsx';
import { ARMORY_CATEGORIES, categoryIcon, loadArmory, loadItemDetails } from '../state/armory.js';
import { armoryWares, bulkOf } from '../builder/armoryGear.js';

const GEAR_TYPES = ['weapons', 'armor', 'shields', 'items'];
const LIST_OF = { weapon: 'weapons', armor: 'armor', shield: 'shields', item: 'items' };
const ARMORY_KIND = { Weapons: 'weapon', Armor: 'armor', Shields: 'shield' };

const bulkLabel = (bulk) => (bulk >= 1 ? String(bulk) : bulk > 0 ? 'L' : '—');
const savedLabel = { waiting: 'Saving…', saving: 'Saving…', saved: 'Saved', error: "Couldn't save. Check your connection; your next change will try again." };

/**
 * What the character carries, as a purse and load, the gear they have equipped (what the
 * Sheet's AC and Strikes use), and their pack. New gear comes from the merchant, a book
 * of armor, shields, weapons and adventuring gear; buying pays from the purse.
 */
export default function InventoryPage() {
  const { character, baseCharacter, readOnly, inventory, setInventory, inventoryStatus, portraitUrl, rollDamage, rollHealing } = useTable();
  const rules = useRules(GEAR_TYPES);
  // The pack grid's column count (it changes with the screen), so the empty sockets always finish its last row.
  const [cols, setCols] = useState(5);
  const gridRef = useCallback((grid) => {
    if (!grid) return undefined;
    const measure = () => setCols(getComputedStyle(grid).gridTemplateColumns.split(' ').length || 1);
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);
  // Until the first edit, the builder's gear and leftover gold; saved on the first change.
  const starting = useMemo(() => (rules && !rules.error ? startingInventory(baseCharacter, rules) : null), [baseCharacter, rules]);
  // Every equipped flag spelled out, including for inventories saved before equipping.
  const inv = useMemo(() => (inventory ?? starting) && withEquipped(inventory ?? starting), [inventory, starting]);
  // The merchant is a sub tab, in the URL (?tab=merchant) so it can be linked and Back leaves it.
  const [params] = useSearchParams();
  const shopping = !readOnly && params.get('tab') === 'merchant';
  const [selectedKey, setSelectedKey] = useState(null);
  // Dice in an item's rules text roll in the roll drawer; dice of Hit Points (a potion) roll as healing.
  const [rolling, setRolling] = useState(false);
  const rollDice = (label, expr, type, heal) => (heal ? rollHealing(label, expr, false) : rollDamage(label, expr, type)) && setRolling(true);
  // The armory: the merchant's wares, and each carried item's icon and rules text by its name.
  const [armory, setArmory] = useState(null);
  useEffect(() => {
    let live = true;
    loadArmory().then((a) => live && setArmory(a), () => live && setArmory([]));
    return () => { live = false; };
  }, []);
  const armoryByName = useMemo(() => {
    const m = new Map();
    for (const a of armory ?? []) for (const n of [a.name, ...(a.variants ?? []).map((v) => v.name)]) m.set(n.toLowerCase(), a);
    return m;
  }, [armory]);

  if (!inv) {
    return <p className="muted italic center">{rules?.error ? "Couldn't load the item list. Try refreshing." : 'Unpacking…'}</p>;
  }

  const update = (changes) => setInventory({ ...inv, ...changes });
  const setItem = (key, changes) => update({ items: inv.items.map((i) => (i.key === key ? { ...i, ...changes } : i)) });
  const ruleOf = (item) => rules?.[LIST_OF[item.kind]]?.find((x) => x.id === item.id);
  const iconFor = (item) => iconOf(item, ruleOf(item), armoryByName.get(item.name.toLowerCase()));
  const equip = (key) => setInventory(toggleEquipped(inv, key));
  const total = bulkTotal(inv.items);
  const limits = bulkLimits(character);
  const load = total.bulk + total.light / 10;

  const equipped = inv.items.filter((i) => i.equipped);
  const pack = inv.items.filter((i) => !i.equipped);
  // The pack in order: weapons and armor, consumables, treasure, gear; then empty sockets to fill out the bag.
  const ORDER = ['itemWeapons', 'itemArmor', 'itemShields', 'itemConsumables', 'itemAlchemicalItems'];
  const rank = (i) => (ORDER.includes(iconFor(i)) ? ORDER.indexOf(iconFor(i)) : ORDER.length);
  const bag = [...pack].sort((x, y) => rank(x) - rank(y) || iconFor(x).localeCompare(iconFor(y)));
  // About 20 tiles (9 on a phone's three columns), rounded up to whole rows.
  const sockets = Math.ceil(Math.max(cols <= 3 ? 9 : 20, bag.length) / cols) * cols - bag.length;

  const selected = inv.items.find((i) => i.key === selectedKey) ?? null;
  const select = (key) => setSelectedKey((k) => (k === key ? null : key));
  const slots = [
    ['Armor', equipped.filter((i) => i.kind === 'armor'), 'itemArmor', 'Unarmored'],
    ['Shield', equipped.filter((i) => i.kind === 'shield'), 'itemShields', 'No shield'],
    ['Weapons', equipped.filter((i) => i.kind === 'weapon'), 'itemWeapons', 'Fists only'],
  ];

  return (
    <div className="sheet inventory-tab">
      {!readOnly && (
        <nav className="nav subnav" aria-label="Inventory">
          {[['Pack', 'inventory', ''], ['Merchant', 'coins', '?tab=merchant']].map(([label, icon, search]) => (
            <Link key={label} to={{ search }} className={shopping === Boolean(search) ? 'active' : undefined} aria-current={shopping === Boolean(search) ? 'page' : undefined}>
              <Icon name={icon} size={20} />
              {label.toUpperCase()}
            </Link>
          ))}
        </nav>
      )}
      {!shopping ? (
      <section className="inv" aria-label={`${character.name}'s inventory`}>
        <div className="inv__doll" aria-labelledby="equipped-title">
          <div className="inv__hero">
            <Portrait url={portraitUrl} name={character.name} size="lg" />
            <h1 id="equipped-title" className="inv__hero-name">{character.name}</h1>
            <p className="inv__hero-note">AC and Strikes use what's equipped.</p>
          </div>
          {slots.map(([label, items, icon, empty]) => (
            <div key={label} className="inv__slot-group">
              <span className="inv__label">{label}</span>
              <ul className="inv__slots">
                {(items.length ? items : [null]).map((i) => (
                  <li key={i?.key ?? 'empty'}>
                    {i ? (
                      <ItemTile item={i} icon={icon} sub={slotStat(i, ruleOf(i))} selected={selected?.key === i.key} onSelect={() => select(i.key)} wide />
                    ) : (
                      <span className="inv-tile inv-tile--wide inv-tile--empty">
                        <span className="inv-tile__icon"><Icon name={icon} size={30} /></span>
                        <span className="inv-tile__text"><span className="inv-tile__name">{empty}</span></span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="inv__bag" aria-labelledby="pack-title">
          <h2 id="pack-title" className="inv__title">Pack</h2>
          <ul className="inv__grid" ref={gridRef}>
            {bag.map((item) => (
              <li key={item.key}>
                <ItemTile item={item} icon={iconFor(item)} selected={selected?.key === item.key} onSelect={() => select(item.key)} />
              </li>
            ))}
            {Array.from({ length: sockets }, (_, n) => <li key={`socket-${n}`} className="inv-tile inv-tile--socket" aria-hidden="true" />)}
          </ul>
          {!bag.length && <p className="inv__empty">{readOnly ? 'Nothing else in the pack.' : <>Nothing else in the pack. <Link to={{ search: '?tab=merchant' }}>Visit the merchant</Link> to add gear.</>}</p>}
        </div>

        <div className="inv__card" aria-live="polite">
          {selected ? (
            <ItemCard
              key={selected.key}
              item={selected}
              rule={ruleOf(selected)}
              icon={iconFor(selected)}
              armory={selected.kind === 'custom' ? armoryByName.get(selected.name.toLowerCase()) : null}
              character={baseCharacter}
              readOnly={readOnly}
              onChange={(changes) => setItem(selected.key, changes)}
              onEquip={() => equip(selected.key)}
              onRollDice={rollDice}
              onRemove={() => {
                update({ items: inv.items.filter((i) => i.key !== selected.key) });
                setSelectedKey(null);
              }}
            />
          ) : (
            <div className="inv__card-blank">
              <Icon name="inventory" size={44} />
              <p>Choose an item to read it{readOnly ? '' : ', equip it or change how many you carry'}.</p>
            </div>
          )}
        </div>

        <div className="inv__purse purse-load" aria-labelledby="purse-title">
          <div className="purse-load__head">
            <h2 id="purse-title" className="inv__label">Purse</h2>
            <span className="muted">Worth {formatPrice(coinValue(inv.coins))}</span>
          </div>
          <div className="coins__row">
            {COINS.map((c) => (
              <label key={c} className={`coin coin--${c}`}>
                <span className="coin__abbr"><Icon name="coins" size={16} />{c}<span className="visually-hidden"> ({COIN_NAMES[c]})</span></span>
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
              </label>
            ))}
          </div>
        </div>
        <div className="inv__load">
          <LoadMeter load={load} limits={limits} label={formatBulk(total)} name={character.name} />
        </div>
      </section>
      ) : (
        <section className="merchant" aria-label="The merchant">
          <Merchant
            armory={armory}
            rules={rules && !rules.error ? rules : null}
            coins={inv.coins}
            full={inv.items.length >= LIMITS.items}
            onAdd={(entry, coins) => {
              // The same thing again stacks onto what's in the pack.
              const same = inv.items.find((i) => !i.equipped && i.kind === entry.kind && i.name === entry.name && i.id === entry.id && i.qty < LIMITS.qty);
              const items = same ? inv.items.map((i) => (i === same ? { ...i, qty: i.qty + 1 } : i)) : [...inv.items, entry];
              update({ items, ...(coins && { coins }) });
            }}
          />
        </section>
      )}

      <RollDrawer open={rolling} onClose={() => setRolling(false)} />

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
  if (item.kind === 'shield') return `+${rule.acBonus} AC raised · Hardness ${rule.hardness} · HP ${Math.max(0, rule.hp - (item.damage ?? 0))}/${rule.hp}`;
  if (item.kind === 'weapon') return `1d${rule.die} ${rule.damageType}${rule.range ? ` · ${rule.range} ft` : ''}`;
  return null;
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

/** An item's icon: its kind, or for anything else its armory category (by name), or what it looks like it's for. */
function iconOf(item, rule, armory) {
  if (item.kind !== 'item' && item.kind !== 'custom') return { weapon: 'itemWeapons', armor: 'itemArmor', shield: 'itemShields' }[item.kind];
  if (armory) return categoryIcon(armory.category);
  if (rule?.category === 'consumable' || /potion|elixir|oil|scroll|bomb|talisman/i.test(item.name)) return 'itemConsumables';
  if (rule?.category === 'treasure') return 'coins';
  return 'itemAdventuringGear';
}

/** An armory item's rules text (HTML), once it loads: null until then. */
function useItemText(armory) {
  const [html, setHtml] = useState(null);
  useEffect(() => {
    setHtml(null);
    if (!armory) return undefined;
    let live = true;
    loadItemDetails(armory).then((h) => live && setHtml(h), () => live && setHtml(''));
    return () => { live = false; };
  }, [armory]);
  return html;
}

/** An item's rules text, with each dice expression a box that rolls it; healing when the dice are Hit Points. */
function RulesText({ html, name, className, onRollDice }) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: boxDice(html) }}
      onClick={(e) => {
        const b = e.target.closest('[data-dice]');
        if (b) onRollDice(name, b.dataset.dice, b.dataset.type, /^\s*(?:Hit Points|HP)\b/i.test(b.nextSibling?.textContent ?? ''));
      }}
    />
  );
}

/** One item as a tile: its icon, with how many; equipped slots are wide, with the name and what it does. */
function ItemTile({ item, icon, sub, selected, onSelect, wide }) {
  return (
    <button
      type="button"
      className={`inv-tile ${wide ? 'inv-tile--wide' : ''} ${selected ? 'inv-tile--on' : ''}`}
      aria-pressed={selected}
      aria-label={`${item.name}${item.qty > 1 ? `, ${item.qty}` : ''}`}
      title={wide ? undefined : item.name}
      onClick={onSelect}
    >
      <span className="inv-tile__icon"><Icon name={icon} size={wide ? 30 : 34} /></span>
      {item.qty > 1 && <span className="inv-tile__qty">{item.qty}</span>}
      {wide ? (
        <span className="inv-tile__text">
          <span className="inv-tile__name">{item.name}</span>
          {sub && <span className="inv-tile__sub">{sub}</span>}
        </span>
      ) : (
        <span className="inv-tile__label">{item.name}</span>
      )}
    </button>
  );
}

/** The item you're looking at, large: what it is, how many, equip, a note, its rules text, remove. */
function ItemCard({ item, rule, icon, armory, character, readOnly, onChange, onEquip, onRemove, onRollDice }) {
  const equippable = EQUIPPABLE.includes(item.kind);
  const untrained = equippable && untrainedNote(item, rule, character);
  const stat = slotStat(item, rule);
  const all = useItemText(armory);
  const text = all && gradeText(all, item.name);
  return (
    <article className="inv-card">
      <header className="inv-card__head">
        <span className="inv-card__icon"><Icon name={icon} size={40} /></span>
        <div>
          <h3 className="inv-card__name">{item.name}</h3>
          <p className="inv-card__state">{item.equipped ? (item.kind === 'armor' ? 'Worn' : 'Equipped') : 'In the pack'}{untrained && <span className="tag tag--warn">Untrained</span>}</p>
        </div>
      </header>
      <ul className="co__facts">
        {stat && <li>{stat}</li>}
        <li>Bulk {bulkLabel(item.bulk)} each</li>
        {item.price != null && <li>{formatPrice(item.price)} each</li>}
        {rule?.level > 0 && <li>Level {rule.level}</li>}
      </ul>
      {untrained && <p className="rule-note rule-note--warn" style={{ margin: 0 }}>{untrained}</p>}
      {!readOnly && (
        <div className="inv-card__actions">
          <span className="pack-row__qty stepper" role="group" aria-label={`Quantity of ${item.name}`}>
            <button type="button" aria-label="One fewer" disabled={item.qty <= 1} onClick={() => onChange({ qty: item.qty - 1 })}>−</button>
            <span className="stepper__value">{item.qty}</span>
            <button type="button" aria-label="One more" disabled={item.qty >= LIMITS.qty} onClick={() => onChange({ qty: item.qty + 1 })}>+</button>
          </span>
          {equippable && (
            <button type="button" className={`btn ${item.equipped ? '' : 'btn--blood'}`} onClick={onEquip}>
              {item.equipped ? (item.kind === 'armor' ? 'Take off' : 'Unequip') : item.kind === 'armor' ? 'Wear' : 'Equip'}
            </button>
          )}
        </div>
      )}
      {readOnly && item.qty > 1 && <p className="inv-card__state">You carry {item.qty}.</p>}
      {text && <RulesText className="item-text inv-card__desc" html={text} name={item.name} onRollDice={onRollDice} />}
      {rule?.description && <RulesText className="option__desc book__desc inv-card__desc" html={rule.description} name={item.name} onRollDice={onRollDice} />}
      {readOnly ? (
        item.note && <p className="inventory__note">{item.note}</p>
      ) : (
        <label className="inventory__note-field">
          <span className="inv__label">Note</span>
          <input type="text" maxLength={LIMITS.note} value={item.note} placeholder="Where it came from, charges left…" onChange={(e) => onChange({ note: e.target.value })} />
        </label>
      )}
      {!readOnly && (
        <button type="button" className="link-button inv-card__remove" onClick={onRemove}>Remove from inventory</button>
      )}
    </article>
  );
}

const ALL_WARES = 'All wares';
// shortcut: the list shows the first 200 matches, so a big category asks for a search; virtualize if that annoys.
const SHOWN = 200;
const rarityNote = {
  uncommon: 'Uncommon: ask your GM before buying it, since it needs access.',
  rare: 'Rare: only with your GM’s say-so, usually as treasure or a reward.',
  unique: 'Unique: there’s only one. Your GM decides whether it’s yours.',
};

/**
 * The merchant: the whole armory as a shop. Categories down the left with your purse, the
 * wares in the middle, the one you're looking at on the right to buy (paid from the purse)
 * or add for free (loot, gifts). Weapons, armor and shields the sheet knows can be equipped.
 * Custom items are added below.
 */
function Merchant({ armory, rules, coins, full, onAdd }) {
  const wares = useMemo(() => (armory ? armoryWares(armory) : null), [armory]);
  const [tab, setTab] = useState(ALL_WARES);
  const [query, setQuery] = useState('');
  const [lookId, setLookId] = useState(null);
  const [said, setSaid] = useState(null);
  const [custom, setCustom] = useState({ name: '', qty: '1', bulk: '0' });
  const counts = useMemo(() => {
    const c = new Map();
    for (const w of wares ?? []) c.set(w.armory.category, (c.get(w.armory.category) ?? 0) + 1);
    return c;
  }, [wares]);
  if (!wares) return <p className="muted italic center">The merchant is unpacking…</p>;

  const q = query.trim().toLowerCase();
  const list = wares.filter((w) => (tab === ALL_WARES || w.armory.category === tab) && (!q || w.name.toLowerCase().includes(q)));
  const shown = list.slice(0, SHOWN);
  const look = list.find((w) => w.id === lookId) ?? shown[0] ?? null;
  const money = coinValue(coins);
  const customOk = custom.name.trim() && Number(custom.qty) >= 1;
  const tabs = [[ALL_WARES, wares.length], ...ARMORY_CATEGORIES.filter((c) => counts.has(c.name)).map((c) => [c.name, counts.get(c.name)])];

  // A weapon, armor or shield the sheet has numbers for goes in as that, so it can be equipped.
  const ruleFor = (w) => {
    const kind = ARMORY_KIND[w.armory.category];
    const rule = kind && rules?.[LIST_OF[kind]]?.find((r) => r.name.toLowerCase() === w.name.toLowerCase());
    return rule ? { kind, rule } : null;
  };
  const add = (w, pay) => {
    const m = ruleFor(w);
    const entry = m ? inventoryItem(m.kind, m.rule) : { ...customItem(w.name, 1, bulkOf(w.armory.bulk)), price: w.price };
    onAdd(entry, pay ? payCoins(coins, w.price) : null);
    setSaid({ id: w.id, text: `${w.name} ${pay ? 'bought' : 'added'}.` });
  };

  return (
    <div className="merchant__body">
      {full && <p className="rule-note rule-note--warn">The inventory is full ({LIMITS.items} entries). Remove something first.</p>}
      <div className="co shop">
        <div className="co__rail">
          <div className="co__class">
            <span className="shop__sigil"><Icon name="coins" size={30} /></span>
            <div>
              <h1 className="co__class-name">The Merchant</h1>
              <p className="co__class-count">You have {formatPrice(money)}</p>
            </div>
          </div>
          <div className="co__tabs" role="tablist" aria-label="What the merchant sells">
            {tabs.map(([name, n]) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                className="co__tab shop__tab"
                onClick={() => { setTab(name); setLookId(null); }}
              >
                <span className="shop__tab-icon"><Icon name={name === ALL_WARES ? 'armory' : categoryIcon(name)} size={18} /></span>
                <span className="co__tab-title">{name}</span>
                <span className="shop__tab-count">{n}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="co__body" role="tabpanel" aria-label={tab}>
          <div className="co__list-wrap">
            <input
              className="options__search co__search"
              type="search"
              aria-label="Search the wares"
              placeholder="Rope, healing potion, longsword…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setLookId(null); }}
            />
            <p className="co__intro" aria-live="polite">
              {list.length > SHOWN ? `First ${SHOWN} of ${list.length.toLocaleString('en-US')}. Search to narrow it down.` : `${list.length.toLocaleString('en-US')} ${list.length === 1 ? 'ware' : 'wares'}`}
            </p>
            <ul className="co__list">
              {shown.map((w) => (
                <li key={w.id}>
                  <button type="button" className={`co-option shop-ware ${look?.id === w.id ? 'co-option--looking' : ''}`} aria-pressed={look?.id === w.id} onClick={() => setLookId(w.id)}>
                    <span className={`shop-ware__icon shop-ware__icon--${w.armory.rarity}`}><Icon name={categoryIcon(w.armory.category)} size={18} /></span>
                    <span className="co-option__name shop-ware__name">{w.name}</span>
                    <span className={`shop-ware__price ${w.price > money ? 'shop-ware__price--dear' : ''}`}>{w.price != null ? formatPrice(w.price) : '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
            {!list.length && <p className="co__intro">Nothing matches “{query}”. Add it as a custom item below.</p>}
          </div>
          <div className="co__detail">
            {look ? (
              <Ware key={look.id} w={look} equippable={Boolean(ruleFor(look))} money={money} full={full} said={said?.id === look.id ? said.text : null} onBuy={() => add(look, true)} onAdd={() => add(look, false)} />
            ) : (
              <div className="inv__card-blank"><Icon name="armory" size={44} /><p>Choose something to look at it.</p></div>
            )}
          </div>
        </div>
      </div>
      <p className="visually-hidden" role="status">{said?.text}</p>

      <form
        className="sheet-panel add-item__custom"
        onSubmit={(e) => {
          e.preventDefault();
          if (!customOk || full) return;
          onAdd(customItem(custom.name, Math.min(LIMITS.qty, Math.floor(Number(custom.qty))), Number(custom.bulk)));
          setSaid({ id: null, text: `${custom.name.trim()} added.` });
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

/** The ware you're looking at: what it is, its rules text, and buy or add for free. */
function Ware({ w, equippable, money, full, said, onBuy, onAdd }) {
  const a = w.armory;
  const html = useItemText(a);
  const facts = [a.category, `Level ${w.level}`, `Bulk ${a.bulk || '—'}`, a.usage && `Usage: ${a.usage}`, a.hands && `Hands ${a.hands}`].filter(Boolean);
  return (
    <div className="co__detail-inner">
      <header className="inv-card__head">
        <span className="inv-card__icon"><Icon name={categoryIcon(a.category)} size={40} /></span>
        <div>
          <h3 className="co__detail-name shop__name">{w.name}</h3>
          <p className="inv-card__state">
            <span className="shop__price">{w.price != null ? formatPrice(w.price) : 'No price'}</span>
            {a.rarity !== 'common' && <span className={`tag tag--rarity-${a.rarity}`}>{a.rarity}</span>}
          </p>
        </div>
      </header>
      <ul className="co__facts">{facts.map((f) => <li key={f}>{f}</li>)}</ul>
      {a.traits?.length > 0 && <p className="co__source">{a.traits.join(' · ')}</p>}
      <div className="co__actions">
        <button type="button" className="btn btn--blood" disabled={full || w.price == null || w.price > money} onClick={onBuy}>
          {w.price != null ? `Buy for ${formatPrice(w.price)}` : 'Not for sale'}
        </button>
        <button type="button" className="btn" disabled={full} onClick={onAdd}>Add for free</button>
        {said && <span className="co__chosen" aria-hidden="true">{said}</span>}
      </div>
      {w.price > money && <p className="rule-note" style={{ margin: 0 }}>You have {formatPrice(money)}.</p>}
      {rarityNote[a.rarity] && <p className="rule-note" style={{ margin: 0 }}>{rarityNote[a.rarity]}</p>}
      {ARMORY_KIND[a.category] && !equippable && (
        <p className="rule-note" style={{ margin: 0 }}>This goes in the pack as gear: it can't be equipped, so it won't change your AC or Strikes.</p>
      )}
      <div className="item-text co__desc">
        {html == null ? <p className="muted italic">Reading the rules…</p> : html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <p className="muted italic">No rules text beyond its price and Bulk.</p>}
      </div>
      <p className="co__source">{a.book}{a.page ? `, page ${a.page}` : ''}</p>
    </div>
  );
}
