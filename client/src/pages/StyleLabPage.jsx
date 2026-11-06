import { Link, useSearchParams } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import StyleLabPalette from './StyleLabPalette.jsx';
import StyleLabDice from './StyleLabDice.jsx';
import Icon from '../components/Icon.jsx';
import './styleLab.css';

/*
 * Style lab: the site's color themes on its real components, and every die. Nothing here is
 * saved, and no other page uses this file or styleLab.css, so deleting the lab's files and the
 * /style-lab route removes it completely.
 */

const TABS = [
  { id: 'palette', label: 'Themes', icon: 'spark' },
  { id: 'dice', label: 'Dice', icon: 'roll' },
];

/** The lab's tabs, as the site's own tab bar; the tab lives in the URL (?tab=palette) so it can be linked. */
function LabTabs({ tab }) {
  return (
    <nav className="nav" aria-label="Style lab">
      {TABS.map((t) => (
        <Link key={t.id} to={t.id === 'palette' ? '/style-lab' : `/style-lab?tab=${t.id}`} className={tab === t.id ? 'active' : undefined} aria-current={tab === t.id ? 'page' : undefined}>
          <Icon name={t.icon} size={22} />
          {t.label.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}

export default function StyleLabPage() {
  const [params] = useSearchParams();
  // Themes is the default; an old ?tab=proposals link lands there too.
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'palette';
  return (
    <PageShell crumbs={[{ label: 'Style lab' }]} tabs={<LabTabs tab={tab} />}>
      <div className="lab">
        <header className="lab-intro">
          <h1 className="x-title">Style lab</h1>
          <p className="x-body">
            {tab === 'dice'
              ? 'Every die in the current theme. Click one to roll it.'
              : 'A color scheme to try on RollBound, shown on the site’s real components. Nothing here is live anywhere else on the site.'}
          </p>
        </header>

        {tab === 'dice' ? <StyleLabDice /> : <StyleLabPalette />}
      </div>
    </PageShell>
  );
}
