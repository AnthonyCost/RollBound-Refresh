import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { STEPS, reviewCharacter } from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import { isOutdated, loadRules, replaceCharacter } from '../state/rulesData.js';
import FormErrors, { errorsFrom } from './FormErrors.jsx';

const STEP_TITLES = { ancestry: 'Ancestry', background: 'Background', class: 'Class', attributes: 'Attributes', skills: 'Skills', feats: 'Feats', spells: 'Spells', gear: 'Gear', review: 'Review' };

/**
 * Checks a saved character against the current rules data after a re-import.
 * A sheet that comes out the same is quietly restamped; changed numbers offer an
 * update; choices that disappeared or no longer fit ask the player to re-pick.
 */
export default function RulesUpdateNotice() {
  const { character, characterId, setCharacter } = useTable();
  const [review, setReview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const outdated = isOutdated(character);

  useEffect(() => {
    if (!outdated) return;
    let cancelled = false;
    loadRules()
      .then((data) => {
        if (cancelled) return;
        const result = reviewCharacter(character, data);
        if (result.status === 'restamp') {
          // Nothing the player sees changes, so just record the new version.
          replaceCharacter(characterId, result.character).then(() => !cancelled && setCharacter(result.character), () => {});
        } else setReview(result);
      })
      .catch(() => {}); // The sheet still works from its saved numbers.
    return () => {
      cancelled = true;
    };
  }, [outdated, character, characterId, setCharacter]);

  if (!outdated || !review || review.status === 'current' || review.status === 'restamp') return null;

  const update = async () => {
    setSaving(true);
    setErrors([]);
    try {
      await replaceCharacter(characterId, review.character);
      setCharacter(review.character);
      setReview(null);
    } catch (err) {
      setErrors(errorsFrom(err));
      setSaving(false);
    }
  };

  if (review.status === 'refresh') {
    return (
      <section className="notice" aria-labelledby="rules-update-title">
        <h2 id="rules-update-title" className="notice__title">Rules updated</h2>
        <p>The rules data changed since {character.name} was built. All of their choices still work, but some numbers or rules text on this sheet are different now.</p>
        <FormErrors errors={errors} />
        <button type="button" className="btn btn--blood" disabled={saving} onClick={update}>
          {saving ? 'Updating…' : 'Update sheet'}
        </button>
      </section>
    );
  }

  const steps = [...new Set([...review.missing, ...review.problems].map((x) => x.step))].sort((a, b) => STEPS.indexOf(a) - STEPS.indexOf(b));
  return (
    <section className="notice" aria-labelledby="rules-update-title">
      <h2 id="rules-update-title" className="notice__title">Choices to re-pick</h2>
      <p>The rules data changed since {character.name} was built, and some of their choices need picking again:</p>
      <ul className="notice__list">
        {review.missing.map((m) => (
          <li key={`${m.kind}-${m.id}`}>
            <strong>{m.name ?? `A ${m.kind}`}</strong> ({m.kind}) is no longer in the rules data.
          </li>
        ))}
        {!review.missing.length && review.problems.map((p) => <li key={p.message}>{p.message}</li>)}
      </ul>
      <p className="muted">Until then the sheet keeps its saved numbers. Re-picking affects: {steps.map((s) => STEP_TITLES[s]).join(', ')}.</p>
      <Link to={`/characters/${characterId}/edit`} className="btn btn--blood">Re-pick in the builder</Link>
    </section>
  );
}
