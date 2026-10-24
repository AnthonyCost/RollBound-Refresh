import { Routes, Route, Navigate, Link, Outlet, useParams } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import SheetPage from './pages/SheetPage.jsx';
import TurnPage from './pages/TurnPage.jsx';
import RollPage from './pages/RollPage.jsx';
import GmPage from './pages/GmPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import HubPage from './pages/HubPage.jsx';
import BuilderPage from './pages/BuilderPage.jsx';
import CampaignCreatePage from './pages/CampaignCreatePage.jsx';
import CampaignPage from './pages/CampaignPage.jsx';
import CampaignEditPage from './pages/CampaignEditPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import SharedSheetPage from './pages/SharedSheetPage.jsx';
import SpellBookPage from './pages/SpellBookPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import LorePage from './pages/LorePage.jsx';
import { TableProvider, useTable } from './state/TableContext.jsx';
import { useAuth } from './state/AuthContext.jsx';
import AccountLink from './components/AccountLink.jsx';

function Loading() {
  return (
    <div className="app">
      <p className="muted italic center" style={{ marginTop: '30vh' }}>Summoning…</p>
    </div>
  );
}

function SignedOutOnly() {
  const { status } = useAuth();
  if (status === 'loading') return <Loading />;
  if (status !== 'signedOut') return <Navigate to="/home" replace />;
  return <Outlet />;
}

function SignedInOnly() {
  const { status } = useAuth();
  if (status === 'loading') return <Loading />;
  if (status === 'signedOut') return <Navigate to="/" replace />;
  return <Outlet />;
}

function Play() {
  const { characterId } = useParams();
  return (
    <TableProvider key={characterId} characterId={characterId}>
      <PlayShell />
    </TableProvider>
  );
}

/** Turn, Roll and GM screens: only during an active encounter, otherwise the sheet. */
function EncounterOnly({ children }) {
  const { encounterActive } = useTable();
  return encounterActive ? children : <Navigate to="../sheet" replace />;
}

function PlayShell() {
  const { round, loading, notFound, encounterActive } = useTable();
  const { isDemo } = useAuth();

  return (
    <div className="app app--play">
      <header className="topbar">
        <Link to="/home" className="wordmark">ROLLBOUND</Link>
        <div className="topbar__right">
          {encounterActive && <span className="eyebrow">Round {round}</span>}
          <AccountLink />
          <Link to="/home" className="topbar__signout">Hub</Link>
        </div>
      </header>

      {isDemo && <p className="demo-banner">Demo mode · nothing you do here is saved</p>}

      <main className="app__main">
        {loading && <p className="muted italic center">Summoning your character…</p>}
        {notFound && (
          <p className="muted italic center">
            That character isn't on your roster. <Link to="/home">Back to the hub</Link>
          </p>
        )}
        {!loading && !notFound && <Outlet />}
      </main>

      {!notFound && <NavBar />}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<SignedOutOnly />}>
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<SignedInOnly />}>
        <Route path="/home" element={<HubPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/create" element={<BuilderPage />} />
        <Route path="/characters/:characterId/edit" element={<BuilderPage />} />
        <Route path="/campaigns/new" element={<CampaignCreatePage />} />
        <Route path="/campaigns/:id" element={<CampaignPage />} />
        <Route path="/campaigns/:id/edit" element={<CampaignEditPage />} />
        <Route path="/play/:characterId" element={<Play />}>
          <Route index element={<Navigate to="sheet" replace />} />
          <Route path="sheet" element={<SheetPage />} />
          <Route path="spells" element={<SpellBookPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="lore" element={<LorePage />} />
          <Route path="turn" element={<EncounterOnly><TurnPage /></EncounterOnly>} />
          <Route path="roll" element={<EncounterOnly><RollPage /></EncounterOnly>} />
          <Route path="gm" element={<EncounterOnly><GmPage /></EncounterOnly>} />
        </Route>
      </Route>
      {/* Anyone with a share link, signed in or not. */}
      <Route path="/sheets/:shareId" element={<SharedSheetPage />}>
        <Route index element={<Navigate to="sheet" replace />} />
        <Route path="sheet" element={<SheetPage />} />
        <Route path="spells" element={<SpellBookPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="lore" element={<LorePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
