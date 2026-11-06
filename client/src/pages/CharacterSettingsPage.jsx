import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useTable } from '../state/TableContext.jsx';
import PortraitEditor from '../components/PortraitEditor.jsx';
import Portrait from '../components/Portrait.jsx';
import SettingsMenu from '../components/SettingsMenu.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';

/**
 * A character's Settings tab, for its player: edit the build, change the portrait, or
 * delete the character. Deleting is permanent, so it asks twice: once to start, then
 * the player types the character's name to confirm.
 */
export default function CharacterSettingsPage() {
  const { character, characterId, portraitUrl, setPortraitUrl, campaign } = useTable();
  const navigate = useNavigate();
  const [section, setSection] = useState('build');
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

  const sections = [
    { id: 'build', label: 'Build', hint: 'Ancestry, class, feats, spells', icon: 'feats' },
    { id: 'portrait', label: 'Portrait', hint: portraitUrl ? 'Change or remove it' : 'Add one', icon: 'user' },
    { id: 'delete', label: 'Delete character', hint: 'Permanent', icon: 'conditionDying', danger: true },
  ];

  return (
    <div className="settings">
      <h1 className="visually-hidden">{name}’s settings</h1>
      <SettingsMenu
        label={`${name}’s settings`}
        sections={sections}
        active={section}
        onSelect={(id) => {
          setSection(id);
          cancel();
        }}
        head={
          <>
            <Portrait url={portraitUrl} name={name} size="sm" />
            <div>
              <p className="co__class-name">{name}</p>
              <p className="co__class-count">Level {character.level} {character.ancestry?.name} {character.className}</p>
            </div>
          </>
        }
      >
        {section === 'build' &&
          (character.build ? (
            <>
              <p className="settings-menu__lede">Reopen the builder to change {name}’s ancestry, class, attributes, skills, feats, spells or name.</p>
              <ul className="co__facts">
                <li>Hit Points stay</li>
                <li>Inventory stays</li>
                <li>Backstory stays</li>
              </ul>
              <div className="co__actions">
                <Link to={`/characters/${characterId}/edit`} className="btn btn--blood">Edit character</Link>
              </div>
            </>
          ) : (
            <p className="settings-menu__lede">{name} was made before the builder kept its choices, so their build can’t be reopened.</p>
          ))}

        {section === 'portrait' &&
          (editingPortrait ? (
            <PortraitEditor characterId={characterId} currentUrl={portraitUrl} onSaved={setPortraitUrl} onClose={() => setEditingPortrait(false)} />
          ) : (
            <div className="settings__portrait">
              <span className="settings-menu__frame"><Portrait url={portraitUrl} name={name} size="lg" /></span>
              <div className="settings__portrait-text">
                <p className="settings-menu__lede">{portraitUrl ? `How ${name} looks on the sheet, the party list and the encounter tracker.` : `${name} shows their initial until you add a portrait.`}</p>
                <div className="co__actions">
                  <button type="button" className="btn btn--blood" onClick={() => setEditingPortrait(true)}>{portraitUrl ? 'Change portrait' : 'Add a portrait'}</button>
                </div>
              </div>
            </div>
          ))}

        {section === 'delete' && (
          <div className="settings-menu__danger">
            <p className="settings-menu__lede">
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
              <div className="co__actions">
                <button type="button" className="btn settings__delete" onClick={() => setConfirming(true)}>Delete {name}</button>
              </div>
            )}
          </div>
        )}
      </SettingsMenu>
    </div>
  );
}
