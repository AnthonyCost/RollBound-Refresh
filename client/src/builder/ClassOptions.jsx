import { useEffect, useMemo, useRef, useState } from 'react';
import { lookup, keyAbilityOptions, keyAbilityOf, sanctificationOptions, TRADITIONS } from '@rollbound/rules';
import Ornament from '../components/Ornament.jsx';
import { artFor, iconFor } from './art.js';
import { cap } from './labels.js';

const ATTRIBUTE = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const sanctName = (o) => (o === 'none' ? 'Neither' : cap(o));

/**
 * Every choice the class asks for, as tabs: what's on each, and how to pick it. Options are
 * { id, name, facts: [..], description (HTML) or text }. read: a tab to read, with no choice.
 */
function tabsFor(build, data, update) {
  const { cls, deity } = lookup(build, data);
  if (!cls) return [];
  const keyOptions = keyAbilityOptions(build, data);
  const keyChosen = keyAbilityOf(build, data);
  const chooseOption = (key, id) =>
    update({
      classChoices: { ...build.classChoices, [key]: id },
      classChoiceSkills: { ...build.classChoiceSkills, [key]: null },
      tradition: null,
      keyAbility: null,
      cantrips: [],
      spells: [],
    });
  const tabs = [];

  if (cls.deity) {
    tabs.push({
      id: 'deity',
      title: 'Deity',
      intro: `Your deity trains you in their divine skill${cls.deityFavoredWeapon ? ' and favored weapon' : ''}${cls.divineFont ? ', and sets your divine font' : ''}. Their sanctification decides whether you can be holy or unholy.`,
      selected: build.deity,
      chosen: deity?.name,
      options: data.deities.map((d) => ({
        id: d.id,
        name: d.name,
        source: d.source,
        facts: [
          `Font: ${d.font.map(cap).join(' or ')}`,
          `Skill: ${d.skills.map(cap).join(', ')}`,
          `Weapon: ${d.weapons.map(cap).join(', ')}`,
          d.sanctification ? `${cap(d.sanctification.modal)} be ${d.sanctification.what.join(' or ')}` : 'No sanctification',
        ],
        description: d.description,
      })),
      onSelect: (id) => id !== build.deity && update({ deity: id, font: null, sanctification: null }),
    });
  }
  if (deity && cls.divineFont && deity.font.length > 1) {
    tabs.push({
      id: 'font',
      title: 'Divine Font',
      intro: `${deity.name} grants either font. Your divine font gives you extra spell slots each day, used only for that spell.`,
      selected: build.font,
      chosen: build.font && cap(build.font),
      options: deity.font.map((f) => ({ id: f, name: cap(f), facts: [`Extra slots for ${f}`], text: `Each day you get extra spell slots that can only cast the ${f} spell.` })),
      onSelect: (f) => update({ font: f }),
    });
  }
  if (deity && sanctificationOptions(deity).length > 1) {
    tabs.push({
      id: 'sanctification',
      title: 'Sanctification',
      intro: deity.sanctification ? `${deity.name} ${deity.sanctification.modal} be ${deity.sanctification.what.join(' or ')}. Choose where you stand.` : 'Choose where you stand.',
      selected: build.sanctification,
      chosen: build.sanctification && sanctName(build.sanctification),
      options: sanctificationOptions(deity).map((o) => ({
        id: o,
        name: sanctName(o),
        facts: [o === 'none' ? 'Unsanctified' : `Sanctified ${o}`],
        text: o === 'none' ? 'You stay unsanctified: neither holy nor unholy.' : `You're sanctified ${o}, as ${deity.name} allows.`,
      })),
      onSelect: (o) => update({ sanctification: o }),
    });
  }
  for (const f of cls.features.filter((x) => x.choice)) {
    const key = f.choice.key;
    const option = f.choice.options.find((o) => o.id === build.classChoices[key]);
    tabs.push({
      id: `path-${key}`,
      title: f.name,
      intro: `The path your ${cls.name.toLowerCase()} follows. It shapes your training and, for casters, your magic.`,
      selected: build.classChoices[key] ?? null,
      chosen: option?.name,
      options: f.choice.options.map((o) => ({
        id: o.id,
        name: o.name,
        source: o.source,
        facts: [
          o.skills.length > 0 && `Trained: ${o.skills.map(cap).join(', ')}`,
          o.tradition && !o.traditionChoice && `${cap(o.tradition)} spells`,
          o.tags.includes('holy') && 'Must be holy',
          o.tags.includes('unholy') && 'Must be unholy',
        ].filter(Boolean),
        description: o.description,
      })),
      onSelect: (id) => id !== build.classChoices[key] && chooseOption(key, id),
    });
    if (option?.skillChoice) {
      const skill = build.classChoiceSkills[key];
      tabs.push({
        id: `path-${key}-skill`,
        title: `${option.name} Skill`,
        sub: true,
        intro: `${option.name} trains you in one of these.`,
        selected: skill,
        chosen: skill && cap(skill),
        options: option.skillChoice.map((s) => ({ id: s, name: cap(s), facts: ['Trained'], text: `You become trained in ${cap(s)}.` })),
        onSelect: (s) => update({ classChoiceSkills: { ...build.classChoiceSkills, [key]: s } }),
      });
    }
    if (option?.traditionChoice) {
      tabs.push({
        id: `path-${key}-tradition`,
        title: `${option.name} Tradition`,
        sub: true,
        intro: 'Your tradition comes from the kind of creature in your bloodline. Pick the one that matches.',
        selected: build.tradition,
        chosen: build.tradition && cap(build.tradition),
        options: TRADITIONS.map((t) => ({ id: t, name: cap(t), facts: [`${cap(t)} spells`], text: `Your spells come from the ${t} tradition.` })),
        onSelect: (t) => update({ tradition: t, cantrips: [], spells: [] }),
      });
    }
  }
  if (cls.skillChoice) {
    tabs.push({
      id: 'skill',
      title: `${cls.name} Skill`,
      intro: `Every ${cls.name.toLowerCase()} is trained in one of these.`,
      selected: build.classSkill,
      chosen: build.classSkill && cap(build.classSkill),
      options: cls.skillChoice.map((s) => ({ id: s, name: cap(s), facts: ['Trained'], text: `You become trained in ${cap(s)}.` })),
      onSelect: (s) => update({ classSkill: s }),
    });
  }
  if (keyOptions.length > 1) {
    tabs.push({
      id: 'key',
      title: 'Key Attribute',
      intro: 'Your key attribute gets a boost and sets your class DC.',
      selected: keyChosen,
      chosen: keyChosen && ATTRIBUTE[keyChosen],
      options: keyOptions.map((a) => ({ id: a, name: ATTRIBUTE[a], facts: ['+1 boost', 'Sets class DC'], text: `${ATTRIBUTE[a]} gets a boost, and your class DC is built on it.` })),
      onSelect: (a) => update({ keyAbility: a }),
    });
  }
  const features = cls.features.filter((x) => !x.choice);
  if (features.length) {
    tabs.push({
      id: 'features',
      title: 'Features',
      read: true,
      intro: `Nothing to choose: every ${cls.name.toLowerCase()} gets these at 1st level.`,
      chosen: `${features.length} to read`,
      options: features.map((x) => ({ id: x.name, name: x.name, facts: ['1st level'], description: x.description })),
    });
  }
  return tabs;
}

