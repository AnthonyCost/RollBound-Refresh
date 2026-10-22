import { NavLink } from 'react-router-dom';

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
};

const LINKS = [
  { to: '/', label: 'Sheet', icon: 'sheet', end: true },
  { to: '/turn', label: 'Turn', icon: 'turn' },
  { to: '/roll', label: 'Roll', icon: 'roll' },
  { to: '/gm', label: 'GM', icon: 'gm' },
];

export default function NavBar() {
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.end}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            {icon[l.icon]}
          </svg>
          {l.label.toUpperCase()}
        </NavLink>
      ))}
    </nav>
  );
}
