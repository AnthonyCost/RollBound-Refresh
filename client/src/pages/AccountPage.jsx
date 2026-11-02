import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';
import PageShell from '../components/PageShell.jsx';
import ImagePicker from '../components/ImagePicker.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
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

  return (
    <PageShell crumbs={[{ label: 'Your account' }]}>
      <div className="account">
        <header className="sheet-panel account__hero">
          <Avatar url={user.avatarUrl} name={user.displayName} size={104} className="avatar--hero" />
          <div className="account__who">
            <span className="eyebrow">{isDemo ? 'Demo account' : 'Your account'}</span>
            <h1 className="title">{user.displayName}</h1>
            <span className="muted italic">{isDemo ? 'Temporary, and deleted when you exit' : user.email}</span>
          </div>
          <nav className="account__stats" aria-label="Your table">
            {stats.map((s) => (
              <Link key={s.label} to={s.to} className="account__stat">
                <Icon name={s.icon} size={22} />
                <strong>{s.value ?? '–'}</strong>
                <span>{s.label}</span>
              </Link>
            ))}
          </nav>
        </header>

        {state?.avatarFailed && !saved && (
          <p className="panel panel--hot center" role="status">
            Your account is ready, but the profile picture didn't upload. Try adding it again below.
          </p>
        )}

        <div className="account__grid">
          <form className="sheet-panel form account__profile" onSubmit={submit}>
            <h2 className="sheet-panel__title">Profile</h2>
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

          <section className="sheet-panel account__session">
            <h2 className="sheet-panel__title">{isDemo ? 'Your demo' : 'Session'}</h2>
            <p className="muted">
              {isDemo
                ? 'Exiting deletes this account and everything in it. Create an account to keep what you build.'
                : 'Signing out keeps everything safe for your next visit.'}
            </p>
            <button type="button" className="btn" onClick={logout}>
              <Icon name="exit" size={18} /> {isDemo ? 'Exit demo' : 'Sign out'}
            </button>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
