import { Link, Outlet, useParams } from 'react-router-dom';
import { TableProvider, useTable } from '../state/TableContext.jsx';
import TopBar from '../components/TopBar.jsx';
import NavBar from '../components/NavBar.jsx';

/** A character opened from its share link: every tab, read-only, no sign-in needed. */
export default function SharedSheetPage() {
  const { shareId } = useParams();
  return (
    <TableProvider key={shareId} shareId={shareId}>
      <ViewOnlyShell
        crumbs={(name) => [{ label: 'Shared sheet' }, { label: name }]}
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
        crumbs={(name, campaignName) => [
          { label: 'Campaigns', to: '/home' },
          { label: campaignName ?? 'Campaign', to: `/campaigns/${id}` },
          { label: name },
        ]}
        missing={<>This character isn't in the campaign, or you aren't. <Link to={`/campaigns/${id}`}>Back to the campaign</Link></>}
      />
    </TableProvider>
  );
}

/** The frame around someone else's sheet: a top bar, the tabs, nothing to change. */
function ViewOnlyShell({ crumbs, missing }) {
  const { loading, notFound, character, campaignName } = useTable();
  return (
    <div className="app app--play">
      <TopBar crumbs={crumbs(character?.name ?? 'Character', campaignName)} actions={<span className="tag tag--view">View only</span>} />
      {!loading && !notFound && <NavBar />}

      <main className="app__main">
        {loading && <p className="muted italic center">Summoning the sheet…</p>}
        {notFound && <p className="muted italic center">{missing}</p>}
        {!loading && !notFound && <Outlet />}
      </main>
    </div>
  );
}
