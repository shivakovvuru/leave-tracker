import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { Button, Field, Input } from '../components/FormControls';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      // Auth succeeded — leave the /login route so App.tsx renders the dashboard
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img src="/logo.svg" alt="logo" className="auth-logo" />
        <h1>Welcome back</h1>
        <p className="auth-sub">Sign in to your Leave Tracker account</p>

        <form onSubmit={submit} className="form-grid auth-form">
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Email" required>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
            </Field>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Password" required>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </Field>
          </div>
          {error && <div className="auth-error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
          <div style={{ gridColumn: '1 / -1' }}>
            <Button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</Button>
          </div>
        </form>

        <div className="auth-footer">
          New here?{' '}
          <button
            type="button"
            onClick={() => window.location.href = '/signup'}
            style={{ background: 'transparent', border: 0, padding: 0, color: 'var(--acn-purple)', fontWeight: 600, cursor: 'pointer' }}
          >
            Create an account
          </button>
        </div>
        <div className="auth-demo">
          <strong>Demo credentials</strong>
          <div>Admin: <code>admin@company.com</code> / <code>admin123</code></div>
          <div>Member: <code>aarav@company.com</code> / <code>member123</code></div>
        </div>
      </div>
    </div>
  );
};

export default Login;
