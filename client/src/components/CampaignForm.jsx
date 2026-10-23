import { useEffect, useState } from 'react';
import ImagePicker from './ImagePicker.jsx';
import CampaignCover from './CampaignCover.jsx';
import FormErrors, { errorsFrom } from './FormErrors.jsx';

const NAME_MAX = 80;
const BACKSTORY_MAX = 5000;
const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

/** Title, party level, backstory, and cover, with a live preview. Used to create and edit. */
export default function CampaignForm({ initial, submitLabel, onSubmit }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [partyLevel, setPartyLevel] = useState(initial?.partyLevel ?? 1);
  const [backstory, setBackstory] = useState(initial?.backstory ?? '');
  const [cover, setCover] = useState({});
  const [previewUrl, setPreviewUrl] = useState(initial?.coverUrl ?? null);
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!cover.file) return setPreviewUrl(cover.remove ? null : initial?.coverUrl ?? null);
    const url = URL.createObjectURL(cover.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cover, initial?.coverUrl]);

  const submit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setStatus(cover.file ? 'Uploading cover…' : 'Saving…');
    try {
      await onSubmit({ name, partyLevel, backstory, cover });
    } catch (err) {
      setErrors(errorsFrom(err));
      setStatus(null);
    }
  };

  return (
    <div className="split">
      <form className="split__col form" onSubmit={submit}>
        <label className="form-field">
          <span>Title</span>
          <input value={name} required maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="The Gilded Crypt" />
          <small className="muted counter">{name.length}/{NAME_MAX}</small>
        </label>

        <label className="form-field">
          <span>Party level</span>
          <select value={partyLevel} onChange={(e) => setPartyLevel(Number(e.target.value))}>
            {LEVELS.map((n) => <option key={n} value={n}>Level {n}</option>)}
          </select>
          <small className="muted italic">The level your heroes are at. Raise it as the party levels up.</small>
        </label>

        <label className="form-field">
          <span>Backstory</span>
          <textarea
            rows={9}
            maxLength={BACKSTORY_MAX}
            value={backstory}
            onChange={(e) => setBackstory(e.target.value)}
            placeholder="What do the heroes know when the story begins?"
          />
          <small className="muted counter">{backstory.length}/{BACKSTORY_MAX}</small>
        </label>

        <ImagePicker label="Cover image" hint="wide images work best" value={cover} currentUrl={initial?.coverUrl ?? null} onChange={setCover} />

        <FormErrors errors={errors} />
        <button type="submit" className="btn btn--blood" disabled={Boolean(status) || !name.trim()}>
          {status ?? submitLabel}
        </button>
      </form>

      <aside className="split__col" aria-label="Preview">
        <span className="eyebrow">Preview</span>
        <CampaignCover name={name || 'Your campaign'} coverUrl={previewUrl} subtitle={`Party level ${partyLevel}`} />
        {backstory.trim() ? <p className="backstory">{backstory}</p> : <p className="rule-note">Your backstory will appear here for your players.</p>}
      </aside>
    </div>
  );
}
