// Builds client/src/sheet/sheetFields.json: readable names for the form fields in
// Paizo's fillable Remaster character sheet, whose own field names are random
// (e.g. "textarea_1mgbu"). Fields are identified by position, so re-run this if
// the PDF changes:
//   node client/scripts/map-sheet-fields.mjs client/public/sheets/pf2e-remaster-character-sheet.pdf
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';

const input = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sheets', 'pf2e-remaster-character-sheet.pdf');
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'sheet', 'sheetFields.json');

const doc = await PDFDocument.load(readFileSync(input));
const pageOf = new Map();
doc.getPages().forEach((p, i) => {
  const annots = p.node.Annots();
  for (let j = 0; annots && j < annots.size(); j++) pageOf.set(annots.get(j).toString(), i + 1);
});
const fields = doc.getForm().getFields().map((f) => {
  const w = f.acroField.getWidgets()[0];
  const r = w.getRectangle();
  return {
    name: f.getName(),
    type: f.constructor.name === 'PDFCheckBox' ? 'C' : 'T',
    page: pageOf.get(doc.context.getObjectRef(w.dict)?.toString()),
    x: r.x,
    y: r.y,
    w: r.width,
  };
});

const map = {};
const used = new Set();

/** The single field of this type on this page whose origin is within tol of (x, y). */
function at(key, page, type, x, y, tol = 3) {
  const hits = fields.filter((f) => f.page === page && f.type === type && Math.abs(f.x - x) <= tol && Math.abs(f.y - y) <= tol);
  if (hits.length !== 1) throw new Error(`${key}: expected 1 field near (${x}, ${y}) on page ${page}, found ${hits.length}`);
  if (used.has(hits[0].name)) throw new Error(`${key}: ${hits[0].name} is already mapped`);
  used.add(hits[0].name);
  map[key] = hits[0].name;
}

/** Fields in a box, sorted top-to-bottom (checkbox columns) or left-to-right. */
function within(page, type, { x0, x1, y0, y1 }, sort) {
  return fields
    .filter((f) => f.page === page && f.type === type && f.x >= x0 && f.x <= x1 && f.y >= y0 && f.y <= y1 && !used.has(f.name))
    .sort(sort === 'x' ? (a, b) => a.x - b.x : (a, b) => b.y - a.y);
}

function assign(keys, found, label) {
  // The PDF has a few checkboxes stacked on top of each other (e.g. Deception's
  // "T"). Treat ones within 2.5pt as a single position mapped to every copy.
  const groups = [];
  for (const f of found) {
    const same = groups.find((g) => Math.abs(g[0].x - f.x) < 2.5 && Math.abs(g[0].y - f.y) < 2.5 && g[0].type === f.type);
    if (same) same.push(f);
    else groups.push([f]);
  }
  if (groups.length !== keys.length) throw new Error(`${label}: expected ${keys.length} fields, found ${groups.length}`);
  groups.forEach((g, i) => {
    g.forEach((f) => used.add(f.name));
    map[keys[i]] = g.length === 1 ? g[0].name : g.map((f) => f.name);
  });
}

const RANKS = ['T', 'E', 'M', 'L'];
const rankKeys = (prefix) => RANKS.map((r) => `${prefix}.${r}`);

// ---------- Page 1 ----------
at('name', 1, 'T', 218, 730);
at('playerName', 1, 'T', 262, 712);
at('level', 1, 'T', 414, 724);
at('xp', 1, 'T', 447, 725);
assign(['heroPoint.1', 'heroPoint.2', 'heroPoint.3'], within(1, 'C', { x0: 500, x1: 560, y0: 735, y1: 745 }, 'x'), 'hero points');
at('ancestry', 1, 'T', 30, 682);
at('background', 1, 'T', 218, 682);
at('class', 1, 'T', 406, 682);
at('heritage', 1, 'T', 28, 655);
at('size', 1, 'T', 183, 654);
at('backgroundNotes', 1, 'T', 217, 655);
at('classNotes', 1, 'T', 406, 655);
[['str', 31, 619], ['dex', 125, 620], ['con', 219, 619], ['int', 313, 619], ['wis', 407, 620], ['cha', 502, 619]].forEach(([a, x, y]) => at(`attr.${a}`, 1, 'T', x, y));

at('ac.total', 1, 'T', 53, 555);
assign(['ac.dex', 'ac.prof', 'ac.item'], within(1, 'T', { x0: 45, x1: 90, y0: 530, y1: 536 }, 'x'), 'AC breakdown');
at('shield.bonus', 1, 'T', 104, 568);
assign(['shield.hardness', 'shield.maxHp', 'shield.bt', 'shield.hp'], within(1, 'T', { x0: 125, x1: 200, y0: 568, y1: 573 }, 'x'), 'shield');
[['unarmored', 127], ['light', 152], ['medium', 171.5], ['heavy', 193.5]].forEach(([k, x]) =>
  assign(rankKeys(`armorRank.${k}`), within(1, 'C', { x0: x - 2, x1: x + 2, y0: 518, y1: 545 }), `armor ${k}`),
);

