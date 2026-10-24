import { useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import Icon from './Icon.jsx';

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
  // Home is highlighted on the hub; the hub's two modes are plain links into it.
  const link = (to, icon, label) => {
    const Tag = to.includes('?') ? Link : NavLink;
    return (
      <Tag to={to} end className="sidenav__link" onClick={onClose}>
        <Icon name={icon} /> {label}
      </Tag>
    );
  };
  return (
    <div className="sidenav" role="presentation">
      <div className="sidenav__backdrop" onClick={onClose} />
      <nav ref={panel} className="sidenav__panel" role="dialog" aria-modal="true" aria-label="Main menu">
        <div className="sidenav__head">
          <Link to="/home" className="sidenav__brand" onClick={onClose}>
            <span className="wordmark">ROLLBOUND</span>
          </Link>
          <button type="button" className="icon-button" aria-label="Close menu" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {link('/home', 'home', 'Home')}
        {link('/home?mode=player', 'shield', 'Your characters')}
        {link('/home?mode=gm', 'map', 'Your campaigns')}
        {link('/bestiary', 'book', 'Bestiary')}
        <div className="sidenav__divider" />
        {link('/create', 'plus', 'New character')}
        {link('/campaigns/new', 'plus', 'New campaign')}
        <div className="sidenav__divider" />
        {user && link('/account', 'user', 'Your account')}
        <button
          type="button"
          className="sidenav__link"
          onClick={() => {
            onClose();
            logout();
          }}
        >
          <Icon name="close" /> {isDemo ? 'Exit demo' : 'Sign out'}
        </button>
      </nav>
    </div>
  );
}
