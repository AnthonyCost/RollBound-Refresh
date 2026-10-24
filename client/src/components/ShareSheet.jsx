import { useState } from 'react';
import { api } from '../api.js';
import { useTable } from '../state/TableContext.jsx';
import FormErrors, { errorsFrom } from './FormErrors.jsx';

/** The character's share link: anyone with it can view this sheet, read-only. */
export default function ShareSheet() {
  const { characterId, shareId, setShareId } = useTable();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);

  if (!shareId) {
    return (
      <section className="panel share">
        <h2 className="panel__title">Share this sheet</h2>
        <p className="rule-note">Demo characters live only in this tab. Create an account to get a link anyone can open.</p>
      </section>
    );
  }

  const url = `${window.location.origin}/sheets/${shareId}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrors(['Your browser blocked copying. Select the link and copy it yourself.']);
    }
  };
  const reset = async () => {
    if (!window.confirm('Make a new link? The current link will stop working for everyone who has it.')) return;
    setBusy(true);
    setErrors([]);
    try {
      setShareId((await api.resetShareLink(characterId)).shareId);
    } catch (err) {
      setErrors(errorsFrom(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel share" aria-labelledby="share-title">
      <h2 id="share-title" className="panel__title">Share this sheet</h2>
      <p className="rule-note">Anyone with this link can view this sheet, without signing in. They can't change anything.</p>
      <div className="share__row">
        <input className="share__url" readOnly value={url} aria-label="Share link" onFocus={(e) => e.target.select()} />
        <button type="button" className="btn" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <button type="button" className="link-button share__reset" onClick={reset} disabled={busy}>
        {busy ? 'Making a new link…' : 'Make a new link (stops the old one)'}
      </button>
      <FormErrors errors={errors} />
    </section>
  );
}
