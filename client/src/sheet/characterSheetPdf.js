// Fills Paizo's fillable Remaster Player Core character sheet. Field names in
// that PDF are random, so sheetFields.json (built by scripts/map-sheet-fields.mjs)
// maps readable keys like "skill.arcana.total" to them. The result stays a
// fillable form, so players can keep editing it in any PDF reader.
// Works in the browser and in Node: takes the template's bytes, returns new bytes.
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  SKILL_ABILITY,
  armorClass,
  classDc,
  damageModifier,
  landSpeed,
  maxHp,
  perception,
  savingThrow,
  skillCheck,
  spellAttack,
  spellDc,
  strikeBonus,
} from '@rollbound/rules';
import FIELDS from './sheetFields.json' with { type: 'json' };

const RANK_LETTERS = { trained: ['T'], expert: ['T', 'E'], master: ['T', 'E', 'M'], legendary: ['T', 'E', 'M', 'L'] };
const SIZE = { tiny: 'T', sm: 'S', med: 'M', lg: 'L' };
const ABILITY_LABEL = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };
const DAMAGE_TYPE = { bludgeoning: 'B', piercing: 'P', slashing: 'S' };

const signed = (n) => (n >= 0 ? `+${n}` : `-${Math.abs(n)}`);
const cap = (s) => s.replace(/(^|[\s-])(\w)/g, (_m, sep, c) => `${sep === '-' ? ' ' : sep}${c.toUpperCase()}`);
const profPart = (stat) => stat.parts.find((p) => p.label.startsWith('Proficiency'))?.value ?? 0;
const vision = (c) => (c.ancestry.vision && c.ancestry.vision !== 'normal' ? cap(c.ancestry.vision.replace(/-vision$/, ' vision')) : null);
/** Short action costs that fit the sheet's narrow columns: 2, 1-3, R, F, 10m. */
const actionText = (a) =>
  String(a ?? '')
    .replace(/^reaction$/, 'R')
    .replace(/^free$/, 'F')
    .replace(/ to /, '-')
    .replace(/^(\d+) minutes?$/, '$1m')
    .replace(/^(\d+) hours?$/, '$1h');

const daFontSize = (field) => Number(/([\d.]+)\s+Tf/.exec(field.acroField.getDefaultAppearance() ?? '')?.[1] ?? 0);

/**
 * Paizo's sheet marks one-line boxes (name, ancestry, level...) as multi-line.
 * Viewers lay those out with line spacing and padding, decide the text overflows,
 * and hide it behind a "+" marker. Boxes too short for two lines become single-line.
 */
function singleLineIfShort(field) {
  if (!field.isMultiline()) return;
  const { height } = field.acroField.getWidgets()[0].getRectangle();
  const size = daFontSize(field) || 9;
  if (height < size * 2 + 6) field.disableMultiline();
}

function formWriter(form, font) {
  // The standard PDF fonts only cover Windows-1252; swap anything else.
  const clean = (text) =>
    [...String(text).replace(/−/g, '-').replace(/[‐-‒]/g, '-')]
      .map((ch) => {
        if (ch === '\n') return ch;
        try {
          font.encodeText(ch);
          return ch;
        } catch {
          return '?';
        }
      })
      .join('');

  const names = (key) => {
    const n = FIELDS[key];
    if (!n) throw new Error(`Unknown sheet field: ${key}`);
    return [n].flat();
  };

  return {
    set(key, value, fontSize) {
      if (value == null || value === '') return;
      for (const n of names(key)) {
        const field = form.getTextField(n);
        if (fontSize) field.setFontSize(fontSize);
        singleLineIfShort(field);
        field.setText(clean(value));
      }
    },
    check(key) {
      for (const n of names(key)) form.getCheckBox(n).check();
    },
    rank(prefix, rank) {
      for (const letter of RANK_LETTERS[rank] ?? []) this.check(`${prefix}.${letter}`);
    },
  };
}

