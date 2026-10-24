import { useState } from 'react';
import { savePortrait } from '../state/portraits.js';
import ImagePicker from './ImagePicker.jsx';
import FormErrors, { errorsFrom } from './FormErrors.jsx';

/** Change or remove a character's portrait. */
export default function PortraitEditor({ characterId, currentUrl, onSaved, onClose }) {
  const [value, setValue] = useState({});
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  const changed = Boolean(value.file || value.remove);

  const save = async () => {
    setBusy(true);
    setErrors([]);
    try {
      onSaved(await savePortrait(characterId, value.file ?? null));
      onClose();
    } catch (err) {
      setErrors(errorsFrom(err));
      setBusy(false);
    }
  };

  return (
    <section className="panel portrait-editor" aria-label="Character portrait">
      <ImagePicker label="Portrait" shape="square" hint="faces read best close up" value={value} currentUrl={currentUrl} onChange={setValue} />
      <FormErrors errors={errors} />
      <div className="btn-row">
        <button type="button" className="btn btn--grow" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn--blood btn--grow" disabled={!changed || busy} onClick={save}>
          {busy ? 'Saving…' : 'Save portrait'}
        </button>
      </div>
    </section>
  );
}
