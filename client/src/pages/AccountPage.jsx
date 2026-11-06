import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';
import PageShell from '../components/PageShell.jsx';
import ImagePicker from '../components/ImagePicker.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import ThemePicker from '../components/ThemePicker.jsx';
import SettingsMenu from '../components/SettingsMenu.jsx';
import { useCampaignService } from '../state/campaignService.js';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';

export default function AccountPage() {
  const { user, isDemo, updateProfile, logout } = useAuth();
  const service = useCampaignService();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [avatar, setAvatar] = useState({});
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState(null);
  const [saved, setSaved] = useState(false);
  const [section, setSection] = useState('overview');
  const { state } = useLocation();
  // null until loaded, or if loading fails: the counts are a nicety, so they just stay blank.
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listCharacters(), service.list()])
      .then(([characters, campaigns]) => !cancelled && setCounts({ characters: characters.length, running: campaigns.running.length, playing: campaigns.playing.length }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [service]);

  const changed = displayName.trim() !== user.displayName || Boolean(avatar.file || avatar.remove);
  const stats = [
    { to: '/characters', icon: 'shield', label: 'Characters', value: counts?.characters },
    { to: '/campaigns', icon: 'crown', label: 'Campaigns you run', value: counts?.running },
    { to: '/campaigns', icon: 'map', label: 'Campaigns you play', value: counts?.playing },
  ];

  const submit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setSaved(false);
    setStatus(avatar.file ? 'Uploading…' : 'Saving…');
    try {
      const changes = { displayName };
      if (avatar.file) changes.avatarKey = await api.uploadImage(avatar.file, 'avatar');
      else if (avatar.remove) changes.avatarKey = null;
      await updateProfile(changes);
      setAvatar({});
      setSaved(true);
    } catch (err) {
      setErrors(errorsFrom(err));
    } finally {
      setStatus(null);
    }
  };

  const sections = [
    { id: 'overview', label: 'Your table', hint: 'Characters and campaigns', icon: 'crown' },
    { id: 'profile', label: 'Profile', hint: 'Name and picture', icon: 'user' },
    { id: 'theme', label: 'Theme', hint: 'The site’s colors', icon: 'spark' },
    { id: 'session', label: isDemo ? 'Exit demo' : 'Sign out', hint: isDemo ? 'Deletes this demo' : 'See you next time', icon: 'exit', danger: isDemo },
  ];

  return (
    <PageShell crumbs={[{ label: 'Your account' }]}>
      <div className="account">
        <h1 className="visually-hidden">Your account</h1>
        {state?.avatarFailed && !saved && (
          <p className="panel panel--hot center" role="status">
            Your account is ready, but the profile picture didn't upload. Try adding it again in Profile.
          </p>
        )}

        <SettingsMenu
          label="Your account"
          sections={sections}
          active={section}
          onSelect={setSection}
          head={
            <>
              <Avatar url={user.avatarUrl} name={user.displayName} size={52} className="avatar--hero" />
              <div>
                <p className="co__class-name">{user.displayName}</p>
                <p className="co__class-count account__email">{isDemo ? 'Demo account, deleted when you exit' : user.email}</p>
              </div>
            </>
          }
        >
          {section === 'overview' && (
            <>
              <p className="settings-menu__lede">Everything you’ve made and joined. Open one to go there.</p>
              <nav className="account__stats" aria-label="Your table">
                {stats.map((s) => (
                  <Link key={s.label} to={s.to} className="account__stat">
                    <Icon name={s.icon} size={28} />
                    <strong>{s.value ?? '–'}</strong>
                    <span>{s.label}</span>
                  </Link>
                ))}
              </nav>
            </>
          )}

          {section === 'profile' && (
            <form className="form account__profile" onSubmit={submit}>
              <label className="form-field">
                <span>Display name</span>
                <input value={displayName} required maxLength={60} onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }} />
                <small className="muted italic">Shown to your party and GMs.</small>
              </label>

              <ImagePicker
                label="Profile picture"
                shape="avatar"
                maxMb={2}
                hint="square images work best"
                value={avatar}
                currentUrl={user.avatarUrl}
                onChange={(v) => { setAvatar(v); setSaved(false); }}
              />

              <FormErrors errors={errors} />
              <div className="account__save">
                {saved && <span className="field-check field-check--ok" role="status">✓ Profile saved</span>}
                <button type="submit" className="btn btn--blood" disabled={Boolean(status) || !displayName.trim() || !changed}>
                  {status ?? 'Save profile'}
                </button>
              </div>
            </form>
          )}

          {section === 'theme' && <ThemePicker bare />}

          {section === 'session' && (
            <div className={isDemo ? 'settings-menu__danger' : 'account__session'}>
              <p className="settings-menu__lede">
                {isDemo
                  ? 'Exiting deletes this account and everything in it. Create an account to keep what you build.'
                  : 'Signing out keeps everything safe for your next visit.'}
              </p>
              <div className="co__actions">
                <button type="button" className={`btn ${isDemo ? 'settings__delete' : 'btn--blood'}`} onClick={logout}>
                  <Icon name="exit" size={18} /> {isDemo ? 'Exit demo' : 'Sign out'}
                </button>
              </div>
            </div>
          )}
        </SettingsMenu>
      </div>
    </PageShell>
  );
}
