import { useState } from 'react';
import { loreOptions, lookup } from '@rollbound/rules';
import Showcase, { Emblem } from './Showcase.jsx';
import Chips, { pick } from './Chips.jsx';
import ChoiceHeading from './ChoiceHeading.jsx';
import { ABILITY_SHORT, SIZE, abilityList, boostSlotLabel, cap, sourceTag } from './labels.js';
import BookSpread, { LETTER_SECTIONS, letterOf } from '../components/BookSpread.jsx';
import BookLeaf, { ChosenActions, wide } from './BookLeaf.jsx';

const boostsLine = (slots) => slots.map(boostSlotLabel).join(', ');

export function AncestryStep({ build, update, data }) {
  return (
    <>
      <Showcase
        kind="ancestry"
        label="Ancestries"
        prompt="Choose your ancestry"
        items={data.ancestries}
        selected={build.ancestry}
        stats={(a) => [
          ['Hit Points', a.hp],
          ['Size', SIZE[a.size] ?? a.size],
          ['Speed', `${a.speed} ft`],
          ['Vision', cap(a.vision.replace(/-vision$/, ''))],
          ['Boosts', boostsLine(a.boosts)],
          ['Flaw', a.flaws.length ? abilityList(a.flaws) : 'None'],
        ]}
        onSelect={(id) =>
          id !== build.ancestry &&
          update({ ancestry: id, heritage: null, heritageSkill: null, ancestryBoosts: [], ancestryFeat: null, languages: [] })
        }
      />
    </>
  );
}

/**
 * A heritage as the right-hand page: whose it is, its full text, the button that chooses
 * it, then what it grants. Once chosen, a heritage's skill choice is made here too.
 */
