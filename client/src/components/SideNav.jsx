import { useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';

/** The ☰ menu: a panel from the left with the main places, like GitHub's. */
export default function SideNav({ open, onClose }) {
  const { user, isDemo, logout } = useAuth();
  const panel = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    panel.current?.querySelector('.sidenav__link')?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const link = (to, icon, label, end = true) => (
    <NavLink to={to} end={end} className="sidenav__link" onClick={onClose}>
      <Icon name={icon} /> {label}
    </NavLink>
  );
  return (
    <div className="sidenav" role="presentation">
      <div className="sidenav__backdrop" onClick={onClose} />
      <nav ref={panel} className="sidenav__panel" role="dialog" aria-modal="true" aria-label="Main menu">
        <div className="sidenav__head">
          <Link to="/home" className="sidenav__brand" onClick={onClose}>
            <span className="wordmark">ROLLBOUND <Logo /></span>
          </Link>
          <button type="button" className="icon-button" aria-label="Close menu" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {link('/home', 'home', 'Home')}
        {link('/characters', 'shield', 'Characters')}
        {link('/campaigns', 'map', 'Campaigns')}
        {link('/bestiary', 'bestiary', 'Bestiary')}
        {link('/spells', 'spells', 'Spell Book')}
        {link('/armory', 'armory', 'Armory', false)}
        {link('/learn', 'learn', 'Learning The Game', false)}
        {link('/resources', 'links', 'Resources')}
        <div className="sidenav__divider" />
        {link('/create', 'plus', 'New Character')}
        {link('/campaigns/new', 'plus', 'New Campaign')}
        <div className="sidenav__divider" />
        {user && link('/account', 'user', 'Your Account')}
        <button
          type="button"
          className="sidenav__link"
          onClick={() => {
            onClose();
            logout();
          }}
        >
          <Icon name="exit" /> {isDemo ? 'Exit Demo' : 'Sign Out'}
        </button>
      </nav>
    </div>
  );
}
