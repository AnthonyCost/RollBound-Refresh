import { useState } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { THEMES, applyTheme } from '../themes.js';
import FormErrors, { errorsFrom } from './FormErrors.jsx';

/**
 * Choose the site's colour theme. Each option is drawn in its own theme (data-theme on
 * the card), so what you see is what you get. Picking one applies it at once and saves
 * it to the account; if saving fails, it goes back.
 */
export default function ThemePicker() {
  const { user, updateProfile } = useAuth();
  const current = user.theme ?? 'infernal';
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(null);

  const choose = async (id) => {
    if (id === current || saving) return;
    setErrors([]);
    setSaving(id);
    applyTheme(id);
    try {
      await updateProfile({ theme: id });
    } catch (err) {
      applyTheme(current);
      setErrors(errorsFrom(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="sheet-panel theme-picker" aria-labelledby="theme-title">
      <h2 id="theme-title" className="sheet-panel__title">Theme</h2>
      <p className="muted">The colours RollBound uses everywhere, saved to your account.</p>
      <div className="theme-picker__options" role="radiogroup" aria-labelledby="theme-title">
        {THEMES.map((t) => {
          const on = (saving ?? current) === t.id;
          return (
            <label key={t.id} className={`theme-card ${on ? 'theme-card--on' : ''}`} data-theme={t.id}>
              <input type="radio" name="theme" value={t.id} checked={on} onChange={() => choose(t.id)} className="visually-hidden" />
              {/* A small slice of the site in this theme. */}
              <span className="theme-card__preview" aria-hidden="true">
                <span className="theme-card__panel">
                  <span className="theme-card__label">Armor class</span>
                  <span className="theme-card__value">18</span>
                  <span className="theme-card__pips"><i /><i /><i /><i /></span>
                </span>
                <span className="theme-card__btn">Strike</span>
                <span className="theme-card__orb" />
              </span>
              <span className="theme-card__name">
                {t.name}
                {on && <span className="theme-card__check">{saving === t.id ? 'Saving…' : '✓ In use'}</span>}
              </span>
              <span className="theme-card__blurb">{t.blurb}</span>
            </label>
          );
        })}
      </div>
      <FormErrors errors={errors} />
    </section>
  );
}