function fillStatistics(w, c, { playerName }) {
  const base = { conditions: [] };

  w.set('name', c.name);
  w.set('playerName', playerName);
  w.set('level', c.level);
  for (let i = 1; i <= Math.min(3, c.heroPoints ?? 0); i++) w.check(`heroPoint.${i}`);

  w.set('ancestry', c.ancestry.name);
  w.set('heritage', [c.heritage, c.deity?.sanctification && c.deity.sanctification !== 'none' ? cap(c.deity.sanctification) : null].filter(Boolean).join(' · '));
  w.set('size', SIZE[c.ancestry.size] ?? 'M');
  w.set('background', c.background);
  w.set('backgroundNotes', (c.lores ?? []).join(', '));
  w.set('class', c.className);
  const subclass = (c.classFeatures ?? []).filter((f) => f.choice).map((f) => f.choice);
  w.set('classNotes', [c.keyAbility && `Key ${ABILITY_LABEL[c.keyAbility]}`, ...subclass].filter(Boolean).join(' · '));
  for (const a of Object.keys(ABILITY_LABEL)) w.set(`attr.${a}`, signed(c.abilities[a]));

  const ac = armorClass(c, base);
  w.set('ac.total', ac.total);
  w.set('ac.dex', signed(ac.parts.find((p) => p.label === 'Dexterity')?.value ?? 0));
  w.set('ac.prof', signed(profPart(ac)));
  if (c.armor) w.set('ac.item', signed(c.armor.acBonus));
  for (const k of ['unarmored', 'light', 'medium', 'heavy']) w.rank(`armorRank.${k}`, c.proficiencies.armor?.[k]);
  if (c.shield) {
    w.set('shield.bonus', `+${c.shield.acBonus}`);
    w.set('shield.hardness', c.shield.hardness);
    w.set('shield.maxHp', c.shield.hp);
    if (c.shield.hp) w.set('shield.bt', Math.floor(c.shield.hp / 2));
    w.set('shield.hp', c.shield.hp);
  }

  for (const save of ['fortitude', 'reflex', 'will']) {
    const s = savingThrow(c, save, base);
    w.set(`save.${save}.total`, signed(s.total));
    w.set(`save.${save}.attr`, signed(s.parts[0].value));
    w.set(`save.${save}.prof`, signed(profPart(s)));
    w.rank(`save.${save}.rank`, c.proficiencies[save]);
  }

  const hp = maxHp(c);
  w.set('hp.max', hp);
  w.set('hp.current', hp);

  const per = perception(c, base);
  w.set('perception.total', signed(per.total));
  w.set('perception.attr', signed(per.parts[0].value));
  w.set('perception.prof', signed(profPart(per)));
  w.rank('perception.rank', c.proficiencies.perception);
  w.set('senses', vision(c));
  w.set('speed', landSpeed(c).total);
  w.set('languages', (c.languages ?? []).map(cap).join('\n'));

  const ranks = c.skills ?? {};
  const fillSkill = (key, skill, rank) => {
    const s = skillCheck(c, skill, base);
    w.set(`skill.${key}.total`, signed(s.total));
    w.set(`skill.${key}.attr`, signed(s.parts[0].value));
    w.set(`skill.${key}.prof`, signed(profPart(s)));
    const armor = s.parts.find((p) => p.label.endsWith('check penalty'));
    if (armor && FIELDS[`skill.${key}.armor`]) w.set(`skill.${key}.armor`, armor.value);
    w.rank(`skill.${key}.rank`, rank);
  };
  for (const skill of Object.keys(SKILL_ABILITY)) fillSkill(skill, skill, ranks[skill]);
  (c.lores ?? []).slice(0, 2).forEach((lore, i) => {
    w.set(`skill.lore${i + 1}.name`, lore.replace(/\s*Lore$/i, ''));
    fillSkill(`lore${i + 1}`, lore, 'trained');
  });

  const weapons = c.weapons ?? [];
  const strikes = [
    ...weapons.filter((wp) => !wp.ranged).slice(0, 3).map((wp, i) => [`melee${i + 1}`, wp]),
    ...weapons.filter((wp) => wp.ranged).slice(0, 2).map((wp, i) => [`ranged${i + 1}`, wp]),
  ];
  for (const [key, wp] of strikes) {
    const atk = strikeBonus(c, wp, base);
    const dmg = damageModifier(wp, c.abilities);
    w.set(`strike.${key}.name`, wp.name);
    w.set(`strike.${key}.attack`, signed(atk.total));
    w.set(`strike.${key}.attr`, signed(atk.parts[0].value));
    w.set(`strike.${key}.prof`, signed(profPart(atk)));
    w.set(`strike.${key}.damage`, `1d${wp.die}${dmg ? signed(dmg) : ''} ${wp.damageType}`);
    if (DAMAGE_TYPE[wp.damageType]) w.check(`strike.${key}.${DAMAGE_TYPE[wp.damageType]}`);
    w.set(`strike.${key}.traits`, [wp.traits?.map(cap).join(', '), wp.range && `Range ${wp.range} ft`].filter(Boolean).join(' · '));
  }
  for (const k of ['unarmed', 'simple', 'martial', 'advanced']) w.rank(`weaponRank.${k}`, c.proficiencies.weapons?.[k]);
  if (c.proficiencies.favoredWeapons?.length) {
    w.rank('weaponRank.other', 'trained');
    w.set('weaponOther', `${c.proficiencies.favoredWeapons.map(cap).join(', ')} (favored weapon)`);
  }

  if (c.keyAbility) {
    const dc = classDc(c);
    w.set('classDc.total', dc.total);
    w.set('classDc.key', signed(dc.parts[1].value));
    w.set('classDc.prof', signed(profPart(dc)));
  }
}

