import { Link } from 'react-router-dom';
import { spellAttack, spellDc, spellKey, preparedValue } from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import { useRules } from '../state/useRules.js';
import Ornament from '../components/Ornament.jsx';
import { signed, titleCase } from '../format.js';
import ActionCost from '../components/ActionCost.jsx';
import Chips from '../builder/Chips.jsx';

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
    <section className="panel prepare" aria-labelledby="prepare-title">
      <h2 id="prepare-title" className="panel__title">Prepared today</h2>
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

/** Every spell the character knows or has, with its full rules text. */
export default function CharacterSpellsPage() {
  const { character, conditions, shieldRaised, prepared, setPrepared, preparedStatus, readOnly } = useTable();
  const rules = useRules(SPELL_TYPES);
  const casting = character.spellcasting;
  const opts = { conditions, shieldRaised };

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

  const spells = [...casting.cantrips, ...casting.spells];
  const full = (s) => rules?.spells?.find((x) => x.id === s.id || x.slug === s.slug) ?? s;
  const ranks = [...new Set(spells.map((s) => s.rank))].sort((a, b) => a - b);
  // How many times each spell is prepared today (a rank 1 spell can fill several slots).
  const timesPrepared = (s) => (prepared ? [...prepared.cantrips, ...prepared.slots].filter((p) => p && spellKey(p) === spellKey(s)).length : 0);

  return (
    <div className="narrow">
      <Ornament label="SPELLS" />
      <section className="panel spellbook__head">
        <h1 className="panel__title">{titleCase(casting.tradition ?? 'Spells')} {casting.kind === 'focus' ? 'focus spells' : 'spells'}</h1>
        <p className="rule-note">{KIND[casting.kind] ?? ''}</p>
        <dl className="spellbook__stats">
          <div><dt>Spell attack</dt><dd>{signed(spellAttack(character, opts).total)}</dd></div>
          <div><dt>Spell DC</dt><dd>{spellDc(character, opts).total}</dd></div>
          {casting.kind !== 'focus' && <div><dt>Rank 1 slots</dt><dd>{casting.slots}</dd></div>}
        </dl>
      </section>

      {prepared && <PreparePanel casting={casting} prepared={prepared} setPrepared={setPrepared} status={preparedStatus} readOnly={readOnly} />}

      {rules?.error && <p className="rule-note rule-note--warn">Couldn't load the spells' full rules text. Try refreshing.</p>}

      {ranks.map((rank) => (
        <section key={rank} className="spellbook__rank" aria-label={rankLabel(rank)}>
          <h2 className="eyebrow">{rankLabel(rank)}</h2>
          <ul className="spellbook__list">
            {spells.filter((s) => s.rank === rank).map((s) => {
              const spell = full(s);
              const facts = [
                ['Range', spell.range],
                ['Area', spell.area],
                ['Targets', spell.target],
                ['Defense', spell.defense && titleCase(spell.defense)],
                ['Duration', spell.duration],
              ].filter(([, v]) => v);
              return (
                <li key={s.id ?? s.slug}>
                  <details className="feature spell">
                    <summary>
                      <span className="spell__name">
                        {spell.name}
                        {timesPrepared(s) > 0 && <span className="tag spell__prepared">Prepared{timesPrepared(s) > 1 ? ` ×${timesPrepared(s)}` : ''}</span>}
                      </span>
                      <span className="spell__actions"><ActionCost actions={spell.actions} /></span>
                    </summary>
                    <div className="spell__body">
                      {spell.traits?.length > 0 && (
                        <p className="spell__traits">{spell.traits.map((t) => <span key={t} className="tag">{t}</span>)}</p>
                      )}
                      {facts.length > 0 && (
                        <p className="spell__facts">
                          {facts.map(([k, v]) => <span key={k}><strong>{k}</strong> {v}</span>)}
                        </p>
                      )}
                      {spell.description
                        ? <div className="option__desc" dangerouslySetInnerHTML={{ __html: spell.description }} />
                        : !rules && <p className="muted italic">Loading the rules text…</p>}
                      {spell.slug && <Link to={`/spells/${spell.slug}`} className="spell__link">Open in the Spell Book</Link>}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
