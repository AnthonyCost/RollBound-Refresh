import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => JSON.parse(readFileSync(new URL(`../armory/${path}`, import.meta.url), 'utf8'));
const index = read('index.json');
const items = read('items.json');

describe('armory data', () => {
  it('lists every item once, under a category from the index', () => {
    assert.ok(items.length > 3000);
    assert.equal(items.length, index.count);
    assert.equal(new Set(items.map((i) => i.slug)).size, items.length);
    const names = new Set(index.categories.map((c) => c.name));
    assert.deepEqual(items.filter((i) => !names.has(i.category)).map((i) => i.name), []);
  });

  it('has rules text for every item in its category file', () => {
    for (const c of index.categories) {
      const details = read(`details/${c.file}`);
      const missing = items.filter((i) => i.details === c.file && !(i.id in details));
      assert.deepEqual(missing.map((i) => i.name), [], c.name);
    }
  });

  it('keeps Remaster items and leaves their legacy versions out', () => {
    const names = new Set(items.map((i) => i.name));
    assert.ok(names.has('Spacious Pouch') && !names.has('Bag of Holding'));
    assert.ok(names.has('Healing Potion') && names.has('Longsword') && names.has('Full Plate') && names.has('Steel Shield'));
  });

  it('carries weapon, armor and shield numbers', () => {
    const find = (n) => items.find((i) => i.name === n);
    assert.equal(find('Longsword').weapon.damage, '1d8 S');
    assert.equal(find('Full Plate').armor.ac, 6);
    assert.equal(find('Steel Shield').shield.hardness, 5);
    assert.equal(find('Club').price, 'Free');
    assert.equal(find('Healing Potion').variants.length, 5);
  });
});
