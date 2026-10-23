import { useState } from 'react';
import { useCampaignService } from '../state/campaignService.js';
import FormErrors, { errorsFrom } from './FormErrors.jsx';
import Avatar from './Avatar.jsx';

const format = (raw) => {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
};

/** Enter an invite code, preview the campaign, and bring one of your characters in. */
export default function JoinCampaign({ characters, onJoined }) {
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [characterId, setCharacterId] = useState('');
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const service = useCampaignService();

  const find = async (e) => {
    e.preventDefault();
    setErrors([]);
    setBusy(true);
    try {
      setPreview(await service.preview(code));
    } catch (err) {
      setErrors(errorsFrom(err));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setErrors([]);
    setBusy(true);
    try {
      await service.join(code, characters.find((c) => String(c.id) === characterId)?.id ?? characterId);
      setCode('');
      setPreview(null);
      setCharacterId('');
      onJoined();
    } catch (err) {
      setErrors(errorsFrom(err));
    } finally {
      setBusy(false);
    }
  };

  const chosen = characters.find((c) => String(c.id) === characterId);

  return (
    <section className="panel join">
      <h2 className="panel__title">Join a campaign</h2>
      <form className="join__find" onSubmit={find}>
        <label className="visually-hidden" htmlFor="invite-code">Invite code</label>
        <input
          id="invite-code"
          className="join__code"
          value={code}
          onChange={(e) => {
            setCode(format(e.target.value));
            setPreview(null);
          }}
          placeholder="XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
        />
        <button type="submit" className="btn" disabled={busy || code.length < 9}>Find</button>
      </form>

      {preview && (
        <div className="join__preview">
          {preview.coverUrl && <img className="join__thumb" src={preview.coverUrl} alt="" />}
          <div>
            <p className="hub-card__name" style={{ margin: 0 }}>{preview.name}</p>
            <p className="hub-card__sub hub-card__gm" style={{ margin: 0 }}>
              <Avatar url={preview.gmAvatarUrl} name={preview.gmName} size={18} /> Run by {preview.gmName}
            </p>
          </div>
        </div>
      )}

      {preview &&
        (characters.length ? (
          <>
            <label className="form-field">
              <span>Bring which character?</span>
              <select value={characterId} onChange={(e) => setCharacterId(e.target.value)}>
                <option value="">Choose a character</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.campaignName ? ` (in ${c.campaignName})` : ''}
                  </option>
                ))}
              </select>
            </label>
            {chosen?.campaignName && chosen.campaignId !== preview.id && (
              <p className="rule-note">A character plays in one campaign at a time, so {chosen.name} will leave {chosen.campaignName}.</p>
            )}
            <button type="button" className="btn btn--blood" disabled={busy || !characterId} onClick={join}>
              Join {preview.name}
            </button>
          </>
        ) : (
          <p className="rule-note">Create a character first, then come back to join.</p>
        ))}

      <FormErrors errors={errors} />
    </section>
  );
}