/**
 * Class Options, as a game's character screen: the class's choices down the left, the
 * options for the one you're on in the middle, and the one you're looking at (hovered,
 * focused or chosen) large on the right over the class's art. Clicking an option chooses it.
 */
export function ClassOptionsStep({ build, update, data, goTo }) {
  const { cls } = lookup(build, data);
  const tabs = tabsFor(build, data, update);
  const choices = tabs.filter((t) => !t.read);
  const done = choices.filter((t) => t.chosen).length;
  const firstOpen = choices.find((t) => !t.chosen)?.id ?? tabs[0]?.id;
  const [active, setActive] = useState(firstOpen);
  const tab = tabs.find((t) => t.id === active) ?? tabs[0];
  // The option being looked at: hovered or focused in the list, else the chosen one, else the first.
  const [looking, setLooking] = useState(null);
  const [query, setQuery] = useState('');
  const listRef = useRef(null);
  useEffect(() => { setLooking(null); setQuery(''); }, [active]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => (tab && q ? tab.options.filter((o) => o.id === tab.selected || o.name.toLowerCase().includes(q)) : tab?.options ?? []), [tab, q]);

  if (!cls) {
    return (
      <div className="panel panel--dashed center">
        <p className="muted italic">Choose a class first; its options show up here.</p>
        <button type="button" className="btn" onClick={() => goTo('class')}>Back to Class</button>
      </div>
    );
  }

  if (!tab) return <p className="panel panel--dashed muted italic center">The {cls.name.toLowerCase()} has nothing to choose here.</p>;

  const option = tab.options.find((o) => o.id === looking) ?? tab.options.find((o) => o.id === tab.selected) ?? tab.options[0];
  const isChosen = option && option.id === tab.selected;
  const at = tabs.indexOf(tab);
  const next = choices.find((t, i) => !t.chosen && tabs.indexOf(t) > at) ?? choices.find((t) => !t.chosen) ?? (at < tabs.length - 1 ? tabs[at + 1] : null);
  const icon = iconFor('class', cls.slug);

  // Arrow keys move through the list (each row previews as it's focused).
  const onListKey = (e) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const rows = [...listRef.current.querySelectorAll('.co-option')];
    const i = rows.indexOf(document.activeElement);
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)));
    rows[to]?.focus();
    e.preventDefault();
  };
  const onTabKey = (e) => {
    const i = tabs.indexOf(tab);
    const to = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1 }[e.key];
    if (to == null) return;
    e.preventDefault();
    const t = tabs[(to + tabs.length) % tabs.length];
    setActive(t.id);
    document.getElementById(`co-tab-${t.id}`)?.focus();
  };

  return (
    <div className="co" onMouseLeave={() => setLooking(null)}>
      {/* The class and its choices, each with its pick. */}
      <aside className="co__rail" aria-label={`${cls.name} choices`}>
        <div className="co__class">
          {icon && <img className="co__class-icon" src={icon} alt="" />}
          <div>
            <p className="co__class-name">{cls.name}</p>
            <p className="co__class-count">
              <span className="co__pips" aria-hidden="true">
                {choices.map((t) => <span key={t.id} className={`co__pip ${t.chosen ? 'co__pip--on' : ''}`} />)}
              </span>
              {choices.length ? `${done} of ${choices.length} chosen` : 'Nothing to choose'}
            </p>
          </div>
        </div>
        <div className="co__tabs" role="tablist" aria-orientation="vertical" aria-label={`${cls.name} options`} onKeyDown={onTabKey}>
          {tabs.map((t) => (
            <button
              key={t.id}
              id={`co-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={t.id === tab.id}
              aria-controls="co-panel"
              tabIndex={t.id === tab.id ? 0 : -1}
              className={`co__tab ${t.sub ? 'co__tab--sub' : ''} ${t.read ? 'co__tab--read' : t.chosen ? 'co__tab--done' : ''}`}
              onClick={() => setActive(t.id)}
            >
              <span className="co__tab-mark" aria-hidden="true" />
              <span className="co__tab-title">{t.title}</span>
              <span className="co__tab-pick">{t.chosen ?? 'Choose one'}</span>
            </button>
          ))}
        </div>
      </aside>

      <div id="co-panel" className="co__body" role="tabpanel" aria-labelledby={`co-tab-${tab.id}`}>
        {/* The options for this choice. */}
        <div className="co__list-wrap">
          <p className="co__intro">{tab.intro}</p>
          {tab.options.length > 10 && (
            <input className="options__search co__search" type="search" placeholder={`Search ${tab.options.length} ${tab.title.toLowerCase()} options`} aria-label={`Search ${tab.title}`} value={query} onChange={(e) => setQuery(e.target.value)} />
          )}
          <ul className="co__list" ref={listRef} onKeyDown={onListKey} aria-label={tab.title}>
            {shown.map((o) => {
              const on = o.id === tab.selected;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    className={`co-option ${on ? 'co-option--on' : ''} ${o.id === option?.id ? 'co-option--looking' : ''}`}
                    aria-pressed={tab.read ? undefined : on}
                    onMouseEnter={() => setLooking(o.id)}
                    onFocus={() => setLooking(o.id)}
                    onClick={() => (tab.read ? setLooking(o.id) : tab.onSelect(o.id))}
                  >
                    <span className="co-option__gem" aria-hidden="true" />
                    <span className="co-option__name">{o.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {q && !shown.length && <p className="muted italic">No matches for “{query}”.</p>}
        </div>

        {/* The option being looked at, large, over the class's art. */}
        <article className="co__detail" aria-label={option ? `${tab.title}: ${option.name}` : tab.title}>
          <img className="co__art" src={artFor('class', cls.slug)} alt="" />
          {option && (
            <div className="co__detail-inner" key={`${tab.id}:${option.id}`}>
              <h2 className="co__detail-name">{option.name}</h2>
              {option.facts?.length > 0 && (
                <ul className="co__facts">
                  {option.facts.map((f) => <li key={f}>{f}</li>)}
                </ul>
              )}
              <div className="co__actions">
                {!tab.read && (isChosen ? (
                  <span className="co__chosen"><span aria-hidden="true">✓ </span>Your {tab.title.toLowerCase()}</span>
                ) : (
                  <button type="button" className="btn btn--blood" onClick={() => tab.onSelect(option.id)}>Choose {option.name}</button>
                ))}
                {next && (tab.read || isChosen) && (
                  <button type="button" className="btn" onClick={() => setActive(next.id)}>Next: {next.title}<span aria-hidden="true"> ›</span></button>
                )}
              </div>
              <Ornament />
              {option.description ? (
                <div className="co__desc option__desc" dangerouslySetInnerHTML={{ __html: option.description }} />
              ) : (
                <p className="co__desc">{option.text}</p>
              )}
              {option.source && <p className="co__source">{option.source}</p>}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
