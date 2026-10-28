import { Routes, Route, Navigate, Link, Outlet, useParams } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import SheetPage from './pages/SheetPage.jsx';
import TurnPage from './pages/TurnPage.jsx';
import RollPage from './pages/RollPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import HomePage from './pages/HomePage.jsx';
import CharactersPage from './pages/CharactersPage.jsx';
import CampaignsPage from './pages/CampaignsPage.jsx';
import BuilderPage from './pages/BuilderPage.jsx';
import CampaignCreatePage from './pages/CampaignCreatePage.jsx';
import CampaignLayout, { CampaignOverview } from './pages/CampaignPage.jsx';
import { SessionLogEditor, SessionLogPage, SessionLogsPage } from './pages/SessionLogPages.jsx';
import { EncounterEditor, EncounterListPage } from './pages/EncountersPage.jsx';
import BestiaryPage from './pages/BestiaryPage.jsx';
import { CreatureByIdPage } from './pages/CreaturePage.jsx';
import CampaignEditPage from './pages/CampaignEditPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import SharedSheetPage, { PartySheetPage } from './pages/SharedSheetPage.jsx';
import CharacterSpellsPage from './pages/CharacterSpellsPage.jsx';
import CharacterFeatsPage from './pages/CharacterFeatsPage.jsx';
import SpellBookPage, { SpellByIdPage } from './pages/SpellBookPages.jsx';
import ArmoryPage, { ItemPage } from './pages/ArmoryPages.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import LorePage from './pages/LorePage.jsx';
import LearnPage from './pages/LearnPage.jsx';
import ResourcesPage from './pages/ResourcesPage.jsx';
import { TableProvider, useTable } from './state/TableContext.jsx';
import { useAuth } from './state/AuthContext.jsx';
import TopBar from './components/TopBar.jsx';
import SheetBackdrop from './components/SheetBackdrop.jsx';
import DemoBanner from './components/DemoBanner.jsx';

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
  const { round, loading, notFound, encounterActive, character } = useTable();

  return (
    <div className="app app--play">
      <TopBar
        crumbs={[{ label: 'Characters', to: '/characters' }, { label: character?.name ?? 'Character' }]}
        actions={encounterActive && <span className="eyebrow">Round {round}</span>}
      />

      {!notFound && <NavBar />}
      {!loading && !notFound && <SheetBackdrop />}
      <DemoBanner />

      <main className="app__main">
        {loading && <p className="muted italic center">Summoning your character…</p>}
        {notFound && (
          <p className="muted italic center">
            That character isn't on your roster. <Link to="/characters">Back to your characters</Link>
          </p>
        )}
        {!loading && !notFound && <Outlet />}
      </main>
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
        <Route path="/home" element={<HomePage />} />
        <Route path="/characters" element={<CharactersPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/create" element={<BuilderPage />} />
        <Route path="/characters/:characterId/edit" element={<BuilderPage />} />
        <Route path="/bestiary" element={<BestiaryPage />} />
        <Route path="/spells" element={<SpellBookPage />} />
        <Route path="/armory" element={<ArmoryPage />} />
        <Route path="/armory/:slug" element={<ItemPage />} />
        <Route path="/spells/id/:spellId" element={<SpellByIdPage />} />
        <Route path="/spells/:slug" element={<SpellBookPage />} />
        <Route path="/bestiary/creature/:creatureId" element={<CreatureByIdPage />} />
        <Route path="/bestiary/:book/:slug" element={<BestiaryPage />} />
        <Route path="/campaigns/new" element={<CampaignCreatePage />} />
        <Route path="/campaigns/:id" element={<CampaignLayout />}>
          <Route index element={<CampaignOverview />} />
          <Route path="logs" element={<SessionLogsPage />} />
          <Route path="logs/new" element={<SessionLogEditor />} />
          <Route path="logs/:logId" element={<SessionLogPage />} />
          <Route path="logs/:logId/edit" element={<SessionLogEditor />} />
          <Route path="encounters" element={<EncounterListPage />} />
          <Route path="encounters/new" element={<EncounterEditor />} />
          <Route path="encounters/:encounterId" element={<EncounterEditor key="edit" />} />
        </Route>
        <Route path="/campaigns/:id/edit" element={<CampaignEditPage />} />
        {/* A party member's sheet; the server only shows it to the GM and the party. */}
        <Route path="/campaigns/:id/characters/:characterId" element={<PartySheetPage />}>
          <Route index element={<Navigate to="sheet" replace />} />
          <Route path="sheet" element={<SheetPage />} />
          <Route path="feats" element={<CharacterFeatsPage />} />
          <Route path="spells" element={<CharacterSpellsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="lore" element={<LorePage />} />
        </Route>
        <Route path="/play/:characterId" element={<Play />}>
          <Route index element={<Navigate to="sheet" replace />} />
          <Route path="sheet" element={<SheetPage />} />
          <Route path="feats" element={<CharacterFeatsPage />} />
          <Route path="spells" element={<CharacterSpellsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="lore" element={<LorePage />} />
          <Route path="turn" element={<EncounterOnly><TurnPage /></EncounterOnly>} />
          <Route path="roll" element={<EncounterOnly><RollPage /></EncounterOnly>} />
        </Route>
      </Route>
      {/* Anyone with a share link, signed in or not. */}
      {/* Open to everyone, signed in or not. */}
      <Route path="/learn" element={<Navigate to="/learn/overview" replace />} />
      <Route path="/learn/:topic" element={<LearnPage />} />
      <Route path="/resources" element={<ResourcesPage />} />
      <Route path="/sheets/:shareId" element={<SharedSheetPage />}>
        <Route index element={<Navigate to="sheet" replace />} />
        <Route path="sheet" element={<SheetPage />} />
        <Route path="feats" element={<CharacterFeatsPage />} />
        <Route path="spells" element={<CharacterSpellsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="lore" element={<LorePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
