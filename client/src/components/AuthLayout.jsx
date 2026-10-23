import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import Ornament from './Ornament.jsx';

export default function AuthLayout({ title, children }) {
  const { enterDemo } = useAuth();
  const navigate = useNavigate();

  const startDemo = () => {
    enterDemo();
    navigate('/home', { replace: true });
  };

  return (
    <div className="app">
      <main className="auth">
        <header className="auth__header">
          <span className="wordmark auth__wordmark">ROLLBOUND</span>
          <p className="italic muted center auth__tagline">A Pathfinder 2e companion that teaches the rules while you play.</p>
        </header>

        <section className="panel auth__panel">
          <h1 className="panel__title">{title}</h1>
          {children}
        </section>

        <Ornament label="OR" />

        <div className="auth__demo">
          <button type="button" className="btn" onClick={startDemo}>Try the demo</button>
          <p className="italic muted center auth__note">No account needed. Play as Mira, a level 1 fighter.</p>
        </div>
      </main>
    </div>
  );
}
