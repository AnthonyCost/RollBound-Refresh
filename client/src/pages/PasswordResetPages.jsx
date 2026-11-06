import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';

/** Forgot password: ask for the account's email, and say a link is on its way (whether or not it exists). */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors([]);
    try {
      setSent((await api.forgotPassword(email)).message);
    } catch (err) {
      setErrors(errorsFrom(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Reset your password">
      {sent ? (
        <div className="form" role="status">
          <p>{sent}</p>
          <p className="muted">Not in your inbox? Check your spam folder, or <button type="button" className="link-button" onClick={() => setSent(null)}>try again</button>.</p>
          <Link to="/" className="btn">Back to sign in</Link>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <p className="muted">Enter the email you signed up with, and we'll send you a link to choose a new password.</p>
          <label className="form-field">
            <span>Email</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <FormErrors errors={errors} />
          <button type="submit" className="btn btn--blood" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
          <p className="center muted auth__switch">
            Remembered it? <Link to="/">Sign in</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}

/** The link from the email: choose a new password, then you're signed in. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setErrors(["The two passwords don't match."]);
    setBusy(true);
    setErrors([]);
    try {
      await resetPassword(token, password);
      navigate('/home', { replace: true });
    } catch (err) {
      setErrors(errorsFrom(err));
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Reset your password">
        <div className="form">
          <p>This page needs the link from your reset email.</p>
          <Link to="/forgot-password" className="btn btn--blood">Send a new link</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password">
      <form className="form" onSubmit={submit}>
        <label className="form-field">
          <span>New password</span>
          <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <small className="muted">At least 8 characters.</small>
        </label>
        <label className="form-field">
          <span>Type it again</span>
          <input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <FormErrors errors={errors} />
        <button type="submit" className="btn btn--blood" disabled={busy}>{busy ? 'Saving…' : 'Save and sign in'}</button>
        <p className="center muted auth__switch">
          Link expired? <Link to="/forgot-password">Send a new one</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
