import { useState } from 'react';
import { Link } from 'react-router-dom';
import { spellAttack, spellDc, spellKey, preparedValue } from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import { useRules } from '../state/useRules.js';
import Ornament from '../components/Ornament.jsx';
import { sentenceCase, signed, titleCase } from '../format.js';
import ActionCost from '../components/ActionCost.jsx';
import Chips from '../builder/Chips.jsx';
import BookSpread from '../components/BookSpread.jsx';
import BookLeaf, { wide } from '../builder/BookLeaf.jsx';

const SPELL_TYPES = ['spells'];

// How each kind of caster gets their spells, in a phrase.
const KIND = {
  repertoire: 'Spontaneous caster: you know these spells and cast any of them with your slots.',
  prepared: 'Prepared caster: each morning you prepare spells from your tradition into your slots.',
  spellbook: 'Spellbook caster: you prepare spells from this book each morning.',
  familiar: 'Your familiar holds these spells; you prepare from them each morning.',
  focus: 'You cast these with Focus Points, which you regain when you rest.',
};

const rankLabel = (rank) => (rank === 0 ? 'Cantrips' : `Rank ${rank}`);
const savedLabel = { waiting: 'Saving…', saving: 'Saving…', saved: 'Saved', error: "Couldn't save. Check your connection; your next change will try again." };

/**
 * Today's preparations for a caster who prepares from their spellbook or familiar:
 * pick their cantrips, and fill each rank 1 slot with a spell they know (the same
 * spell can fill more than one slot). Read-only views show it without the controls.
 */
