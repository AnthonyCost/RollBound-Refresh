import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';
import ImagePicker from '../components/ImagePicker.jsx';
import { api } from '../api.js';

export default function RegisterPage() {
  const { register, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [avatar, setAvatar] = useState({});
  const [showPasswords, setShowPasswords] = useState(false);
  const passwordType = showPasswords ? 'text' : 'password';
  const longEnough = password.length >= 8;
  const matches = confirm.length > 0 && confirm === password;

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setErrors(["Passwords don't match."]);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      await register(displayName, email, password);
    } catch (err) {
      setErrors(errorsFrom(err));
      setBusy(false);
      return;
    }
    // Uploading needs a signed-in user, so the picture is attached once the account exists.
    // If that part fails, the account is fine; send them to the Account page to retry.
    if (avatar.file) {
      try {
        await updateProfile({ avatarKey: await api.uploadImage(avatar.file, 'avatar') });
      } catch {
        navigate('/account', { replace: true, state: { avatarFailed: true } });
        return;
      }
    }
    navigate('/home', { replace: true });
  };

  return (
    <AuthLayout title="Create account" long>
      <form className="form" onSubmit={submit}>
        <label className="form-field">
          <span>Display name</span>
          <input autoComplete="nickname" required maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="form-field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <div className="form-pair">
          <label className="form-field">
            <span>Password</span>
            <input type={passwordType} autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            <small className={`field-check ${longEnough ? 'field-check--ok' : ''}`}>{longEnough ? '✓ ' : ''}At least 8 characters</small>
          </label>
          <label className="form-field">
            <span>Confirm password</span>
            <input type={passwordType} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <small className={`field-check ${matches ? 'field-check--ok' : ''}`} role="status">
              {matches ? '✓ Passwords match' : confirm ? "Doesn't match yet" : 'Type it again'}
            </small>
          </label>
        </div>
        <label className="field-toggle">
          <input type="checkbox" checked={showPasswords} onChange={(e) => setShowPasswords(e.target.checked)} />
          Show passwords
        </label>
        <ImagePicker
          label="Profile picture (optional)"
          shape="avatar"
          maxMb={2}
          hint="you can change it later"
          value={avatar}
          onChange={setAvatar}
        />
        <FormErrors errors={errors} />
        <button type="submit" className="btn btn--blood" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="center muted auth__switch">
          Already have an account? <Link to="/">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
