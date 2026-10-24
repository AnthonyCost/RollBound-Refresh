import { Link, useParams } from 'react-router-dom';
import { TableProvider, useTable } from '../state/TableContext.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import SheetPage from './SheetPage.jsx';

/** A character sheet opened from its share link: read-only, no sign-in needed. */
export default function SharedSheetPage() {
  const { shareId } = useParams();
  return (
    <TableProvider key={shareId} shareId={shareId}>
      <SharedSheet />
    </TableProvider>
  );
}

function SharedSheet() {
  const { loading, notFound } = useTable();
  const { status } = useAuth();
  const signedIn = status === 'user' || status === 'demo';

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="wordmark">ROLLBOUND</Link>
        <div className="topbar__right">
          <span className="eyebrow">Shared sheet · view only</span>
          <Link to={signedIn ? '/home' : '/'} className="topbar__signout">{signedIn ? 'Hub' : 'Sign in'}</Link>
        </div>
      </header>

      <main className="app__main">
        {loading && <p className="muted italic center">Summoning the sheet…</p>}
        {notFound && (
          <p className="muted italic center">
            This sheet link doesn't work. Its owner may have made a new one; ask them for the latest link.
          </p>
        )}
        {!loading && !notFound && <SheetPage />}
      </main>
    </div>
  );
}
