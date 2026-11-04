import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { strikeBonus, damageModifier, describeCondition, landSpeed, perception, skillCheck } from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import { loadRules } from '../state/rulesData.js';
import { SKILLS } from '../sheet/sheetRules.js';
import Ornament from '../components/Ornament.jsx';
import ActionCost from '../components/ActionCost.jsx';
import ConditionChips from '../components/ConditionChips.jsx';
import { signed, titleCase } from '../format.js';

const COSTS = new Set(['1', '2', '3', 'reaction', 'free']);
/** How many of the turn's 3 actions an option spends: its cost, the fewest for "1 to 3" (reactions and free actions spend none). */
const spends = (cost) => Number(/^([123])\b/.exec(String(cost))?.[1] ?? 0);

// The basic actions anyone can take in an encounter (Player Core, "Basic Actions").
const BASIC = [
  { id: 'stride', name: 'Stride', cost: 1, hint: (c) => `Move up to your Speed, ${landSpeed(c).total} ft` },
  { id: 'step', name: 'Step', cost: 1, hint: () => 'Move 5 ft without triggering reactions' },
  { id: 'interact', name: 'Interact', cost: 1, hint: () => 'Draw, stow, grab or open something' },
  { id: 'shield', name: 'Raise a Shield', cost: 1, hint: (c) => `+${c.shield?.acBonus ?? 2} AC until your next turn`, needs: (c) => Boolean(c.shield) },
  { id: 'take-cover', name: 'Take Cover', cost: 1, hint: () => 'Better cover, or +2 AC behind lesser cover' },
  { id: 'seek', name: 'Seek', cost: 1, hint: (c) => `Perception ${signed(c.perceptionTotal)} to find hidden things` },
  { id: 'escape', name: 'Escape', cost: 1, hint: (c) => `Break a grab: ${signed(c.escapeTotal)}` },
  { id: 'stand', name: 'Stand', cost: 1, hint: () => 'Get up from prone' },
  { id: 'drop-prone', name: 'Drop Prone', cost: 1, hint: () => 'Fall flat: harder to hit with ranged attacks' },
  { id: 'leap', name: 'Leap', cost: 1, hint: () => 'Jump 10 ft across or 3 ft up' },
  { id: 'ready', name: 'Ready', cost: 2, hint: () => 'Prepare an action to use as a reaction later' },
  { id: 'release', name: 'Release', cost: 'free', hint: () => 'Let go of something you hold' },
  { id: 'delay', name: 'Delay', cost: 'free', hint: () => 'Act later in the initiative order' },
  { id: 'aid', name: 'Aid', cost: 'reaction', hint: () => 'Help an ally’s check you prepared for' },
];

const RECALL = 'Recall Knowledge';

/**
 * Skill actions that take actions in a round (from each skill's uses on the sheet), with the
 * character's modifier. Recall Knowledge is listed once, with every skill it can use.
 */
