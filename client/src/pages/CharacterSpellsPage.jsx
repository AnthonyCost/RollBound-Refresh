import { Link } from 'react-router-dom';
import { spellAttack, spellDc } from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import { useRules } from '../state/useRules.js';
import Ornament from '../components/Ornament.jsx';
import { signed, titleCase } from '../format.js';

const SPELL_TYPES = ['spells'];

// How each kind of caster gets their spells, in a phrase.
const KIND = {
  repertoire: 'Spontaneous caster: you know these spells and cast any of them with your slots.',
  prepared: 'Prepared caster: each morning you prepare spells from your tradition into your slots.',
  spellbook: 'Spellbook caster: you prepare spells from this book each morning.',
  familiar: 'Your familiar holds these spells; you prepare from them each morning.',
  focus: 'You cast these with Focus Points, which you regain when you rest.',
};

const actionsLabel = (a) => (/^\d$/.test(a) ? `${a} action${a === '1' ? '' : 's'}` : a);
const rankLabel = (rank) => (rank === 0 ? 'Cantrips' : `Rank ${rank}`);

/** Every spell the character knows or has, with its full rules text. */
export default function CharacterSpellsPage() {
  const { character, conditions, shieldRaised } = useTable();
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
        {casting.prepares && (
          <p className="rule-note">You prepare {casting.prepares.cantrips} cantrips and {casting.prepares.spells} rank 1 spells each day.</p>
        )}
      </section>

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
                      <span className="spell__name">{spell.name}</span>
                      <span className="spell__actions">{actionsLabel(spell.actions)}</span>
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
