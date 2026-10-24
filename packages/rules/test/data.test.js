import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { DATA_TYPES, EARLY_TYPES, assembleData, dataFiles, splitData } from '../src/data.js';
import { loadRulesData } from '../src/load.js';
import * as R from '../src/index.js';

const DATA_DIR = new URL('../data/', import.meta.url);
const index = JSON.parse(readFileSync(new URL('index.json', DATA_DIR)));
const data = loadRulesData();

// Every .json file under data/, as paths like "player-core/feats.json".
const onDisk = (dir = DATA_DIR, prefix = '') =>
  readdirSync(dir).flatMap((name) => {
    const url = new URL(name, dir);
    return statSync(url).isDirectory() ? onDisk(new URL(`${name}/`, dir), `${prefix}${name}/`) : [`${prefix}${name}`];
  });

// When the rules data outgrows this, it's time to move it into Postgres and serve
// it from the API (scalability roadmap, step 4) instead of shipping files.
const SIZE_BUDGET = 5 * 1024 * 1024;

describe('rules data files', () => {
  it('lists exactly the files on disk, with the right counts', () => {
    assert.deepEqual(onDisk().filter((p) => p !== 'index.json').sort(), index.files.map((f) => f.path).sort());
    for (const f of index.files) {
      const items = JSON.parse(readFileSync(new URL(f.path, DATA_DIR)));
      assert.equal(items.length, f.count, f.path);
      assert.ok(DATA_TYPES.includes(f.type), `${f.path} has a known type`);
      for (const item of items) if (typeof item === 'object') assert.equal(item.source, f.book, `${item.name} is filed under its own book`);
    }
  });

  it('splits and reassembles without changing anything', () => {
    const again = splitData(data);
    assert.deepEqual(again.index, index);
    assert.deepEqual(assembleData(again.index, again.files), data);
  });

  it('loads only the types or books asked for', () => {
    const early = loadRulesData({ types: EARLY_TYPES });
    assert.deepEqual(Object.keys(early).filter((k) => k !== 'meta').sort(), [...EARLY_TYPES].sort());
    assert.deepEqual(early.classes, data.classes);

    const pc1 = loadRulesData({ books: ['Player Core'] });
    // Support books (feats Player Core classes borrow from older books) load with any selection.
    assert.ok(pc1.feats.every((f) => f.source === 'Player Core' || !data.meta.books.includes(f.source)));
    assert.ok(!pc1.classes.some((c) => c.source !== 'Player Core'));
    assert.deepEqual(pc1.skills, data.skills, 'lists that belong to no book always load');
    assert.ok(dataFiles(index, { books: ['Player Core'] }).length < index.files.length);
  });

  it(`stays under ${SIZE_BUDGET / 1024 / 1024} MB, the point to move it into Postgres`, () => {
    const total = onDisk().reduce((sum, p) => sum + statSync(new URL(p, DATA_DIR)).size, 0);
    assert.ok(total < SIZE_BUDGET, `Rules data is ${(total / 1024 / 1024).toFixed(1)} MB. Time for roadmap step 4's Postgres move (docs/HANDOFF.md).`);
  });
});

describe('campaign books', () => {
  const all = data.meta.books;

  it('stores "every book" as null and always includes Player Core', () => {
    assert.equal(R.campaignBooks(null, all), null);
    assert.equal(R.campaignBooks([...all], all), null);
    assert.deepEqual(R.campaignBooks(['Dark Archive (Remastered)', 'Not A Book'], all), ['Player Core', 'Dark Archive (Remastered)']);
  });

  it('keeps support books like Divine Mysteries whatever the campaign allows', () => {
    const view = R.campaignData(data, ['Player Core']);
    assert.equal(view.deities.length, data.deities.length);
    assert.ok(view.classes.every((c) => c.source === 'Player Core'));
    assert.ok(!view.classes.find((c) => c.slug === 'wizard').features.some((f) => f.choice?.options.some((o) => o.source === 'Impossible Magic')), 'no Impossible Magic arcane schools');
  });

  it('keeps feats an allowed option grants, even from a book the campaign leaves out', () => {
    const view = R.campaignData(data, ['Player Core', 'Dark Archive (Remastered)']);
    const hammer = view.backgrounds.find((b) => b.slug === 'legacy-of-the-hammer');
    const granted = data.feats.find((f) => f.id === hammer.feats[0]);
    assert.equal(granted.source, 'Player Core 2');
    assert.ok(view.feats.some((f) => f.id === granted.id));
  });

  it('names choices from books a campaign leaves out', () => {
    const build = { ...R.emptyBuild(), class: data.classes.find((c) => c.slug === 'gunslinger').id, ancestry: data.ancestries.find((a) => a.slug === 'human').id };
    assert.deepEqual(R.bookIssues(build, data, null), []);
    assert.deepEqual(R.bookIssues(build, data, ['Player Core']).map((i) => [i.kind, i.name, i.book]), [['class', 'Gunslinger', 'Guns & Gears']]);
    assert.equal(R.dropBookIssues(build, data, ['Player Core']).class, null);
  });
});