function skillActions(character) {
  const out = [];
  const recall = [];
  for (const [skill, info] of Object.entries(SKILLS)) {
    const check = skillCheck(character, skill);
    for (const [name, cost, trainedOnly] of info.uses) {
      if (!COSTS.has(String(cost))) continue;
      if (name === RECALL) {
        recall.push(`${titleCase(skill)} ${signed(check.total)}`);
        continue;
      }
      out.push({ id: `skill:${name}`, name, cost, hint: `${titleCase(skill)} ${signed(check.total)}`, locked: trainedOnly && check.rank === 'untrained' });
    }
  }
  if (recall.length) out.unshift({ id: `skill:${RECALL}`, name: RECALL, cost: 1, hint: recall.join(' · ') });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The character's feats that are actions, reactions or free actions (from the rules data).
 * shortcut: class features that grant actions (a fighter's Reactive Strike) aren't listed, as
 * the class data has no action costs; add costs to class features when the encounter tracker lands.
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

function mapNote(n) {
  if (n === 0) return 'First attack this turn: no penalty';
  if (n === 1) return '2nd attack: −5 multiple attack penalty (−4 agile)';
  return '3rd+ attack: −10 multiple attack penalty (−8 agile)';
}

/** One option as a button: its action cost, name and what it does, greyed out when it can't be used. */
function Option({ option, disabled, onUse }) {
  return (
    <button type="button" className="action" disabled={disabled || option.locked} onClick={() => onUse(option)}>
      <span className="action__name">
        <ActionCost actions={String(option.cost)} /> {option.name}
      </span>
      <span className="action__hint">{option.locked ? 'Trained only' : option.hint}</span>
    </button>
  );
}

function Group({ title, options, actionsLeft, reactionUsed, onUse }) {
  if (!options.length) return null;
  return (
    <section aria-label={title}>
      <Ornament label={title.toUpperCase()} />
      <div className="actions">
        {options.map((o) => (
          <Option key={o.id} option={o} onUse={onUse} disabled={o.cost === 'reaction' ? reactionUsed : spends(o.cost) > actionsLeft} />
        ))}
      </div>
    </section>
  );
}

/**
 * The GM's running encounter, as this player sees it: the round, whose turn it is ("Your
 * turn" when it's theirs), and the initiative order.
 */
function EncounterBanner({ encounter, myTurn }) {
  const acting = encounter.combatants.find((c) => c.key === encounter.current);
  const order = encounter.combatants; // the GM's turn order
  return (
    <section className={`panel encounter-banner ${myTurn ? 'encounter-banner--mine' : ''}`} aria-labelledby="encounter-banner-title">
      <span className="eyebrow">{encounter.name} · Round {encounter.round}</span>
      <h1 id="encounter-banner-title" className="title" aria-live="polite">
        {myTurn ? 'Your turn' : acting ? `${acting.name}’s turn` : 'Waiting for the GM'}
      </h1>
      {!myTurn && <p className="rule-note" style={{ margin: 0 }}>Your reactions still work while you wait.</p>}
      <ol className="encounter-banner__order" aria-label="Initiative order">
        {order.map((c) => (
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

/**
 * The Combat tab: everything the character can do in a round of combat, grouped (Strikes,
 * basic actions, skill actions, spells, feats, reactions and free actions) with their costs
 * and modifiers. Using one spends its actions for the turn; a Strike rolls.
 */
export default function CombatPage() {
  const navigate = useNavigate();
  const { character, conditions, used, actionsLeft, strikesSoFar, takeAction, strike, endTurn, cycleCondition, resetEncounter, shieldRaised, encounter, myTurn } = useTable();
  const feats = useFeatActions(character);
  const reactionUsed = used.some((u) => u.reaction);

  const c = {
    ...character,
    perceptionTotal: perception(character).total,
    escapeTotal: Math.max(skillCheck(character, 'athletics').total, skillCheck(character, 'acrobatics').total),
  };

  const strikes = character.weapons.map((w, i) => {
    const bonus = strikeBonus(character, w, { attacksSoFar: strikesSoFar, conditions });
    const mod = damageModifier(w, character.abilities);
    return { id: `strike:${i}`, name: `Strike: ${w.name}`, cost: 1, weapon: w, hint: `${signed(bonus.total)} to hit · 1d${w.die}${mod ? signed(mod) : ''} ${w.damageType ?? ''}`.trim() };
  });
  const basic = BASIC.filter((b) => !b.needs || b.needs(character)).map((b) => ({ ...b, hint: b.hint(c) }));
  const skills = skillActions(character);
  const casting = character.spellcasting;
  const spells = casting
    ? [...casting.cantrips.map((s) => ({ s, what: 'Cantrip' })), ...casting.spells.map((s) => ({ s, what: `Rank ${s.rank}` }))]
        .filter(({ s }) => s.actions)
        .map(({ s, what }) => ({ id: `spell:${s.id ?? s.slug}`, name: s.name, cost: s.actions, hint: what }))
    : [];
  const featOptions = feats.map((f) => ({ id: `feat:${f.id}`, name: f.name, cost: String(f.actions), hint: `${titleCase(f.category)} feat` }));
  const byCost = (list, test) => list.filter((o) => test(String(o.cost)));
  const isAction = (k) => /^[123]$/.test(k) || / to /.test(k);
  const reactions = [...byCost(basic, (k) => k === 'reaction'), ...byCost(featOptions, (k) => k === 'reaction')];
  const free = [...byCost(basic, (k) => k === 'free'), ...byCost(featOptions, (k) => k === 'free'), ...byCost(skills, (k) => k === 'free')];

  const onUse = (o) => {
    if (o.weapon) {
      if (strike(o.weapon)) navigate('../roll');
      return;
    }
    const cost = spends(o.cost);
    if (cost) takeAction(o, '', cost);
    else takeAction(o, o.cost === 'reaction' ? 'reaction' : 'free action', 0);
  };

  const next = strikeBonus(character, character.weapons[0], { attacksSoFar: strikesSoFar, conditions });
  const condPenalty = next.parts.find((p) => p.note === 'Status penalty from a condition.');
  const group = (title, options) => <Group title={title} options={options} actionsLeft={actionsLeft} reactionUsed={reactionUsed} onUse={onUse} />;

  return (
    <div className="split">
      <div className="split__col">
        {encounter && <EncounterBanner encounter={encounter} myTurn={myTurn} />}
        <section className="center" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
          {!encounter && <h1 className="title">{character.name.split(' ')[0]}'s turn</h1>}
          <div className="pips" role="img" aria-label={`${actionsLeft} of 3 actions remaining`}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={`pip ${i < actionsLeft ? 'pip--open' : ''}`} />
            ))}
          </div>
          <p className="italic" style={{ margin: 0, color: 'var(--text-soft)' }}>
            {actionsLeft} of 3 actions remain · {reactionUsed ? 'reaction used' : '1 reaction'}{shieldRaised ? ' · shield raised' : ''}
          </p>
        </section>

        <section className="panel next-strike">
          <div>
            <div className="eyebrow" style={{ color: 'var(--bronze)' }}>Next attack</div>
            <div className="italic" style={{ color: 'var(--text-soft)' }}>
              {mapNote(strikesSoFar)}
              {condPenalty ? `; ${signed(condPenalty.value)} from ${condPenalty.label}` : ''}
            </div>
          </div>
        </section>

        <section aria-label="Conditions" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ConditionChips conditions={conditions} onToggle={cycleCondition} />
          {conditions.map((x) => {
            const d = describeCondition(x);
            return (
              <div key={x.id} className="panel panel--hot condition">
                <span className="condition__name">{d.name}</span>
                <span style={{ fontSize: 14 }}>{d.summary}</span>
              </div>
            );
          })}
        </section>

        <ol className="log" aria-label="This turn">
          {used.length === 0 && <li className="italic" style={{ color: 'var(--text-dim)' }}>Nothing yet. Choose an option.</li>}
          {used.map((u, i) => (
            <li key={i}>
              {i + 1}. {u.name}
              {u.detail ? ` (${u.detail})` : ''}
            </li>
          ))}
        </ol>

        <div className="btn-row">
          <button type="button" className="btn" onClick={resetEncounter}>Reset</button>
          <button type="button" className="btn btn--blood btn--grow" onClick={endTurn}>End turn</button>
        </div>
      </div>

      <div className="split__col">
        {group('Strikes', strikes)}
        {group('Basic actions', byCost(basic, isAction))}
        {group('Skill actions', byCost(skills, isAction))}
        {group('Spells', byCost(spells, isAction))}
        {group('Feat actions', byCost(featOptions, isAction))}
        {group('Reactions', reactions)}
        {group('Free actions', free)}
      </div>
    </div>
  );
}
