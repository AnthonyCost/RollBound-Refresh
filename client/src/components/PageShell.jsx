import { Link } from 'react-router-dom';
import AccountLink from './AccountLink.jsx';
import DemoBanner from './DemoBanner.jsx';

/** The standard page frame: wordmark, optional actions on the right, demo banner, content. */
export default function PageShell({ actions, children }) {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/home" className="wordmark">ROLLBOUND</Link>
        <div className="topbar__right">
          <AccountLink />
          {actions}
        </div>
      </header>
      <DemoBanner />
      <main className="app__main">{children}</main>
    </div>
  );
}