function HeritageLeaf({ h, ancestry, data, chosen, skill, onSkill, onChoose, onRemove, onClose }) {
  const feats = h.feats.map((id) => data.feats?.find((f) => f.id === id)?.name).filter(Boolean);
  const facts = [
    ['Ancestry HP', h.ancestryHp],
    ['Trained in', h.skillChoice ? 'One skill of your choice' : h.skills.map(cap).join(', ')],
    ['Feats', feats.join(', ')],
    ['Opens feats for', !h.ancestry && [...h.traits, ...h.featAncestries].map(cap).join(', ')],
  ].filter(([, v]) => v);
  return (
    <article className="creature book__turn heritage-leaf">
      <button type="button" className="book__back" onClick={onClose}>‹ Back to the index</button>
      <header className="heritage-leaf__head">
        <div className="heritage-leaf__crest">
          {h.ancestry ? <Emblem kind="ancestry" item={ancestry} /> : <span className="heritage-leaf__glyph" aria-hidden="true">✦</span>}
          <span className="eyebrow">{h.ancestry ? ancestry.name : 'Versatile'} heritage</span>
        </div>
        <h2 className="title">{h.name}</h2>
        <p className="heritage-leaf__book">
          {h.source}
          {h.rarity !== 'common' && <span className="tag tag--rare">{h.rarity}</span>}
        </p>
      </header>
      {h.description && <div className="option__desc heritage-leaf__desc" dangerouslySetInnerHTML={{ __html: h.description }} />}
      <div className="heritage-leaf__foot">
        {chosen && h.skillChoice && (
          <div className="heritage-leaf__skill">
            <ChoiceHeading title="Your skill" chosen={skill && cap(skill)} level={3} />
            <Chips label="Heritage skill" options={h.skillChoice} isOn={(s) => skill === s} onToggle={pick(skill, onSkill)} render={cap} />
          </div>
        )}
        {chosen ? (
          <div className="book__choose"><ChosenActions label="Your heritage" onRemove={onRemove} /></div>
        ) : (
          <button type="button" className="btn btn--blood heritage-leaf__choose" onClick={onChoose}>Choose {h.name}</button>
        )}
      </div>
      {facts.length > 0 && (
        <dl className="heritage-leaf__facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

export function HeritageStep({ build, update, data, goTo }) {
  const { ancestry, heritage } = lookup(build, data);
  // The heritage open on the right page: the chosen one to start with, on wide screens.
  const [openId, setOpenId] = useState(() => (wide() ? build.heritage : null));

  if (!ancestry) {
    return (
      <section className="notice notice--quiet">
        <p>Heritages depend on your ancestry, so choose that first.</p>
        <button type="button" className="btn" onClick={() => goTo('ancestry')}>Choose an ancestry</button>
      </section>
    );
  }

  const byName = (a, b) => a.name.localeCompare(b.name);
  const items = [
    ...data.heritages.filter((h) => h.ancestry === build.ancestry).sort(byName),
    ...data.heritages.filter((h) => !h.ancestry).sort(byName),
  ];
  const open = items.find((h) => h.id === openId) ?? null;
  const select = (id) => update({ heritage: id, heritageSkill: null, ancestryFeat: null });

  return (
    <section className="choice" aria-label="Heritage">
      <BookSpread
        items={items}
        total={items.length}
        noun="heritages"
        heading={heritage ? `Your heritage: ${heritage.name}` : 'Choose one'}
        sections={[
          { key: 'own', tab: ancestry.name, name: `${ancestry.name} heritages` },
          { key: 'versatile', tab: 'Versatile', name: 'Versatile heritages' },
        ]}
        sectionOf={(h) => (h.ancestry ? 'own' : 'versatile')}
        short
        tabsOnTop
        open={open}
        onOpen={(h) => setOpenId(h.id)}
        marked={(h) => h.id === build.heritage}
        emptyText="No heritages in this campaign's books."
        meta={(h) => (
          <>
            {h.rarity !== 'common' && <span className="tag tag--rare">{h.rarity}</span>}
            {sourceTag(h.source)}
          </>
        )}
        leaf={open && (
          <HeritageLeaf
            key={open.id}
            h={open}
            ancestry={ancestry}
            data={data}
            chosen={open.id === build.heritage}
            skill={build.heritageSkill}
            onSkill={(s) => update({ heritageSkill: s })}
            onChoose={() => select(open.id)}
            onRemove={() => select(null)}
            onClose={() => setOpenId(null)}
          />
        )}
        blankIcon="heritage"
        blank={
          <>
            <p className="book__blank-title">Choose a heritage</p>
            <p className="rule-note">Open a heritage from the index to read it here.</p>
          </>
        }
      />
    </section>
  );
}

const ABILITY_KEYS = Object.keys(ABILITY_SHORT);
// A background's boost slots as short labels: "STR / INT", "Free".
const slotLabel = (slot) => (slot.length === 6 ? 'Free' : slot.map((a) => ABILITY_SHORT[a]).join(' / '));
// The attributes a background's limited boost offers (its other boost is free).
const limitedBoosts = (b) => b.boosts.filter((slot) => slot.length < 6).flat();

/** A background's Lore in words: "Legal Lore or Warfare Lore", "Terrain Lore (your choice)". */
const loreLabel = (entry) => {
  if (!entry) return null;
  const l = loreOptions(entry);
  return l.fixed ?? l.options?.join(' or ') ?? `${l.placeholder} (your choice)`;
};

/** A background as the right-hand page: what it grants, its full text, and the choose button. */
function BackgroundLeaf({ b, data, chosen, onChoose, onRemove, onClose }) {
  const feats = b.feats.map((id) => data.feats?.find((f) => f.id === id)?.name).filter(Boolean);
  return (
    <BookLeaf
      eyebrow={`${sourceTag(b.source)}${b.rarity !== 'common' ? ` · ${b.rarity}` : ''}`}
      title={b.name}
      facts={[
        ['Boosts', b.boosts.map(slotLabel).join(', ')],
        ['Trained in', b.skills.map(cap).join(', ')],
        ['Lore', loreLabel(b.lore[0])],
        ['Skill feat', feats.join(', ')],
      ]}
      description={b.description}
      onClose={onClose}
    >
      {chosen ? <ChosenActions label="Your background" onRemove={onRemove} /> : <button type="button" className="btn btn--blood" onClick={onChoose}>Choose {b.name}</button>}
    </BookLeaf>
  );
}

export function BackgroundStep({ build, update, data }) {
  const { background } = lookup(build, data);
  const lore = background?.lore[0] ? loreOptions(background.lore[0]) : null;
  // Filters: a name, attributes the limited boost must offer (up to 2), a skill it trains, a book.
  const [query, setQuery] = useState('');
  const [boosts, setBoosts] = useState([]);
  const [skill, setSkill] = useState('');
  const [book, setBook] = useState('');
  // The background open on the right page: the chosen one to start with, on wide screens.
  const [openId, setOpenId] = useState(() => (wide() ? build.background : null));
  const books = [...new Set(data.backgrounds.map((b) => b.source))];
  const skills = [...new Set(data.backgrounds.flatMap((b) => b.skills))].sort();
  const q = query.trim().toLowerCase();
  const filtering = Boolean(q) || boosts.length > 0 || skill || book;
  const shown = data.backgrounds
    .filter(
      (b) =>
        (!q || b.name.toLowerCase().includes(q)) &&
        boosts.every((a) => limitedBoosts(b).includes(a)) &&
        (!skill || b.skills.includes(skill)) &&
        (!book || b.source === book),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  // The chosen background stays in the index whatever the filters say.
  const items = background && !shown.includes(background) ? [...shown, background].sort((a, b) => a.name.localeCompare(b.name)) : shown;
  const open = data.backgrounds.find((b) => b.id === openId) ?? null;
  const clearFilters = () => {
    setQuery('');
    setBoosts([]);
    setSkill('');
    setBook('');
  };

  const select = (id) => {
    if (id === build.background) return;
    if (!id) return update({ background: null, backgroundBoosts: [], lore: '' });
    const bg = data.backgrounds.find((b) => b.id === id);
    const l = bg.lore[0] ? loreOptions(bg.lore[0]) : null;
    update({ background: id, backgroundBoosts: [], lore: l?.fixed ?? '' });
  };

  return (
    <>
      <section className="choice" aria-label="Background">
        <ChoiceHeading title="Background" chosen={background?.name} />
        <p className="rule-note">Your background gives two attribute boosts, training in a skill and a Lore, and a skill feat. Open one to read it, then choose it.</p>

        <div className="filters" role="group" aria-label="Filter backgrounds">
          <label className="filters__field filters__field--wide">
            <span className="filters__label">Name</span>
            <input className="options__search" type="search" value={query} placeholder="Search backgrounds" onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="filters__field filters__field--wide">
            <span className="filters__label" id="bg-boosts">Boosts</span>
            <Chips
              label="Backgrounds that can boost"
              options={ABILITY_KEYS}
              isOn={(a) => boosts.includes(a)}
              isDisabled={(a) => !boosts.includes(a) && boosts.length >= 2}
              onToggle={(a) => setBoosts((list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]))}
              render={(a) => ABILITY_SHORT[a]}
            />
          </div>
          <label className="filters__field">
            <span className="filters__label">Trains</span>
            <select value={skill} onChange={(e) => setSkill(e.target.value)}>
              <option value="">Any skill</option>
              {skills.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
            </select>
          </label>
          <label className="filters__field">
            <span className="filters__label">Book</span>
            <select value={book} onChange={(e) => setBook(e.target.value)}>
              <option value="">Any book</option>
              {books.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          {filtering && (
            <p className="filters__count">
              <button type="button" className="chip" onClick={clearFilters}>Clear filters</button>
            </p>
          )}
        </div>

        <BookSpread
          items={items}
          total={data.backgrounds.length}
          noun="backgrounds"
          sections={LETTER_SECTIONS}
          sectionOf={letterOf}
          open={open}
          onOpen={(b) => setOpenId(b.id)}
          marked={(b) => b.id === build.background}
          resetKey={`${q}|${boosts.join()}|${skill}|${book}`}
          filtered={filtering}
          emptyText="No backgrounds match these filters."
          meta={(b) => (
            <span className="bg-meta__boosts">
              <span className="visually-hidden">Boosts: </span>
              {b.boosts.map((slot, i) => (
                <span key={i} className={`ability-badge ${slot.length === 6 ? 'ability-badge--free' : ''}`}>{slotLabel(slot)}</span>
              ))}
            </span>
          )}
          leaf={open && <BackgroundLeaf b={open} data={data} chosen={open.id === build.background} onChoose={() => select(open.id)} onRemove={() => select(null)} onClose={() => setOpenId(null)} />}
          blankIcon="background"
          blank={
            <>
              <p className="book__blank-title">Choose a background</p>
              <p className="rule-note">Open a background from the index to read it here. Use the letter tabs to jump ahead, and the arrow keys to turn pages.</p>
            </>
          }
        />
      </section>

      {lore && !lore.fixed && (
        <section className="panel choice">
          <ChoiceHeading title="Your Lore skill" chosen={build.lore?.trim()} need={lore.options ? 'Choose one' : 'Name it'} />
          {lore.options ? (
            <Chips label="Lore" options={lore.options} isOn={(o) => build.lore === o} onToggle={pick(build.lore, (o) => update({ lore: o ?? '' }))} />
          ) : (
            <label className="form-field">
              <span>{lore.placeholder}</span>
              <input value={build.lore} placeholder={lore.placeholder} maxLength={40} onChange={(e) => update({ lore: e.target.value })} />
              <small className="italic muted">Name the subject, for example “Forest Lore”. Ask your GM if you're unsure.</small>
            </label>
          )}
        </section>
      )}
    </>
  );
}

export function ClassStep({ build, update, data }) {
  const { cls } = lookup(build, data);

  const select = (id) =>
    id !== build.class &&
    update({
      class: id,
      keyAbility: null,
      classSkill: null,
      classChoices: {},
      classChoiceSkills: {},
      tradition: null,
      deity: null,
      font: null,
      sanctification: null,
      classFeat: null,
      bonusFeats: {},
      cantrips: [],
      spells: [],
    });

  return (
    <>
      <Showcase
        kind="class"
        label="Classes"
        prompt="Choose your class"
        items={data.classes}
        selected={build.class}
        onSelect={select}
        stats={(c) => [
          ['HP per level', `${c.hp} + Con`],
          ['Key attribute', abilityList(c.keyAbility)],
          ['Perception', cap(c.perception)],
          ['Fort · Ref · Will', [c.saves.fortitude, c.saves.reflex, c.saves.will].map((r) => r[0].toUpperCase()).join(' · ')],
          ['Skills', `${c.trainedSkills.length + (c.skillChoice ? 1 : 0)} + ${c.additionalSkills} + Int`],
          ['Spellcasting', c.spellcasting ? 'Yes' : 'No'],
        ]}
      />
      {cls && <p className="rule-note">Next, Class Options: what the {cls.name.toLowerCase()} asks you to choose{cls.deity ? ', including your deity' : ''}.</p>}
    </>
  );
}
