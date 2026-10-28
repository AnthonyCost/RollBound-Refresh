import { useState } from 'react';
import { useTable } from '../state/TableContext.jsx';
import { useRules } from '../state/useRules.js';
import BookSpread from '../components/BookSpread.jsx';
import BookLeaf, { wide } from '../builder/BookLeaf.jsx';
import { titleCase } from '../format.js';

// Rules text for feats, class features and heritages, loaded when the tab opens.
const RULE_TYPES = ['feats', 'classes', 'heritages'];
const SECTIONS = [
  { key: 'heritage', tab: 'Heritage', name: 'Ancestry and heritage' },
  { key: 'ancestry', tab: 'Ancestry', name: 'Ancestry feats' },
  { key: 'class', tab: 'Class', name: 'Class feats' },
  { key: 'skill', tab: 'Skill', name: 'Skill feats' },
  { key: 'general', tab: 'General', name: 'General feats' },
  { key: 'other', tab: 'Other', name: 'Other feats' },
  { key: 'features', tab: 'Features', name: 'Class features' },
];
const FEAT_SECTIONS = ['ancestry', 'class', 'skill', 'general'];

const actionLabel = (a) => (a == null || a === '' ? null : /^\d$/.test(String(a)) ? `${a} action${String(a) === '1' ? '' : 's'}` : titleCase(String(a)));

/**
 * The Feats tab: everything the character has gained (heritage, feats, class features)
 * as a book, a section per kind, with each one's rules text on the right-hand page.
 * Read-only views (shared and party sheets) show it the same way.
 */
export default function CharacterFeatsPage() {
  const { character } = useTable();
  const rules = useRules(RULE_TYPES);
  const featData = (id) => rules?.feats?.find((f) => f.id === id);
  const heritage = rules?.heritages?.find((h) => h.id === character.build?.heritage || h.name === character.heritage);
  const cls = rules?.classes?.find((c) => c.slug === character.classSlug);

  const feats = character.feats ?? [];
  const items = [
    character.heritage && { id: 'heritage', name: character.heritage, section: 'heritage', from: `${character.ancestry.name} heritage`, rule: heritage, kind: 'Heritage' },
    ...SECTIONS.filter((s) => FEAT_SECTIONS.includes(s.key) || s.key === 'other').flatMap((s) =>
      feats
        .filter((f) => (s.key === 'other' ? !FEAT_SECTIONS.includes(f.category) : f.category === s.key))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => ({ id: `feat:${f.id}`, name: f.name, section: s.key, from: f.from, rule: featData(f.id), kind: `${titleCase(f.category ?? 'other')} feat` })),
    ),
    ...(character.classFeatures ?? []).map((f) => {
      const feature = cls?.features.find((x) => x.name === f.name);
      const option = f.choice && feature?.choice?.options.find((o) => o.name === f.choice);
      return {
        id: `feature:${f.name}`,
        name: f.choice ? `${f.name}: ${f.choice}` : f.name,
        section: 'features',
        from: character.className,
        rule: { description: option?.description || feature?.description },
        kind: 'Class feature',
      };
    }),
  ].filter(Boolean);
  const sections = SECTIONS.filter((s) => items.some((i) => i.section === s.key));

  const [openId, setOpenId] = useState(() => (wide() ? items[0]?.id ?? null : null));
  const open = items.find((i) => i.id === openId) ?? null;
  const featCount = feats.length;

  return (
    <div className="feats-tab">
      <header className="feats-tab__head">
        <h1 className="sheet-panel__title">Feats and Abilities</h1>
        <p className="rule-note">
          {featCount} feat{featCount === 1 ? '' : 's'} and {(character.classFeatures ?? []).length} class features at level {character.level}. Open one to read its rules.
        </p>
      </header>
      {rules?.error && <p className="rule-note rule-note--warn">Couldn't load the rules text. Try refreshing.</p>}
      <BookSpread
        items={items}
        total={items.length}
        noun="entries"
        sections={sections}
        sectionOf={(i) => i.section}
        tabsOnTop
        open={open}
        onOpen={(i) => setOpenId(i.id)}
        meta={(i) => <span className="muted">{i.from}</span>}
        emptyText="Nothing here yet."
        leaf={open && (
          <BookLeaf
            key={open.id}
            eyebrow={open.kind}
            title={open.name}
            facts={[
              ['From', open.from],
              ['Level', open.rule?.level],
              ['Actions', actionLabel(open.rule?.actions)],
              ['Traits', open.rule?.traits?.map(titleCase).join(', ')],
              ['Prerequisites', open.rule?.prerequisites?.join('; ')],
            ]}
            description={open.rule?.description}
            notes={!rules && <p className="muted italic">Loading the rules text…</p>}
            onClose={() => setOpenId(null)}
          />
        )}
        blank={
          <>
            <p className="book__blank-title">Feats and abilities</p>
            <p className="rule-note">Open an entry from the index to read its rules here. The tabs switch between your heritage, each kind of feat and your class features.</p>
          </>
        }
      />
    </div>
  );
}
