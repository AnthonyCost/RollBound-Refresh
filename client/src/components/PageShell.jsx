import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import AccountLink from './AccountLink.jsx';

/** The standard page frame: wordmark, optional actions on the right, demo banner, content. */
export default function PageShell({ actions, children }) {
  const { isDemo } = useAuth();
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/home" className="wordmark">ROLLBOUND</Link>
        <div className="topbar__right">
          <AccountLink />
          {actions}
        </div>
      </header>
      {isDemo && <p className="demo-banner">Demo mode · nothing you do here is saved</p>}
      <main className="app__main">{children}</main>
    </div>
  );
}
