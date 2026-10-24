import { useState } from 'react';

/** Shows a campaign's invite code, for its GM only, with a copy button. Codes are permanent. */
export default function InviteCode({ code }) {
  const [copied, setCopied] = useState(false);

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

  return (
    <section className="panel invite">
      <h2 className="panel__title">Invite code</h2>
      <p className="invite__code" aria-label={`Invite code ${code.split('').join(' ')}`}>{code}</p>
      <p className="rule-note center">
        Players enter this code on their hub to bring a character into your campaign. Only you can see it, and it never changes.
      </p>
      <button type="button" className="btn btn--blood" onClick={copy}>
        {copied ? 'Copied' : 'Copy code'}
      </button>
      <span className="visually-hidden" aria-live="polite">{copied ? 'Invite code copied' : ''}</span>
    </section>
  );
}
