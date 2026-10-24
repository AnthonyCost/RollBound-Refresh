import TopBar from './TopBar.jsx';
import DemoBanner from './DemoBanner.jsx';

/** The standard page frame: the header (with breadcrumbs and page actions), demo banner, content. */
export default function PageShell({ crumbs, actions, children }) {
  return (
    <div className="app">
      <TopBar crumbs={crumbs} actions={actions} />
      <DemoBanner />
      <main className="app__main">{children}</main>
    </div>
  );
}
