import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import Avatar from './Avatar.jsx';
import Inbox from './Inbox.jsx';

/** The inbox, then your avatar and name linking to the Account page (except on it). */
export default function AccountLink() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  return (
    <>
      <Inbox />
      {user && pathname !== '/account' && (
        <Link to="/account" className="topbar__account" aria-label="Your account">
          <Avatar url={user.avatarUrl} name={user.displayName} size={32} />
          <span className="topbar__account-name">{user.displayName}</span>
        </Link>
      )}
    </>
  );
}
