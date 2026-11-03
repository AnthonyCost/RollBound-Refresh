import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useTable } from '../state/TableContext.jsx';
import Portrait from './Portrait.jsx';
import PortraitEditor from './PortraitEditor.jsx';
import ExportSheetButton from './ExportSheetButton.jsx';
import ShareSheet from './ShareSheet.jsx';
import Icon from './Icon.jsx';
import FormErrors, { errorsFrom } from './FormErrors.jsx';

/**
 * The character's own drawer, opened from their portrait on the sheet: it slides in from
 * the left (up from the bottom on phones), the mirror of the details drawer. Rename them,
 * change their portrait, open their sheet as a PDF, or share it. Settings has the rest.
 */
export default function CharacterDrawer({ open, onClose }) {
  const { character, setCharacter, characterId, portraitUrl, setPortraitUrl } = useTable();
  const [name, setName] = useState(character.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState([]);
  const [editingPortrait, setEditingPortrait] = useState(false);

  // Each time it opens, start from the character as they are now.
  useEffect(() => {
    if (!open) return undefined;
    setName(character.name);
    setSaved(false);
    setErrors([]);
    setEditingPortrait(false);
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
    // Only on opening: the name field shouldn't reset while it's being typed in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);

  const trimmed = name.trim();
  const changed = trimmed && trimmed !== character.name;
  // The server rebuilds the sheet from the build, so renaming saves the build with the new name.
  const rename = async (e) => {
    e.preventDefault();
    if (!changed || !character.build) return;
    setSaving(true);
    setErrors([]);
    try {
      const row = await api.saveCharacter(characterId, { build: { ...character.build, name: trimmed } });
      setCharacter(row.data);
      setSaved(true);
    } catch (err) {
      setErrors(errorsFrom(err));
    } finally {
      setSaving(false);
    }
  };

  const line = [`Level ${character.level}`, character.ancestry?.name, character.className].filter(Boolean).join(' · ');
  return (
    <aside className={`details details--left character-drawer ${open ? 'details--open' : ''}`} aria-label="Character" aria-hidden={!open}>
      {open && (
        <div className="details__panel">
          <div className="details__top">
            <span className="details__kind">Character</span>
            <button type="button" className="details__close" onClick={onClose} aria-label="Close">
              <Icon name="close" size={16} />
            </button>
          </div>

          <header className="character-drawer__head">
            <Portrait url={portraitUrl} name={character.name} size="lg" />
            <div>
              <h2 className="details__name">{character.name}</h2>
              <p className="character-drawer__line">{line}</p>
            </div>
          </header>

          <section className="character-drawer__section" aria-labelledby="cd-name">
            <h3 id="cd-name" className="details__sub">Name</h3>
            {character.build ? (
              <form className="character-drawer__rename" onSubmit={rename}>
                <label className="visually-hidden" htmlFor="cd-name-input">Character name</label>
                <input
                  id="cd-name-input"
                  value={name}
                  maxLength={60}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSaved(false);
                  }}
                  aria-invalid={!trimmed}
                />
                <button type="submit" className="btn" disabled={!changed || saving}>{saving ? 'Saving…' : 'Save'}</button>
              </form>
            ) : (
              <p className="details__note">{character.name} was made before the builder kept its choices, so their name can’t be changed here.</p>
            )}
            {!trimmed && <p className="rule-note--warn">A character needs a name.</p>}
            {saved && <p className="details__note" role="status">Saved. They’re {character.name} now.</p>}
            <FormErrors errors={errors} />
          </section>

          <section className="character-drawer__section" aria-labelledby="cd-portrait">
            <h3 id="cd-portrait" className="details__sub">Portrait</h3>
            {editingPortrait ? (
              <PortraitEditor characterId={characterId} currentUrl={portraitUrl} onSaved={setPortraitUrl} onClose={() => setEditingPortrait(false)} />
            ) : (
              <button type="button" className="btn" onClick={() => setEditingPortrait(true)}>{portraitUrl ? 'Change portrait' : 'Add a portrait'}</button>
            )}
          </section>

          <section className="character-drawer__section" aria-labelledby="cd-pdf">
            <h3 id="cd-pdf" className="details__sub">Character sheet</h3>
            <p className="details__note">Paizo’s character sheet, filled in and still editable, to print or save.</p>
            <ExportSheetButton />
          </section>

          <section className="character-drawer__section character-drawer__share">
            <ShareSheet />
          </section>

          <Link to="../settings" className="details__link" onClick={onClose}>Edit the build or delete {character.name} in Settings</Link>
        </div>
      )}
    </aside>
  );
}
