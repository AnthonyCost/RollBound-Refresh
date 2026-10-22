import { Routes, Route, Navigate, Link } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import SheetPage from './pages/SheetPage.jsx';
import TurnPage from './pages/TurnPage.jsx';
import RollPage from './pages/RollPage.jsx';
import GmPage from './pages/GmPage.jsx';
import { useTable } from './state/TableContext.jsx';

export default function App() {
  const { round, loading } = useTable();

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="wordmark">ROLLBOUND</Link>
        <span className="eyebrow">Round {round}</span>
      </header>

      <main className="app__main">
        {loading ? (
          <p className="muted italic center">Summoning your character…</p>
        ) : (
          <Routes>
            <Route path="/" element={<SheetPage />} />
            <Route path="/turn" element={<TurnPage />} />
            <Route path="/roll" element={<RollPage />} />
            <Route path="/gm" element={<GmPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>

      <NavBar />
    </div>
  );
}
