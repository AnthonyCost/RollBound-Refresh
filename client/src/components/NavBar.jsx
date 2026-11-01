import { NavLink } from 'react-router-dom';
import { useTable } from '../state/TableContext.jsx';
import Icon from './Icon.jsx';

// encounter: shown only while the character is in an active encounter.
const LINKS = [
  { to: 'sheet', label: 'Sheet', icon: 'sheet' },
  { to: 'feats', label: 'Feats', icon: 'feats' },
  { to: 'spells', label: 'Spells', icon: 'spells' },
  { to: 'inventory', label: 'Inventory', icon: 'inventory' },
  { to: 'lore', label: 'Lore', icon: 'lore' },
  { to: 'turn', label: 'Turn', icon: 'turn', encounter: true },
  { to: 'roll', label: 'Roll', icon: 'roll', encounter: true },
];

export default function NavBar() {
  const { encounterActive } = useTable();
  const links = LINKS.filter((l) => encounterActive || !l.encounter);
  return (
    <nav className="nav" aria-label="Main" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
      {links.map((l) => (
        <NavLink key={l.to} to={l.to}>
          <Icon name={l.icon} size={22} />
          {l.label.toUpperCase()}
        </NavLink>
      ))}
    </nav>
  );
}
