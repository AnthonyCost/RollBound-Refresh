import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rateEncounter } from '../src/index.js';

const read = (f) => JSON.parse(readFileSync(new URL(`../bestiary/${f}`, import.meta.url)));
const index = read('index.json');
const books = Object.fromEntries(index.books.map((b) => [b.book, read(b.file)]));
const all = Object.values(books).flat();

describe('bestiary', () => {
  it('has every creature in Monster Core and Monster Core 2', () => {
    assert.deepEqual(index.books.map((b) => b.book), ['Monster Core', 'Monster Core 2']);
    for (const b of index.books) assert.equal(books[b.book].length, b.count);
    assert.ok(books['Monster Core'].length >= 440 && books['Monster Core 2'].length >= 390);
  });

  it('gives every creature its numbers and a stat block', () => {
    for (const c of all) {
      assert.ok(Number.isInteger(c.level) && c.level >= -1 && c.level <= 25, c.name);
      assert.ok(Number.isInteger(c.hp) && Number.isInteger(c.ac) && Number.isInteger(c.perception), `${c.name} has HP, AC and Perception`);
      for (const s of ['fortitude', 'reflex', 'will']) assert.ok(Number.isInteger(c.saves[s]), `${c.name} ${s}`);
      assert.ok(['common', 'uncommon', 'rare', 'unique'].includes(c.rarity), c.name);
      assert.ok(c.statBlock.includes('<strong>AC</strong>'), `${c.name} stat block shows AC`);
    }
  });

  it('leaves no markdown or links in the stat blocks', () => {
    const leftovers = all.filter((c) => /\*\*|\]\(\/|<actions|<title|<row|<column/.test(c.statBlock + c.description));
    assert.deepEqual(leftovers.map((c) => c.name), []);
  });

  it('gives each creature a unique id and, within its book, a unique slug', () => {
    assert.equal(new Set(all.map((c) => c.id)).size, all.length);
    for (const list of Object.values(books)) assert.equal(new Set(list.map((c) => c.slug)).size, list.length);
  });

  it('works with the encounter math', () => {
    const wolf = books['Monster Core'].find((c) => c.name === 'Wolf');
    assert.equal(wolf.level, 1);
    assert.equal(rateEncounter([{ level: wolf.level, count: 2 }], 1, 4).xp, 80);
  });
});
