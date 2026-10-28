import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import Logo from './Logo.jsx';
import Ornament from './Ornament.jsx';
import FormErrors, { errorsFrom } from './FormErrors.jsx';

export default function AuthLayout({ title, children }) {
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
      <main className="auth">
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

        <section className="panel auth__panel">
          <h1 className="panel__title">{title}</h1>
          {children}
        </section>

        <Ornament label="OR" />

        <div className="auth__demo">
          <button type="button" className="btn" onClick={startDemo} disabled={busy}>{busy ? 'Setting up your demo…' : 'Try the demo'}</button>
          <p className="italic muted center auth__note">
            No sign-up needed. You get a temporary account with Mira, a level 1 fighter, and a campaign to run. It's deleted after a day.
          </p>
          <FormErrors errors={errors} />
        </div>
      </main>
    </div>
  );
}
