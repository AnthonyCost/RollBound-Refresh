import { Link, Outlet, useParams } from 'react-router-dom';
import { TableProvider, useTable } from '../state/TableContext.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import NavBar from '../components/NavBar.jsx';

/** A character opened from its share link: every tab, read-only, no sign-in needed. */
export default function SharedSheetPage() {
  const { shareId } = useParams();
  const { status } = useAuth();
  const signedIn = status === 'user';
  return (
    <TableProvider key={shareId} shareId={shareId}>
      <ViewOnlyShell
        label="Shared sheet · view only"
        back={<Link to={signedIn ? '/home' : '/'} className="topbar__signout">{signedIn ? 'Hub' : 'Sign in'}</Link>}
        missing="This sheet link doesn't work. Its owner may have made a new one; ask them for the latest link."
      />
    </TableProvider>
  );
}

/** A party member's sheet from the campaign page: read-only, for the GM and the party. */
export function PartySheetPage() {
  const { id, characterId } = useParams();
  return (
    <TableProvider key={`${id}/${characterId}`} party={{ campaignId: id, characterId }}>
      <ViewOnlyShell
        label="Party sheet · view only"
        back={<Link to={`/campaigns/${id}`} className="topbar__signout">Campaign</Link>}
        missing={<>This character isn't in the campaign, or you aren't. <Link to={`/campaigns/${id}`}>Back to the campaign</Link></>}
      />
    </TableProvider>
  );
}

/** The frame around someone else's sheet: a top bar, the tabs, nothing to change. */
function ViewOnlyShell({ label, back, missing }) {
  const { loading, notFound } = useTable();
  return (
    <div className="app app--play">
      <header className="topbar">
        <Link to="/" className="wordmark">ROLLBOUND</Link>
        <div className="topbar__right">
          <span className="eyebrow">{label}</span>
          {back}
        </div>
      </header>

      <main className="app__main">
        {loading && <p className="muted italic center">Summoning the sheet…</p>}
        {notFound && <p className="muted italic center">{missing}</p>}
        {!loading && !notFound && <Outlet />}
      </main>

      {!loading && !notFound && <NavBar />}
    </div>
  );
}
