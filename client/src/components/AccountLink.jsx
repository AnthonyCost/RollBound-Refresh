import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import Avatar from './Avatar.jsx';

/** Your avatar and name in the top bar, linking to the Account page. Hidden in demo mode. */
export default function AccountLink() {
  const { user, isDemo } = useAuth();
  const { pathname } = useLocation();
  if (isDemo || !user || pathname === '/account') return null;
  return (
    <Link to="/account" className="topbar__account" aria-label="Your account">
      <Avatar url={user.avatarUrl} name={user.displayName} size={32} />
      <span className="topbar__account-name">{user.displayName}</span>
    </Link>
  );
}
