import { useCallback, useEffect, useState } from 'react';
import { useCarriedConsumables } from '../state/carriedItems.js';
import { Link } from 'react-router-dom';
import {
  armorClass, classDc, damageModifier, describeCondition, landSpeed, perception, savingThrow, skillCheck, strikeBonus,
} from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import { loadRules } from '../state/rulesData.js';
import { SKILLS } from '../sheet/sheetRules.js';
import ActionCost from '../components/ActionCost.jsx';
import ConditionChips from '../components/ConditionChips.jsx';
import DetailsDrawer from '../components/DetailsDrawer.jsx';
import HealthOrb from '../components/HealthOrb.jsx';
import ShieldGauge from '../components/ShieldGauge.jsx';
import HpTracker from '../components/HpTracker.jsx';
import ShieldTracker from '../components/ShieldTracker.jsx';
import Icon from '../components/Icon.jsx';
import RollDrawer from '../components/RollDrawer.jsx';
import { DamageButton, damageExpr } from '../components/Dice.jsx';
import { sentenceCase, signed, titleCase } from '../format.js';

const COSTS = new Set(['1', '2', '3', 'reaction', 'free']);
/** How many of the turn's 3 actions an option spends: its cost, the fewest for "1 to 3" (reactions and free actions spend none). */
const spends = (cost) => Number(/^([123])\b/.exec(String(cost))?.[1] ?? 0);

// The basic actions anyone can take in an encounter (Player Core, "Basic Actions"; the
// Player Reference Card's wording where it has them), with their traits.
const BASIC = [
  { id: 'stride', name: 'Stride', cost: 1, traits: ['move'], hint: (c) => `Move up to your Speed (${c.speed} ft).` },
  { id: 'step', name: 'Step', cost: 1, traits: ['move'], hint: () => 'Move 5 feet without triggering reactions.' },
  { id: 'interact', name: 'Interact', cost: 1, traits: ['manipulate'], hint: () => 'Grab an object, open a door, swap what you’re holding, or similar.' },
  { id: 'shield', name: 'Raise a Shield', cost: 1, traits: [], hint: (c) => `+${c.shield?.acBonus ?? 2} AC until the start of your next turn.`, needs: (c) => Boolean(c.shield) },
  { id: 'take-cover', name: 'Take Cover', cost: 1, traits: [], hint: () => 'Behind cover, it gets better; in the open, +2 AC behind lesser cover.' },
  { id: 'seek', name: 'Seek', cost: 1, traits: ['concentrate', 'secret'], hint: (c) => `Scan an area for creatures or objects: Perception ${signed(c.perceptionTotal)}.` },
  { id: 'escape', name: 'Escape', cost: 1, traits: ['attack'], hint: (c) => `Break free of a grab or restraint: ${signed(c.escapeTotal)}.` },
  { id: 'stand', name: 'Stand', cost: 1, traits: ['move'], hint: () => 'Stand up from prone.' },
  { id: 'drop-prone', name: 'Drop Prone', cost: 1, traits: ['move'], hint: () => 'Fall prone.' },
  { id: 'leap', name: 'Leap', cost: 1, traits: ['move'], hint: (c) => `Jump ${c.speed >= 30 ? 15 : 10} feet across, or 3 feet up and 5 feet across.` },
  { id: 'ready', name: 'Ready', cost: 2, traits: ['concentrate'], hint: () => 'Choose an action and a trigger; use it as a reaction when the trigger happens.' },
  { id: 'release', name: 'Release', cost: 'free', traits: ['manipulate'], hint: () => 'Let go of something you’re holding.' },
  { id: 'delay', name: 'Delay', cost: 'free', traits: [], hint: () => 'Wait, and act later in the initiative order.' },
  { id: 'aid', name: 'Aid', cost: 'reaction', traits: [], hint: () => 'Help an ally’s check, if you prepared to on your turn.' },
];

const RECALL = 'Recall Knowledge';

/**
 * Skill actions that take actions in a round (from each skill's uses on the sheet), with the
 * character's modifier. Recall Knowledge is listed once, with every skill it can use.
 */
