import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => JSON.parse(readFileSync(new URL(`../glossary/${path}`, import.meta.url)));
const entries = read('entries.json');
const index = read('index.json');
const details = Object.fromEntries(index.kinds.map((k) => [k.file, read(`details/${k.file}`)]));

describe('rules glossary', () => {
  it('has a unique address and text for every entry', () => {
    assert.equal(new Set(entries.map((e) => e.slug)).size, entries.length);
    assert.equal(entries.length, index.count);
    for (const e of entries) assert.ok(details[e.details][e.id], `${e.name} has no text`);
  });
  it('links only to entries that exist', () => {
    const slugs = new Set(entries.map((e) => e.slug));
    for (const byId of Object.values(details)) {
      for (const html of Object.values(byId)) for (const [, slug] of html.matchAll(/data-glossary="([^"]+)"/g)) assert.ok(slugs.has(slug), slug);
    }
  });
  it('finds Remaster entries by their old names, and gives actions the plain address', () => {
    const offGuard = entries.find((e) => e.slug === 'off-guard');
    assert.equal(offGuard.formerly, 'Flat-Footed');
    assert.equal(entries.find((e) => e.slug === 'grapple').kind, 'Action');
  });
});
