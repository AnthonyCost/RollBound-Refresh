import { NavLink } from 'react-router-dom';
import { useTable } from '../state/TableContext.jsx';

const icon = {
  sheet: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  turn: (
    <>
      <path d="M6 12l3-3 3 3-3 3z" />
      <path d="M13 12l3-3 3 3-3 3z" />
    </>
  ),
  roll: (
    <>
      <path d="M12 2l9 5v10l-9 5-9-5V7z" />
      <path d="M12 2v20M3 7l18 10M21 7L3 17" />
    </>
  ),
  gm: <path d="M4 6h16M4 12h16M4 18h10" />,
  spells: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5M19 19v2H6M12 7l1 2 2 .5-1.5 1.5.5 2-2-1-2 1 .5-2L9 9.5l2-.5z" />
    </>
  ),
  inventory: (
    <>
      <path d="M6 8h12l-1 12H7z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  lore: (
    <>
      <path d="M7 4h11a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h1z" />
      <path d="M10 9h4M10 13h4" />
    </>
  ),
};

// encounter: shown only while the character is in an active encounter.
const LINKS = [
  { to: 'sheet', label: 'Sheet', icon: 'sheet' },
  { to: 'spells', label: 'Spell Book', icon: 'spells' },
  { to: 'inventory', label: 'Inventory', icon: 'inventory' },
  { to: 'lore', label: 'Lore', icon: 'lore' },
  { to: 'turn', label: 'Turn', icon: 'turn', encounter: true },
  { to: 'roll', label: 'Roll', icon: 'roll', encounter: true },
  { to: 'gm', label: 'GM', icon: 'gm', encounter: true },
];

export default function NavBar() {
  const { encounterActive } = useTable();
  const links = LINKS.filter((l) => encounterActive || !l.encounter);
  return (
    <nav className="nav" aria-label="Main" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
      {links.map((l) => (
        <NavLink key={l.to} to={l.to}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            {icon[l.icon]}
          </svg>
          {l.label.toUpperCase()}
        </NavLink>
      ))}
    </nav>
  );
}