function skillActions(character, conditions) {
  const out = [];
  const recall = [];
  for (const [skill, info] of Object.entries(SKILLS)) {
    const check = skillCheck(character, skill, { conditions });
    for (const [name, cost, trainedOnly] of info.uses) {
      if (!COSTS.has(String(cost))) continue;
      if (name === RECALL) {
        recall.push(`${titleCase(skill)} ${signed(check.total)}`);
        continue;
      }
      out.push({ id: `skill:${name}`, kind: 'skill', skill, name, cost, hint: `${titleCase(skill)} ${signed(check.total)}`, locked: trainedOnly && check.rank === 'untrained' });
    }
  }
  if (recall.length) out.unshift({ id: `skill:${RECALL}`, kind: 'skill', name: RECALL, cost: 1, hint: recall.join(' · ') });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The character's feats that are actions, reactions or free actions (from the rules data).
 * shortcut: class features that grant actions (a fighter's Reactive Strike) aren't listed, as
 * the class data has no action costs; add costs to class features to list them.
 */
function useFeatActions(character) {
  const [feats, setFeats] = useState([]);
  useEffect(() => {
    let cancelled = false;
    loadRules({ types: ['feats'] }).then(
      (data) => {
        if (cancelled) return;
        const byId = new Map(data.feats.map((f) => [f.id, f]));
        setFeats(character.feats.map((f) => byId.get(f.id)).filter((f) => f && COSTS.has(String(f.actions))));
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [character.feats]);
  return feats;
}

/** The spells' full rules text (range, targets, description), loaded the first time a spell is opened. */
function useSpellRules(needed) {
  const [spells, setSpells] = useState(null);
  useEffect(() => {
    if (!needed || spells) return undefined;
    let cancelled = false;
    loadRules({ types: ['spells'] }).then((d) => !cancelled && setSpells(d.spells), () => !cancelled && setSpells([]));
    return () => {
      cancelled = true;
    };
  }, [needed, spells]);
  return spells;
}

const KIND_LABEL = { basic: 'Basic action', skill: 'Skill action', spell: 'Spell', feat: 'Feat', item: 'Item' };
const skillIcon = (skill) => (skill ? `skill${skill[0].toUpperCase()}${skill.slice(1)}` : 'skillLore');

/**
 * An option in the details drawer: its rules (a spell's or feat's full text, a basic
 * action's from the reference card), and the button that uses it, which spends its actions.
 */
function optionDetail(o, { spellRules, canUse, actionsLeft, onUse }) {
  const spell = o.kind === 'spell' ? (spellRules?.find((x) => x.id === o.spell.id || x.slug === o.spell.slug) ?? o.spell) : null;
  const reaction = o.cost === 'reaction';
  const verb = o.kind === 'spell' ? 'Cast' : 'Use';
  // A cost like "1 to 3" (Force Barrage, Heal): a button for each number of actions, as you choose when you cast.
  const range = /^([123]) to ([123])$/.exec(String(o.cost));
  const counts = range ? Array.from({ length: range[2] - range[1] + 1 }, (_, i) => Number(range[1]) + i) : null;
  const noun = o.kind === 'spell' ? 'spell' : o.kind === 'item' ? (o.heal ? `and roll ${o.heal} HP` : 'item') : reaction ? 'reaction' : o.cost === 'free' ? 'free action' : 'action';
  const button = (
    <div className="combat-use">
      {counts ? (
        counts.map((n) => (
          <button key={n} type="button" className="btn btn--blood" disabled={o.locked || n > actionsLeft} onClick={() => onUse(o, n)}>
            <ActionCost actions={String(n)} /> {verb} with {n} action{n === 1 ? '' : 's'}
          </button>
        ))
      ) : (
        <button type="button" className="btn btn--blood" disabled={!canUse} onClick={() => onUse(o)}>
          <ActionCost actions={String(o.cost)} /> {verb} {noun}
        </button>
      )}
      {!canUse && <p className="rule-note" style={{ margin: 0 }}>{o.locked ? "You're untrained in this skill." : reaction ? "You've used your reaction this round." : 'Not enough actions left this turn.'}</p>}
    </div>
  );
  const base = { kind: o.kind === 'spell' ? `Spell · ${o.hint}` : KIND_LABEL[o.kind] ?? 'Action', name: o.name, actions: String(o.cost), value: '', tool: button };
  if (o.kind === 'spell') {
    return {
      ...base,
      icon: 'spells',
      facts: [
        ['Range', sentenceCase(spell.range)],
        ['Area', sentenceCase(spell.area)],
        ['Targets', sentenceCase(spell.target)],
        ['Defense', spell.defense && titleCase(spell.defense)],
        ['Duration', sentenceCase(spell.duration)],
        ['Traits', (spell.traits ?? []).map(titleCase).join(', ')],
      ].filter(([, v]) => v),
      ...(spell.description ? { html: spell.description } : { note: spellRules ? 'No rules text for this spell.' : 'Opening the spell…' }),
    };
  }
  if (o.kind === 'feat') {
    return { ...base, icon: 'feats', facts: [['Level', o.feat.level], ['Traits', o.feat.traits.map(titleCase).join(', ')]], html: o.feat.description };
  }
  if (o.kind === 'item') {
    return {
      ...base,
      icon: 'inventory',
      facts: [['In your pack', o.qty], ['Restores', o.heal && `${o.heal} Hit Points`]].filter(([, v]) => v),
      note: `${o.text}${o.qty === 1 ? ' This is your last one.' : ''}`,
    };
  }
  if (o.kind === 'skill') return { ...base, icon: skillIcon(o.skill), note: `${o.hint}. Roll your skill check against the DC your GM sets.` };
  return { ...base, icon: 'swords', note: o.hint, facts: o.traits?.length ? [['Traits', o.traits.map(titleCase).join(', ')]] : [] };
}

/** A remembered open/closed state for this device (the guide stays shut once you close it). */
function useRemembered(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? initial : v === '1';
    } catch {
      return initial;
    }
  });
  const set = (v) => {
    setValue(v);
    try {
      localStorage.setItem(key, v ? '1' : '0');
    } catch {
      // Storage blocked: it just won't be remembered.
    }
  };
  return [value, set];
}

/**
 * The GM's running encounter, as this player sees it: the round, whose turn it is ("Your
 * turn" when it's theirs), and the initiative order.
 */
function EncounterBanner({ encounter, myTurn, campaignId }) {
  const acting = encounter.combatants.find((c) => c.key === encounter.current);
  return (
    <section className={`panel encounter-banner ${myTurn ? 'encounter-banner--mine' : ''}`} aria-labelledby="encounter-banner-title">
      <span className="eyebrow">{encounter.name} · Round {encounter.round}</span>
      <h2 id="encounter-banner-title" className="title" aria-live="polite">
        {myTurn ? 'Your turn' : acting ? `${acting.name}’s turn` : 'Waiting for the GM'}
      </h2>
      {!myTurn && <p className="rule-note" style={{ margin: 0 }}>Your reaction still works while you wait.</p>}
      {campaignId && <Link to={`/campaigns/${campaignId}/encounter`} className="encounter-banner__open">Open the encounter <Icon name="arrow" size={14} /></Link>}
      <ol className="encounter-banner__order" aria-label="Initiative order">
        {encounter.combatants.map((c) => (
          <li key={c.key} aria-current={c.key === encounter.current ? 'true' : undefined} className={c.defeated ? 'encounter-banner__down' : undefined}>
            <span className="encounter-banner__init">{c.initiative ?? '—'}</span>
            {c.name}
            {c.defeated && <span className="visually-hidden"> (down)</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The turn's 3 actions and 1 reaction, as on the Player Reference Card: dimmed once spent. */
function Economy({ actionsLeft, reactionUsed }) {
  return (
    <div className="economy" role="img" aria-label={`${actionsLeft} of 3 actions left, reaction ${reactionUsed ? 'used' : 'ready'}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`economy__slot ${i < actionsLeft ? '' : 'economy__slot--spent'}`}><span className="act act--1" /></span>
      ))}
      <span className={`economy__slot economy__slot--reaction ${reactionUsed ? 'economy__slot--spent' : ''}`}><span className="act act--r" /></span>
    </div>
  );
}

/** One option as a card: its cost, name, what it does and its traits; dimmed when it can't be used now. Opens its details. */
function Option({ option, disabled, open, onOpen }) {
  return (
    <button type="button" className={`combat-option ${disabled || option.locked ? 'combat-option--spent' : ''}`} aria-pressed={open} onClick={() => onOpen(option)}>
      <span className="combat-option__cost"><ActionCost actions={String(option.cost)} /></span>
      <span className="combat-option__body">
        <span className="combat-option__name">{option.name}</span>
        <span className="combat-option__hint">{option.locked ? 'Trained only: you’re untrained in this skill.' : option.hint}</span>
        {option.traits?.length > 0 && <span className="combat-option__traits">{option.traits.map((t) => <span key={t} className="tag">{t}</span>)}</span>}
      </span>
    </button>
  );
}

/** The options as tabs (Actions, Skills, Spells, Feats, Reactions & free), one group showing at a time. */
function OptionTabs({ groups, canUse, open, onOpen }) {
  const shown = groups.filter((g) => g.options.length);
  const [picked, setPicked] = useState(shown[0]?.key);
  const current = shown.find((g) => g.key === picked) ?? shown[0];
  if (!current) return null;
  const onKeyDown = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = shown[(shown.indexOf(current) + step + shown.length) % shown.length];
    setPicked(next.key);
    document.getElementById(`combat-tab-${next.key}`)?.focus();
  };
  return (
    <section className="combat-options" aria-label="What you can do">
      <div className="combat-tabs" role="tablist" aria-label="Kinds of action" onKeyDown={onKeyDown}>
        {shown.map((g) => (
          <button
            key={g.key}
            id={`combat-tab-${g.key}`}
            type="button"
            role="tab"
            className="combat-tab"
            aria-selected={g === current}
            aria-controls="combat-tab-panel"
            tabIndex={g === current ? 0 : -1}
            onClick={() => setPicked(g.key)}
          >
            {g.label} <span className="combat-tab__count">{g.options.length}</span>
          </button>
        ))}
      </div>
      <div id="combat-tab-panel" role="tabpanel" aria-labelledby={`combat-tab-${current.key}`}>
        {current.note && <p className="rule-note">{current.note}</p>}
        <div className="combat-option-grid">
          {current.options.map((o) => (
            <Option key={o.id} option={o} open={open === o.id} onOpen={onOpen} disabled={!canUse(o)} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** "New to combat?": the Player Reference Card's basics, with this character's own numbers. */
function Guide({ character, ac, open, onToggle }) {
  return (
    <details className="panel combat-guide" open={open} onToggle={(e) => onToggle(e.currentTarget.open)}>
      <summary>New to combat? How a round works</summary>
      <h3>On your turn</h3>
      <p>At the start of your turn, you regain your <strong>3 actions</strong> and <strong>1 reaction</strong>. Spend actions on anything here: most cost <ActionCost actions="1" />, some <ActionCost actions="2" />. Your reaction <ActionCost actions="reaction" /> is used when its trigger happens, even on someone else's turn. Speaking or dropping something doesn't take an action.</p>
      <h3>Checks</h3>
      <p><strong>d20 + your modifier</strong>, with any bonuses and penalties, compared to a <strong>DC</strong> (the number to meet).</p>
      <dl className="combat-guide__degrees">
        <div><dt>Critical success</dt><dd>Beat the DC by 10 or more.</dd></div>
        <div><dt>Success</dt><dd>Meet or beat the DC.</dd></div>
        <div><dt>Failure</dt><dd>Roll lower than the DC.</dd></div>
        <div><dt>Critical failure</dt><dd>Miss the DC by 10 or more.</dd></div>
      </dl>
      <p><strong>Rolling a 20 or a 1:</strong> a natural 20 on the die makes the result one step better; a natural 1, one step worse.</p>
      <h3>DCs</h3>
      <p>
        A DC is a modifier + 10. Foes roll their attacks against your <strong>AC {ac}</strong>
        {character.keyAbility ? <>, and your class abilities against their saves use your <strong>Class DC {classDc(character).total}</strong></> : ''}.
      </p>
      <h3>Attacking more than once</h3>
      <p>Your 2nd Strike in a turn takes −5, and your 3rd and later −10 (−4 and −8 with an agile weapon). The Strikes above show each one.</p>
    </details>
  );
}

/**
 * The Combat tab: a round at a glance. The turn (whose, the 3 actions and reaction left,
 * your defenses as they are right now), your Strikes with each attack's bonus, then
 * everything else you can do, in tabs; your Hit Points and shield, conditions, this turn so
 * far and a beginner's guide beside them. An option opens its details, with the button that
 * uses it; a Strike rolls in the roll drawer (from the left on wide screens).
 */
export default function CombatPage() {
  const {
    character, conditions, used, actionsLeft, strikesSoFar, takeAction, strike, endTurn, cycleCondition, resetEncounter,
    shieldRaised, encounter, myTurn, round, campaign, currentHp, maxHp, setHp, shield, rollDamage, rollHealing, carried, setInventory,
  } = useTable();
  const consumables = useCarriedConsumables(carried);
  const feats = useFeatActions(character);
  const [guideOpen, setGuideOpen] = useRemembered('rollbound:combat-guide', true);
  // The details drawer: an option's id, or 'shield'. The roll drawer, after a Strike.
  const [open, setOpen] = useState(null);
  const [rolling, setRolling] = useState(false);
  const closeRoll = useCallback(() => setRolling(false), []);
  const spellRules = useSpellRules(String(open).startsWith('spell:'));
  const reactionUsed = used.some((u) => u.reaction);
  const opts = { conditions, shieldRaised };
  const speed = landSpeed(character).total;
  const ac = armorClass(character, opts).total;

  const c = {
    ...character,
    speed,
    perceptionTotal: perception(character, opts).total,
    escapeTotal: Math.max(skillCheck(character, 'athletics', opts).total, skillCheck(character, 'acrobatics', opts).total),
  };
  const basic = BASIC.filter((b) => !b.needs || b.needs(character)).map((b) => ({ ...b, kind: 'basic', hint: b.hint(c) }));
  const skills = skillActions(character, conditions);
  const casting = character.spellcasting;
  const spells = casting
    ? [...casting.cantrips.map((s) => ({ s, what: 'Cantrip' })), ...casting.spells.map((s) => ({ s, what: `Rank ${s.rank}` }))]
        .filter(({ s }) => s.actions)
        .map(({ s, what }) => ({ id: `spell:${s.id ?? s.slug}`, kind: 'spell', spell: s, name: s.name, cost: s.actions, hint: what, traits: (s.traits ?? []).slice(0, 4) }))
    : [];
  const featOptions = feats.map((f) => ({ id: `feat:${f.id}`, kind: 'feat', feat: f, name: f.name, cost: String(f.actions), hint: `${titleCase(f.category)} feat`, traits: f.traits.filter((t) => t !== f.category).slice(0, 4) }));
  const itemOptions = consumables.map((x) => ({ id: `item:${x.key}`, kind: 'item', name: x.name, cost: x.cost, qty: x.qty, heal: x.heal, text: x.text, itemKey: x.key, hint: `${x.qty} in your pack${x.heal ? ` · restores ${x.heal} HP` : ''}`, traits: [] }));
  const byCost = (list, test) => list.filter((o) => test(String(o.cost)));
  const isAction = (k) => /^[123]$/.test(k) || / to /.test(k);
  const groups = [
    { key: 'actions', label: 'Actions', options: byCost(basic, isAction), note: 'Anyone can do these. Tap one for its rules and to use it.' },
    { key: 'skills', label: 'Skills', options: byCost(skills, isAction), note: 'Skill actions you can use in a fight, with your modifier.' },
    { key: 'spells', label: 'Spells', options: byCost(spells, isAction), note: 'Tap a spell to read it and cast it.' },
    { key: 'feats', label: 'Feats', options: byCost(featOptions, isAction) },
    { key: 'items', label: 'Items', options: itemOptions, note: 'Potions, elixirs and other consumables you carry. Using one spends its actions and uses it up.' },
    {
      key: 'reactions',
      label: 'Reactions & free',
      options: [...basic, ...featOptions, ...skills].filter((o) => o.cost === 'reaction' || o.cost === 'free'),
      note: 'Reactions happen when their trigger does, once per round. Free actions cost nothing.',
    },
  ];
  const all = groups.flatMap((g) => g.options);

  const canUse = (o) => !o.locked && (o.cost === 'reaction' ? !reactionUsed : spends(o.cost) <= actionsLeft);
  const onUse = (o, actions = null) => {
    const cost = actions ?? spends(o.cost);
    if (cost) takeAction(o, actions ? `${actions} action${actions === 1 ? '' : 's'}` : '', cost);
    else takeAction(o, o.cost === 'reaction' ? 'reaction' : 'free action', 0);
    setOpen(null);
    if (o.kind === 'item') consumeItem(o);
  };
  // An item is used up: one fewer in the pack; a healing one rolls its Hit Points and adds them.
  const consumeItem = (o) => {
    if (carried) {
      setInventory({ ...carried, items: carried.items.flatMap((i) => (i.key !== o.itemKey ? [i] : i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : [])) });
    }
    if (!o.heal) return;
    const roll = rollHealing(o.name, o.heal);
    if (!roll) return;
    setHp(currentHp + roll.total);
    setRolling(true);
  };
  const onRollDamage = (label, expr, damageType) => {
    if (!rollDamage(label, expr, damageType)) return;
    setOpen(null);
    setRolling(true);
  };
  const onStrike = (w) => {
    if (!strike(w)) return;
    setOpen(null);
    setRolling(true);
  };
  const opened = all.find((o) => o.id === open);
  const detail = open === 'shield' && shield
    ? {
        kind: 'Shield',
        name: shield.name,
        icon: 'shield',
        value: `${shield.current}`,
        unit: `/ ${shield.max} HP`,
        facts: [['Hardness', shield.hardness], ['Broken Threshold', `${shield.brokenAt} HP`], ['Raised', shieldRaised ? 'Yes' : 'No']],
        tool: <ShieldTracker bare />,
      }
    : opened && optionDetail(opened, { spellRules, canUse: canUse(opened), actionsLeft, onUse });

  const defenses = [
    ['AC', ac],
    ['Fortitude', signed(savingThrow(character, 'fortitude', opts).total)],
    ['Reflex', signed(savingThrow(character, 'reflex', opts).total)],
    ['Will', signed(savingThrow(character, 'will', opts).total)],
    ['Perception', signed(c.perceptionTotal)],
    character.keyAbility && ['Class DC', classDc(character).total],
    ['Speed', `${speed} ft`],
  ].filter(Boolean);

  return (
    <div className="combat">
      {encounter && <EncounterBanner encounter={encounter} myTurn={myTurn} campaignId={campaign?.id} />}

      <section className={`panel combat-turn ${myTurn ? 'combat-turn--mine' : ''}`} aria-labelledby="combat-turn-title">
        <div className="combat-turn__who">
          <span className="eyebrow">{encounter ? `Round ${round}` : `Practice · round ${round}`}</span>
          <h1 id="combat-turn-title" className="title">{character.name.split(' ')[0]}'s turn</h1>
          <span className="combat-turn__left">
            {actionsLeft} action{actionsLeft === 1 ? '' : 's'} left · reaction {reactionUsed ? 'used' : 'ready'}{shieldRaised ? ' · shield raised' : ''}
          </span>
        </div>
        <Economy actionsLeft={actionsLeft} reactionUsed={reactionUsed} />
        <div className="combat-turn__buttons">
          <button type="button" className="btn" onClick={resetEncounter}>Reset</button>
          <button type="button" className="btn btn--blood" onClick={endTurn}>End turn</button>
        </div>
        <dl className="combat-turn__defenses" aria-label="Your defenses right now">
          {defenses.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      </section>

      <section className="combat-strikes" aria-labelledby="combat-strikes-title">
        <h2 id="combat-strikes-title" className="sheet-panel__title">Strikes</h2>
        <ul>
          {character.weapons.map((w, i) => {
            const mod = damageModifier(w, character.abilities);
            const ladder = [0, 1, 2].map((n) => strikeBonus(character, w, { attacksSoFar: n, conditions }).total);
            const at = Math.min(strikesSoFar, 2);
            return (
              <li key={`${w.name}-${i}`} className="combat-strike">
                <span className="combat-strike__weapon">
                  <span className="combat-strike__name">{w.name}</span>
                  <span className="combat-strike__dmg">
                    <DamageButton label={w.name} expr={damageExpr(w.die, mod)} die={w.die} damageType={w.damageType} onRoll={onRollDamage}>
                      1d{w.die}{mod ? signed(mod) : ''} {w.damageType ?? ''}
                    </DamageButton>
                    {w.traits?.includes('agile') && <span className="tag">agile</span>}
                  </span>
                </span>
                <ol className="combat-strike__ladder" aria-label={`${w.name} attack bonus by attack this turn`}>
                  {ladder.map((b, n) => (
                    <li key={n} aria-current={n === at ? 'true' : undefined}>
                      <small>{['1st', '2nd', '3rd+'][n]}</small>
                      {signed(b)}
                    </li>
                  ))}
                </ol>
                <button type="button" className="btn btn--blood combat-strike__go" disabled={actionsLeft < 1} onClick={() => onStrike(w)}>
                  <ActionCost actions="1" /> Strike
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="combat-body">
        <OptionTabs groups={groups} canUse={canUse} open={open} onOpen={(o) => { setRolling(false); setOpen(open === o.id ? null : o.id); }} />

        <aside className="combat-side">
          {/* Your state first (the orb leads, the shield beside it), then the controls that change it. */}
          <section className="panel combat-vitals" aria-labelledby="combat-vitals-title">
            <h2 id="combat-vitals-title" className="sheet-panel__title">Health</h2>
            <div className="combat-vitals__readings">
              <HealthOrb current={currentHp} max={maxHp} onRestore={() => setHp(maxHp)} />
              {shield && <ShieldGauge shield={shield} raised={shieldRaised} pressed={open === 'shield'} onOpen={() => { setRolling(false); setOpen(open === 'shield' ? null : 'shield'); }} />}
            </div>
            <div className="combat-vitals__controls">
              <HpTracker />
            </div>
          </section>

          <section className="panel" aria-labelledby="combat-conditions-title">
            <h2 id="combat-conditions-title" className="sheet-panel__title">Conditions</h2>
            <ConditionChips conditions={conditions} onToggle={cycleCondition} />
            {conditions.map((x) => {
              const d = describeCondition(x);
              return (
                <p key={x.id} className="combat-condition"><strong>{d.name}.</strong> {d.summary}</p>
              );
            })}
          </section>

          <section className="panel" aria-labelledby="combat-log-title">
            <h2 id="combat-log-title" className="sheet-panel__title">This turn</h2>
            <ol className="combat-log">
              {used.length === 0 && <li className="combat-log__empty">Nothing yet. Choose a Strike or an action.</li>}
              {used.map((u, i) => (
                <li key={i}>
                  <span className="combat-log__cost"><ActionCost actions={u.reaction ? 'reaction' : u.cost ? String(u.cost) : 'free'} /></span>
                  <span>{u.name}{u.detail && u.detail !== 'reaction' && u.detail !== 'free action' ? <span className="muted"> · {u.detail}</span> : null}</span>
                </li>
              ))}
            </ol>
          </section>

          <Guide character={character} ac={ac} open={guideOpen} onToggle={setGuideOpen} />
        </aside>
      </div>

      <DetailsDrawer detail={detail} onClose={() => setOpen(null)} onRollDice={onRollDamage} />
      <RollDrawer open={rolling} onClose={closeRoll} />
    </div>
  );
}