function fillAbilities(w, c) {
  const feats = c.feats ?? [];
  const isBackground = (f) => f.kind === 'granted' && f.from === c.background;
  const isAncestry = (f) => f.from === 'Ancestry feat' || (f.kind === 'bonus' && f.category === 'ancestry');

  w.set('ancestryAbilities', [c.heritage, vision(c)].filter(Boolean).join(', '));
  w.set('ancestryFeat1', feats.filter(isAncestry).map((f) => f.name).join(', '));
  w.set('backgroundSkillFeat', feats.filter(isBackground).map((f) => f.name).join(', '));
  w.set(
    'classFeats1',
    [
      ...(c.classFeatures ?? []).map((f) => (f.choice ? `${f.name}: ${f.choice}` : f.name)),
      // The sheet has no box for a runesmith's runes; they're part of the class.
      ...(c.runes?.length ? [`Runic repertoire: ${c.runes.map((r) => r.name.split(',')[0]).join(', ')}`] : []),
      ...feats.filter((f) => f.from === 'Class feat').map((f) => `${f.name} (class feat)`),
      ...feats.filter((f) => !isAncestry(f) && !isBackground(f) && f.from !== 'Class feat').map((f) => `${f.name} (from ${f.from})`),
    ].join('\n'),
    8,
  );

  const held = [...(c.weapons ?? []).filter((wp) => wp.name !== 'Fist').map((wp) => wp.name), c.shield?.name].filter(Boolean);
  w.set('heldItems', held.join('\n'), 9);
  if (c.armor) w.set('wornItems', c.armor.name, 9);
}

async function fillNotes(doc, form, w, c, { campaignName, portrait }) {
  if (c.deity) w.set('deity', c.deity.name);
  if (campaignName) w.set('campaignNotes', `Campaign: ${campaignName}`, 9);
  if (!portrait) return;

  // Draw the portrait into the Character Sketch box. That box is also a text
  // field, so remove the field to keep it from covering the image.
  const sketch = form.getTextField(FIELDS.sketch);
  const box = sketch.acroField.getWidgets()[0].getRectangle();
  form.removeField(sketch);
  const img = portrait.type === 'png' ? await doc.embedPng(portrait.bytes) : await doc.embedJpg(portrait.bytes);
  const scale = Math.min(box.width / img.width, box.height / img.height);
  const width = img.width * scale;
  const height = img.height * scale;
  doc.getPages()[2].drawImage(img, { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height });
}

function fillSpells(w, c) {
  const casting = c.spellcasting;
  if (!casting || casting.kind === 'focus') return;
  if (FIELDS[`tradition.${casting.tradition}`]) w.check(`tradition.${casting.tradition}`);
  w.check(casting.kind === 'repertoire' ? 'caster.spontaneous' : 'caster.prepared');
  w.set('spellsPerDay.1', casting.slots);

  const atk = spellAttack(c);
  const dc = spellDc(c);
  w.set('spellAttack.total', signed(atk.total));
  w.set('spellAttack.key', signed(atk.parts[0].value));
  w.set('spellAttack.prof', signed(profPart(atk)));
  w.rank('spellAttack.rank', c.proficiencies.spellcasting);
  w.set('spellDc.total', dc.total);
  w.set('spellDc.key', signed(dc.parts[1].value));
  w.set('spellDc.prof', signed(profPart(dc)));
  w.rank('spellDc.rank', c.proficiencies.spellcasting);

  w.set('cantripsPerDay', casting.prepares?.cantrips ?? casting.cantrips.length);
  w.set('cantripRank', Math.ceil(c.level / 2));
  // List columns are separate multi-line fields; one font size keeps their lines aligned.
  w.set('cantrips.names', casting.cantrips.map((s) => s.name).join('\n'), 8);
  w.set('cantrips.actions', casting.cantrips.map((s) => actionText(s.actions)).join('\n'), 8);
  // The spell list has no separate Actions field, so the cost follows the name.
  w.set('spells.names', casting.spells.map((s) => `${s.name}  [${actionText(s.actions)}]`).join('\n'), 8);
  w.set('spells.rank', casting.spells.map((s) => s.rank).join('\n'), 8);
}

/**
 * Returns the filled sheet as PDF bytes.
 * options.portrait: { bytes, type: 'png' | 'jpg' } for the Character Sketch box.
 */
export async function fillCharacterSheet(templateBytes, character, { playerName, campaignName, portrait } = {}) {
  // Don't yield to the event loop while parsing or saving: if the user switches to the
  // tab the sheet opens in, this tab is in the background and browsers throttle its
  // timers, so pdf-lib's default pauses (one per 50 objects) could take minutes.
  const doc = await PDFDocument.load(templateBytes, { parseSpeed: Infinity });
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const w = formWriter(form, font);

  fillStatistics(w, character, { playerName });
  fillAbilities(w, character);
  await fillNotes(doc, form, w, character, { campaignName, portrait });
  fillSpells(w, character);

  form.updateFieldAppearances(font);
  // Shown as the browser tab's title when the sheet opens in a viewer.
  doc.setTitle(`${character.name} · Pathfinder character sheet`, { showInWindowTitleBar: true });
  doc.setCreator('RollBound');
  return doc.save({ objectsPerTick: Infinity });
}