[['fortitude', 222, 217, 263], ['reflex', 285, 280, 326], ['will', 348, 342, 388]].forEach(([save, totalX, firstX, rankX]) => {
  at(`save.${save}.total`, 1, 'T', totalX, 568.5, 2);
  assign([`save.${save}.attr`, `save.${save}.prof`, `save.${save}.item`], within(1, 'T', { x0: firstX - 2, x1: firstX + 40, y0: 550, y1: 556 }, 'x'), `${save} breakdown`);
  assign(rankKeys(`save.${save}.rank`), within(1, 'C', { x0: rankX - 1, x1: rankX + 1, y0: 565, y1: 585 }), `${save} rank`);
});

at('hp.max', 1, 'T', 410, 568);
at('hp.current', 1, 'T', 445, 559);
at('hp.temp', 1, 'T', 535, 582);
at('hp.wounded', 1, 'T', 567, 558);
at('resistances', 1, 'T', 406, 535);
at('defensesNotes', 1, 'T', 219, 514);
at('conditions', 1, 'T', 406, 513);

at('perception.total', 1, 'T', 407, 477);
assign(['perception.attr', 'perception.prof', 'perception.item'], within(1, 'T', { x0: 435, x1: 476, y0: 477, y1: 481 }, 'x'), 'perception breakdown');
assign(rankKeys('perception.rank'), within(1, 'C', { x0: 422, x1: 426, y0: 472, y1: 492 }), 'perception rank');
at('speed', 1, 'T', 500, 477);
at('languages', 1, 'T', 313, 427);
at('senses', 1, 'T', 406, 425);
at('specialMovement', 1, 'T', 500, 425);
at('skillNotes', 1, 'T', 235, 31);

const SKILL_ROWS = [
  ['acrobatics', 485], ['arcana', 458], ['athletics', 432], ['crafting', 404], ['deception', 378], ['diplomacy', 351],
  ['intimidation', 324], ['lore1', 298], ['lore2', 272], ['medicine', 246], ['nature', 220], ['occultism', 192],
  ['performance', 165], ['religion', 139], ['society', 113], ['stealth', 86], ['survival', 59], ['thievery', 33],
];
for (const [skill, y] of SKILL_ROWS) {
  at(`skill.${skill}.total`, 1, 'T', 98.5, y, 2.5);
  const parts = within(1, 'T', { x0: 145, x1: 212, y0: y - 1, y1: y + 5 }, 'x');
  assign([`skill.${skill}.attr`, `skill.${skill}.prof`, `skill.${skill}.item`, `skill.${skill}.armor`].slice(0, parts.length), parts, `${skill} breakdown`);
  assign(rankKeys(`skill.${skill}.rank`), within(1, 'C', { x0: 130, x1: 135, y0: y - 8, y1: y + 13 }), `${skill} rank`);
}
at('skill.lore1.name', 1, 'T', 27, 300);
at('skill.lore2.name', 1, 'T', 26, 274);

const STRIKES = [['melee1', 367], ['melee2', 317], ['melee3', 268], ['ranged1', 205], ['ranged2', 155]];
for (const [strike, y] of STRIKES) {
  at(`strike.${strike}.name`, 1, 'T', 312.5, y, 1.5);
  at(`strike.${strike}.attack`, 1, 'T', 407, y + 4, 2);
  assign([`strike.${strike}.attr`, `strike.${strike}.prof`, `strike.${strike}.item`], within(1, 'T', { x0: 434, x1: 477, y0: y + 2, y1: y + 7 }, 'x'), `${strike} breakdown`);
  at(`strike.${strike}.damage`, 1, 'T', 499.5, y + 2, 2);
  assign([`strike.${strike}.B`, `strike.${strike}.P`, `strike.${strike}.S`], within(1, 'C', { x0: 574, x1: 578, y0: y - 2, y1: y + 14 }), `${strike} damage type`);
  at(`strike.${strike}.traits`, 1, 'T', 367.5, y - 17, 2);
}
[['unarmed', 313.5], ['simple', 336], ['martial', 359.5], ['advanced', 380.5], ['other', 402]].forEach(([k, x]) =>
  assign(rankKeys(`weaponRank.${k}`), within(1, 'C', { x0: x - 1.5, x1: x + 1.5, y0: 90, y1: 116 }), `weapon ${k}`),
);
at('weaponOther', 1, 'T', 420, 94);
at('criticalSpecializations', 1, 'T', 498, 93);
at('classDc.total', 1, 'T', 322, 55);
assign(['classDc.key', 'classDc.prof', 'classDc.item'], within(1, 'T', { x0: 334, x1: 375, y0: 33, y1: 37 }, 'x'), 'class DC breakdown');

