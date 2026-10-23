import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

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
      navigate('/home', { replace: true });
    } catch (err) {
      setErrors(errorsFrom(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Create account">
      <form className="form" onSubmit={submit}>
        <label className="form-field">
          <span>Display name</span>
          <input autoComplete="nickname" required maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="form-field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="form-field">
          <span>Password</span>
          <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <small className="italic muted">At least 8 characters.</small>
        </label>
        <label className="form-field">
          <span>Confirm password</span>
          <input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <FormErrors errors={errors} />
        <button type="submit" className="btn btn--blood" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="center muted auth__switch">
          Already have an account? <Link to="/">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
