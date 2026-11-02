import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import Logo from './Logo.jsx';
import Ornament from './Ornament.jsx';
import FormErrors, { errorsFrom } from './FormErrors.jsx';
import art from '../assets/auth-art.webp';
import wideArt from '../assets/auth-art-wide.webp';

/**
 * The sign-in and create-account screens: full-screen art with the form in a dark
 * card over it (beside the art on wide screens), laid out like D&D Beyond's sign-in.
 * long tightens the card, for a form with more fields.
 */
export default function AuthLayout({ title, long = false, children }) {
  const { enterDemo, endedReason } = useAuth();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);

  const startDemo = async () => {
    setBusy(true);
    setErrors([]);
    try {
      await enterDemo();
      navigate('/home', { replace: true });
    } catch (err) {
      setErrors(errorsFrom(err));
      setBusy(false);
    }
  };

  return (
    <div className="app app--auth">
      {/* Tablets and desktops get the wide painting; phones keep the tall one, framed on the dragon. */}
      <div className="auth__art" aria-hidden="true">
        <picture>
          <source media="(min-width: 768px)" srcSet={wideArt} />
          <img src={art} alt="" />
        </picture>
      </div>
      <main className={`auth ${long ? 'auth--long' : ''}`}>
        <header className="auth__header">
          <span className="wordmark auth__wordmark">ROLLBOUND <Logo /></span>
          <p className="italic muted center auth__tagline">A Pathfinder 2e companion that teaches the rules while you play.</p>
        </header>

        {endedReason && (
          <p className="panel panel--hot center auth__ended" role="status">
            {endedReason === 'demo'
              ? 'Your demo has ended, and everything in it was deleted. Start a new one, or create an account to keep what you build.'
              : 'You were signed out. Sign in again to pick up where you left off.'}
          </p>
        )}

        <section className="auth__panel">
          <h1 className="panel__title">{title}</h1>
          {children}
        </section>

        <Ornament label="OR" />

        <div className="auth__demo">
          <button type="button" className="btn" onClick={startDemo} disabled={busy}>{busy ? 'Setting up your demo…' : 'Try the demo'}</button>
          <p className="italic muted center auth__note">
            No sign-up needed. You get a temporary account with a character of every class and campaigns to run and join. It's deleted after a day.
          </p>
          <FormErrors errors={errors} />
        </div>
      </main>
    </div>
  );
}
