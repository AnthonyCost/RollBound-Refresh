import { useState } from 'react';

/** Shows a campaign's invite code with copy and (for the GM) regenerate controls. */
export default function InviteCode({ code, onRegenerate }) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. insecure context): the code is selectable text, so the player can copy it by hand.
      setCopied(false);
    }
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      await onRegenerate();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <section className="panel invite">
      <h2 className="panel__title">Invite code</h2>
      <p className="invite__code" aria-label={`Invite code ${code.split('').join(' ')}`}>{code}</p>
      <p className="rule-note center">Players enter this code on their hub to bring a character into your campaign.</p>
      <div className="btn-row">
        <button type="button" className="btn btn--blood btn--grow" onClick={copy}>
          {copied ? 'Copied' : 'Copy code'}
        </button>
        {onRegenerate && !confirming && (
          <button type="button" className="btn" onClick={() => setConfirming(true)}>New code</button>
        )}
      </div>
      <span className="visually-hidden" aria-live="polite">{copied ? 'Invite code copied' : ''}</span>
      {confirming && (
        <div className="confirm confirm--inline" role="alertdialog" aria-label="Replace invite code">
          <p>Make a new code? The current one stops working right away. Characters already in the campaign stay.</p>
          <div className="btn-row">
            <button type="button" className="btn btn--grow" onClick={() => setConfirming(false)}>Keep this code</button>
            <button type="button" className="btn btn--blood btn--grow" disabled={busy} onClick={regenerate}>
              {busy ? 'Replacing…' : 'Replace code'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
