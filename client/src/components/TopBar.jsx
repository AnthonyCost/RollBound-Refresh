import { Fragment, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import Inbox from './Inbox.jsx';
import Menu from './Menu.jsx';
import SideNav from './SideNav.jsx';

/**
 * The header on every signed-in page, laid out like GitHub's: the ☰ menu, the
 * ROLLBOUND wordmark, and breadcrumbs on the left (crumbs: [{ label, to }], the last is where
 * you are); page actions, the + menu, the inbox and your account on the right.
 * Signed out (a shared sheet), it shows just the wordmark, crumbs and Sign in.
 */
export default function TopBar({ crumbs = [], actions }) {
  const { user, isDemo, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <header className="topbar">
      <div className="topbar__left">
        {user && (
          <button type="button" className="icon-button" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Icon name="menu" />
          </button>
        )}
        {/* On phones, pages with crumbs show the crumb instead, to leave it room. */}
        <Link to={user ? '/home' : '/'} className={`wordmark topbar__wordmark ${crumbs.length ? 'topbar__wordmark--with-crumbs' : ''}`}>
          ROLLBOUND <Logo />
        </Link>
        {crumbs.length > 0 && (
          <nav className="crumbs" aria-label="Breadcrumb">
            <ol>
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <Fragment key={`${c.label}-${i}`}>
                    {i > 0 && <li className="crumbs__sep" aria-hidden="true">/</li>}
                    <li className={`crumbs__item ${last ? 'crumbs__item--current' : ''}`}>
                      {c.to && !last ? <Link to={c.to}>{c.label}</Link> : <span aria-current={last ? 'page' : undefined}>{c.label}</span>}
                    </li>
                  </Fragment>
                );
              })}
            </ol>
          </nav>
        )}
      </div>

      <div className="topbar__right">
        {actions}
        {user ? (
          <>
            <Menu
              label="Create new"
              className="menu--create"
              button={
                <>
                  <Icon name="plus" size={18} />
                  <Icon name="caret" size={14} />
                </>
              }
              items={[
                { label: 'New Character', to: '/create' },
                { label: 'New Campaign', to: '/campaigns/new' },
              ]}
            />
            <Inbox />
            <Menu
              label="Your account"
              className="menu--account"
              button={<Avatar url={user.avatarUrl} name={user.displayName} size={32} />}
              header={
                <>
                  <strong>{user.displayName}</strong>
                  <span className="muted">{isDemo ? 'Temporary Demo Account' : user.email}</span>
                </>
              }
              items={[
                { label: 'Your Account', to: '/account' },
                { label: 'Home', to: '/home' },
                { label: 'Characters', to: '/characters' },
                { label: 'Campaigns', to: '/campaigns' },
                'divider',
                { label: isDemo ? 'Exit Demo' : 'Sign Out', onClick: logout },
              ]}
            />
          </>
        ) : (
          <Link to="/" className="btn btn--small">Sign in</Link>
        )}
      </div>
      <SideNav open={menuOpen} onClose={closeMenu} />
    </header>
  );
}
