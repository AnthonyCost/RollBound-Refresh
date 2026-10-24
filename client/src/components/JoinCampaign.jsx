import { useState } from 'react';
import { useCampaignService } from '../state/campaignService.js';
import FormErrors, { errorsFrom } from './FormErrors.jsx';
import Avatar from './Avatar.jsx';
import { Link } from 'react-router-dom';
import { booksLabel } from '../state/rulesData.js';

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
  // After asking: the GM decides, so say what happens next.
  const [sent, setSent] = useState(null);
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
      const chosenCharacter = characters.find((c) => String(c.id) === characterId);
      const result = await service.join(code, chosenCharacter?.id ?? characterId);
      setSent(result.status === 'pending' ? { character: chosenCharacter?.name, campaign: preview.name } : null);
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
            setSent(null);
          }}
          placeholder="XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
        />
        <button type="submit" className="btn" disabled={busy || code.length < 9}>Find</button>
      </form>

      {sent && (
        <p className="panel panel--hot join__sent" role="status">
          Asked to bring {sent.character} into {sent.campaign}. Its GM will accept or reject the request, and you'll hear back in your inbox.
        </p>
      )}

      {preview && (
        <div className="join__preview">
          {preview.coverUrl && <img className="join__thumb" src={preview.coverUrl} alt="" />}
          <div>
            <p className="hub-card__name" style={{ margin: 0 }}>{preview.name}</p>
            <p className="hub-card__sub hub-card__gm" style={{ margin: 0 }}>
              <Avatar url={preview.gmAvatarUrl} name={preview.gmName} size={18} /> Run by {preview.gmName}
            </p>
            <p className="hub-card__tag" style={{ margin: '4px 0 0' }}>Books: {booksLabel(preview.books)}</p>
          </div>
        </div>
      )}
      {preview && (
        <Link to={`/create?invite=${encodeURIComponent(code)}`} className="btn">
          Build a new character for {preview.name}
        </Link>
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
            {chosen?.joinRequest && chosen.joinRequest.campaignId !== preview.id && (
              <p className="rule-note">{chosen.name} is waiting to hear from {chosen.joinRequest.campaignName}. Asking here withdraws that request.</p>
            )}
            <button type="button" className="btn btn--blood" disabled={busy || !characterId} onClick={join}>
              {preview.isGm ? `Join ${preview.name}` : `Ask to join ${preview.name}`}
            </button>
            {!preview.isGm && <p className="rule-note">The GM of {preview.name} accepts or rejects each request.</p>}
          </>
        ) : (
          <p className="rule-note">Create a character first, then come back to join.</p>
        ))}

      <FormErrors errors={errors} />
    </section>
  );
}
