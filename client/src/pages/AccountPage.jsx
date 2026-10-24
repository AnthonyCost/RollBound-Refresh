import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';
import PageShell from '../components/PageShell.jsx';
import ImagePicker from '../components/ImagePicker.jsx';
import Avatar from '../components/Avatar.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';

export default function AccountPage() {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [avatar, setAvatar] = useState({});
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState(null);
  const [saved, setSaved] = useState(false);
  const { state } = useLocation();

  const back = <Link to="/home" className="topbar__signout">Hub</Link>;

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
    <PageShell actions={back}>
      <header className="builder__header">
        <Avatar url={user.avatarUrl} name={user.displayName} size={88} className="avatar--hero" />
        <h1 className="title">{user.displayName}</h1>
        <span className="rule-note">{user.isDemo ? 'Temporary demo account' : user.email}</span>
      </header>

      {state?.avatarFailed && !saved && (
        <p className="panel panel--hot center narrow" role="status">
          Your account is ready, but the profile picture didn't upload. Try adding it again below.
        </p>
      )}

      <form className="form narrow" onSubmit={submit}>
        <label className="form-field">
          <span>Display name</span>
          <input value={displayName} required maxLength={60} onChange={(e) => setDisplayName(e.target.value)} />
          <small className="muted italic">Shown to your party and GMs.</small>
        </label>

        <ImagePicker
          label="Profile image"
          shape="square"
          maxMb={2}
          hint="square images work best"
          value={avatar}
          currentUrl={user.avatarUrl}
          onChange={setAvatar}
        />

        <FormErrors errors={errors} />
        {saved && <p className="rule-note center" role="status">Profile saved.</p>}
        <button type="submit" className="btn btn--blood" disabled={Boolean(status) || !displayName.trim()}>
          {status ?? 'Save profile'}
        </button>
      </form>
    </PageShell>
  );
}
