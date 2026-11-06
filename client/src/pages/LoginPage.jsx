import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors([]);
    try {
      await login(email, password);
      navigate('/home', { replace: true });
    } catch (err) {
      setErrors(errorsFrom(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Sign in">
      <form className="form" onSubmit={submit}>
        <label className="form-field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="form-field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <FormErrors errors={errors} />
        <button type="submit" className="btn btn--blood" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="center muted auth__switch">
          New to the table? <Link to="/register">Create an account</Link>
        </p>
        <p className="center muted auth__switch auth__forgot">
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