function PreparePanel({ casting, prepared, setPrepared, status, readOnly }) {
  const { cantrips: maxCantrips } = casting.prepares;
  const value = preparedValue(prepared);
  const on = new Set(value.cantrips);
  const toggleCantrip = (key) =>
    setPrepared({ ...value, cantrips: on.has(key) ? value.cantrips.filter((k) => k !== key) : [...value.cantrips, key] });
  const setSlot = (i, key) => setPrepared({ ...value, slots: value.slots.map((k, j) => (j === i ? key || null : k)) });
  const source = casting.kind === 'familiar' ? 'your familiar' : `your ${casting.listName ?? 'spellbook'}`;
  const names = new Map(casting.cantrips.map((s) => [spellKey(s), s.name]));

  return (
    <section className="sheet-panel prepare" aria-labelledby="prepare-title">
      <h2 id="prepare-title" className="sheet-panel__title">Prepared today</h2>
      <p className="rule-note">
        During your daily preparations, choose {maxCantrips} cantrips and a spell for each rank 1 slot from {source}. A spell can fill more than one slot.
      </p>

      <div className="prepare__group">
        <span className="eyebrow">Cantrips · {on.size} of {maxCantrips}</span>
        <Chips
          label="Prepared cantrips"
          options={casting.cantrips.map(spellKey)}
          isOn={(k) => on.has(k)}
          isDisabled={(k) => readOnly || (!on.has(k) && on.size >= maxCantrips)}
          onToggle={toggleCantrip}
          render={(k) => names.get(k)}
        />
      </div>

      <div className="prepare__group">
        <span className="eyebrow">Rank 1 slots</span>
        {value.slots.map((key, i) => (
          <label key={i} className="form-field prepare__slot">
            <span>Slot {i + 1}</span>
            <select value={key ?? ''} disabled={readOnly} onChange={(e) => setSlot(i, e.target.value)}>
              <option value="">Empty</option>
              {casting.spells.map((s) => (
                <option key={spellKey(s)} value={spellKey(s)}>{s.name}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {!readOnly && savedLabel[status] && (
        <p className={`rule-note ${status === 'error' ? 'rule-note--warn' : ''}`} role="status">{savedLabel[status] ?? ''}</p>
      )}
    </section>
  );
}

/**
 * Every spell the character knows or has, laid out like the Spell Book: a tab for
 * cantrips and each rank, the index on the left, and the open spell's full rules text
 * on the right. Casters who prepare from known spells choose today's spells above it.
 */
export default function CharacterSpellsPage() {
  const { character, conditions, shieldRaised, prepared, setPrepared, preparedStatus, readOnly } = useTable();
  const rules = useRules(SPELL_TYPES);
  const casting = character.spellcasting;
  const opts = { conditions, shieldRaised };
  const spells = casting ? [...casting.cantrips, ...casting.spells] : [];
  const items = spells
    .map((s) => ({ ...s, id: spellKey(s) }))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  const [openId, setOpenId] = useState(() => (wide() ? items[0]?.id ?? null : null));

  if (!casting) {
    return (
      <div className="narrow">
        <Ornament label="SPELLS" />
        <p className="panel panel--dashed muted italic center">
          {character.name} doesn't cast spells. {character.runes?.length ? 'Their runes are on the Sheet tab.' : ''}
        </p>
      </div>
    );
  }

  const full = (s) => rules?.spells?.find((x) => x.id === s.id || x.slug === s.slug) ?? s;
  const sectionOf = (s) => String(s.rank);
  const sections = [...new Set(items.map(sectionOf))].map((key) => ({ key, tab: key === '0' ? 'Cantrips' : `Rank ${key}`, name: rankLabel(Number(key)) }));
  // How many times each spell is prepared today (a rank 1 spell can fill several slots).
  const timesPrepared = (s) => (prepared ? [...prepared.cantrips, ...prepared.slots].filter((p) => p && spellKey(p) === spellKey(s)).length : 0);
  const open = items.find((i) => i.id === openId) ?? null;
  const spell = open && full(open);

  return (
    <div className="feats-tab">
      <header className="feats-tab__head">
        <h1 className="sheet-panel__title">{titleCase(casting.tradition ?? 'Spells')} {casting.kind === 'focus' ? 'focus spells' : 'spells'}</h1>
        <p className="rule-note">{KIND[casting.kind] ?? ''}</p>
      </header>
      <div className={`sheet-dcs sheet-dcs--${casting.kind === 'focus' ? 2 : 3}`}>
        <div className="sheet-def">
          <span className="sheet-def__label">Spell attack</span>
          <span className="sheet-def__value">{signed(spellAttack(character, opts).total)}</span>
        </div>
        <div className="sheet-def">
          <span className="sheet-def__label">Spell DC</span>
          <span className="sheet-def__value">{spellDc(character, opts).total}</span>
        </div>
        {casting.kind !== 'focus' && (
          <div className="sheet-def">
            <span className="sheet-def__label">Rank 1 slots</span>
            <span className="sheet-def__value">{casting.slots}</span>
          </div>
        )}
      </div>

      {prepared && <PreparePanel casting={casting} prepared={prepared} setPrepared={setPrepared} status={preparedStatus} readOnly={readOnly} />}

      {rules?.error && <p className="rule-note rule-note--warn">Couldn't load the spells' full rules text. Try refreshing.</p>}

      <BookSpread
        items={items}
        total={items.length}
        noun="spells"
        sections={sections}
        sectionOf={sectionOf}
        tabsOnTop
        open={open}
        onOpen={(i) => setOpenId(i.id)}
        marked={(i) => timesPrepared(i) > 0}
        meta={(i) => (
          <>
            {timesPrepared(i) > 1 && <span className="tag">×{timesPrepared(i)}</span>}
            <ActionCost actions={i.actions} />
          </>
        )}
        emptyText={casting.kind === 'focus' ? 'Your focus spells come from your class; read them on the Feats tab.' : 'No spells yet.'}
        leaf={open && (
          <BookLeaf
            key={open.id}
            eyebrow={`${open.rank === 0 ? 'Cantrip' : `Spell ${open.rank}`}${timesPrepared(open) ? ` · Prepared${timesPrepared(open) > 1 ? ` ×${timesPrepared(open)}` : ''}` : ''}`}
            title={spell.name}
            facts={[
              ['Cast', <ActionCost key="cast" actions={spell.actions} />],
              ['Range', sentenceCase(spell.range)],
              ['Area', sentenceCase(spell.area)],
              ['Targets', sentenceCase(spell.target)],
              ['Defense', spell.defense && titleCase(spell.defense)],
              ['Duration', sentenceCase(spell.duration)],
              ['Traits', spell.traits?.map(titleCase).join(', ')],
            ]}
            description={spell.description}
            notes={!rules && <p className="muted italic">Loading the rules text…</p>}
            onClose={() => setOpenId(null)}
          >
            {spell.slug && <Link to={`/spells/${spell.slug}`} className="spell__link">Open in the Spell Book</Link>}
          </BookLeaf>
        )}
        blank={
          <>
            <p className="book__blank-title">Your spells</p>
            <p className="rule-note">Open a spell from the index to read it here. The tabs switch between cantrips and each rank.</p>
          </>
        }
      />
    </div>
  );
}