// ---------- Page 2 ----------
at('ancestryAbilities', 2, 'T', 49, 716);
at('ancestryFeat1', 2, 'T', 48, 681);
at('backgroundSkillFeat', 2, 'T', 48, 630);
at('classFeats1', 2, 'T', 216, 628);
at('heldItems', 2, 'T', 407, 604);
at('heldBulk', 2, 'T', 563, 603);
at('consumables', 2, 'T', 407, 443);
at('consumablesBulk', 2, 'T', 562, 443);
at('wornItems', 2, 'T', 408, 215);
at('wornInvested', 2, 'T', 528, 215);
at('wornBulk', 2, 'T', 562, 215);
at('bulk', 2, 'T', 415, 156);
[['cp', 417], ['sp', 461], ['gp', 504], ['pp', 548]].forEach(([k, x]) => at(`wealth.${k}`, 2, 'T', x, 101));
const levelRows = [596, 564, 533, 502, 470, 439, 408, 377, 345, 313, 282, 251, 219, 186, 156, 124, 91, 59, 28];
levelRows.forEach((y, i) => {
  at(`level${i + 2}.left`, 2, 'T', 47, y, 2.5);
  at(`level${i + 2}.right`, 2, 'T', 216, y, 2.5);
});

// ---------- Page 3 ----------
[['ethnicity', 218, 729], ['nationality', 282, 728], ['birthplace', 348, 728], ['age', 411, 728], ['gender', 439, 728], ['height', 511, 728], ['weight', 549, 729]].forEach(([k, x, y]) => at(k, 3, 'T', x, y));
at('appearance', 3, 'T', 261, 696);
at('attitude', 3, 'T', 248, 654);
at('deity', 3, 'T', 406, 654);
at('edicts', 3, 'T', 220, 580);
at('anathema', 3, 'T', 405, 580);
at('likes', 3, 'T', 244, 549);
at('dislikes', 3, 'T', 245, 518);
at('catchphrases', 3, 'T', 267, 487);
at('sketch', 3, 'T', 30, 489);
at('campaignNotes', 3, 'T', 51, 369);
at('allies', 3, 'T', 332, 440);
at('enemies', 3, 'T', 343, 404);
at('organizations', 3, 'T', 360, 367);

// ---------- Page 4 ----------
at('tradition.arcane', 4, 'C', 60, 740);
at('tradition.occult', 4, 'C', 75, 740);
at('tradition.primal', 4, 'C', 60, 726);
at('tradition.divine', 4, 'C', 75, 726);
at('caster.prepared', 4, 'C', 129, 740);
at('caster.spontaneous', 4, 'C', 128, 728);
assign([...Array(10).keys()].map((i) => `spellsPerDay.${i + 1}`), within(4, 'T', { x0: 275, x1: 585, y0: 732, y1: 737 }, 'x'), 'spells per day');
assign([...Array(10).keys()].map((i) => `spellsRemaining.${i + 1}`), within(4, 'T', { x0: 275, x1: 585, y0: 700, y1: 705 }, 'x'), 'spells remaining');
at('spellAttack.total', 4, 'T', 31, 676);
at('spellAttack.key', 4, 'T', 71, 680);
at('spellAttack.prof', 4, 'T', 90, 681);
assign(rankKeys('spellAttack.rank'), within(4, 'C', { x0: 54, x1: 59, y0: 666, y1: 690 }), 'spell attack rank');
at('spellDc.total', 4, 'T', 117, 675);
at('spellDc.key', 4, 'T', 174, 680);
at('spellDc.prof', 4, 'T', 193, 680);
assign(rankKeys('spellDc.rank'), within(4, 'C', { x0: 139, x1: 143, y0: 668, y1: 690 }), 'spell DC rank');
at('cantripsPerDay', 4, 'T', 92, 632);
at('cantripRank', 4, 'T', 186, 632);
at('cantrips.names', 4, 'T', 31, 341);
at('cantrips.actions', 4, 'T', 163, 341);
at('cantrips.prep', 4, 'T', 192, 340);
assign(['focusPoint.1', 'focusPoint.2', 'focusPoint.3'], within(4, 'C', { x0: 78, x1: 108, y0: 307, y1: 314 }, 'x'), 'focus points');
at('focusSpellRank', 4, 'T', 186, 308);
at('focusSpells.names', 4, 'T', 30, 144);
at('focusSpells.actions', 4, 'T', 181, 144);
at('innate.names', 4, 'T', 30, 29);
at('innate.actions', 4, 'T', 151, 29);
at('innate.freq', 4, 'T', 186, 29);
// Each spell column's name field also spans the printed "Actions" heading;
// the two narrow fields beside it are Rank and Prep.
at('spells.names', 4, 'T', 219, 114);
at('spells.rank', 4, 'T', 354, 113);
at('spells.prep', 4, 'T', 378, 114);
at('spells2.names', 4, 'T', 408, 112);
at('spells2.rank', 4, 'T', 543, 113);
at('spells2.prep', 4, 'T', 567, 113);

writeFileSync(OUT, `${JSON.stringify(map, null, 1)}\n`);
console.log(`Mapped ${Object.keys(map).length} of ${fields.length} fields -> ${OUT}`);
const unmapped = fields.filter((f) => !used.has(f.name));
if (unmapped.length) console.log('Unmapped:', unmapped.map((f) => `p${f.page} ${f.type} (${Math.round(f.x)},${Math.round(f.y)})`).join('  '));
