import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useTable } from '../state/TableContext.jsx';
import PortraitEditor from '../components/PortraitEditor.jsx';
import Portrait from '../components/Portrait.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';

/**
 * A character's Settings tab, for its player: edit the build, change the portrait, or
 * delete the character. Deleting is permanent, so it asks twice: once to start, then
 * the player types the character's name to confirm.
 */
export default function CharacterSettingsPage() {
  const { character, characterId, portraitUrl, setPortraitUrl, campaign } = useTable();
  const navigate = useNavigate();
  const [editingPortrait, setEditingPortrait] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState([]);
  const name = character.name;
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();

  const remove = async () => {
    setDeleting(true);
    setErrors([]);
    try {
      await api.deleteCharacter(characterId);
      // A half-finished edit of this character has nothing left to edit.
      try {
        localStorage.removeItem(`rollbound:draft:${characterId}`);
      } catch {
        // Storage blocked: nothing was saved there.
      }
      navigate('/characters', { replace: true, state: { deleted: name } });
    } catch (err) {
      setErrors(errorsFrom(err));
      setDeleting(false);
    }
  };
  const cancel = () => {
    setConfirming(false);
    setTyped('');
  };

  return (
    <div className="settings narrow">
      <header className="settings__head">
        <h1 className="title">Settings</h1>
        <p className="rule-note">Change how {name} is built, their portrait, or remove them from your roster.</p>
      </header>

      <section className="panel settings__section" aria-labelledby="settings-build">
        <h2 id="settings-build" className="panel__title">Build</h2>
        {character.build ? (
          <>
            <p className="rule-note">Reopen the builder to change {name}’s ancestry, class, attributes, skills, feats, spells or name. Their Hit Points, inventory and backstory stay as they are.</p>
            <Link to={`/characters/${characterId}/edit`} className="btn">Edit character</Link>
          </>
        ) : (
          <p className="rule-note">{name} was made before the builder kept its choices, so their build can’t be reopened.</p>
        )}
      </section>

      <section className="panel settings__section" aria-labelledby="settings-portrait">
        <h2 id="settings-portrait" className="panel__title">Portrait</h2>
        {editingPortrait ? (
          <PortraitEditor characterId={characterId} currentUrl={portraitUrl} onSaved={setPortraitUrl} onClose={() => setEditingPortrait(false)} />
        ) : (
          <div className="settings__portrait">
            <Portrait url={portraitUrl} name={name} size="lg" />
            <button type="button" className="btn" onClick={() => setEditingPortrait(true)}>{portraitUrl ? 'Change portrait' : 'Add a portrait'}</button>
          </div>
        )}
      </section>

      <section className="panel danger settings__section" aria-labelledby="settings-delete">
        <h2 id="settings-delete" className="panel__title">Delete character</h2>
        <p className="rule-note">
          Deleting {name} is permanent. Their sheet, inventory, prepared spells and backstory are deleted with them
          {campaign ? `, and they leave ${campaign.name}` : ''}. This can’t be undone.
        </p>
        <FormErrors errors={errors} />
        {confirming ? (
          <div className="confirm confirm--inline settings__confirm" role="alertdialog" aria-labelledby="settings-delete-q">
            <p id="settings-delete-q">Are you sure? Type <strong>{name}</strong> to confirm.</p>
            <label className="field">
              <span className="visually-hidden">Character name</span>
              {/* The question needs an answer before anything else. */}
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={name} autoComplete="off" autoFocus />
            </label>
            <div className="btn-row">
              <button type="button" className="btn btn--grow" onClick={cancel}>Keep {name}</button>
              <button type="button" className="btn btn--blood btn--grow" disabled={!matches || deleting} onClick={remove}>
                {deleting ? 'Deleting…' : `Delete ${name} forever`}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn settings__delete" onClick={() => setConfirming(true)}>Delete character</button>
        )}
      </section>
    </div>
  );
}
