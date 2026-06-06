import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { Button, Field, Input } from '../components/FormControls';

const Signup: React.FC = () => {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const msg = await signup(name, email, password);
      setSuccess(msg);
      setName(''); setEmail(''); setPassword('');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img src="/logo.svg" alt="logo" className="auth-logo" />
        <h1>Create your account</h1>
        <p className="auth-sub">Sign up to apply and track your leaves</p>

        <form onSubmit={submit} className="form-grid auth-form">
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Full Name" required>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rahul Singh" required />
            </Field>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Email" required>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
            </Field>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Password" required hint="At least 6 characters">
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </Field>
          </div>
          {error   && <div className="auth-error"   style={{ gridColumn: '1 / -1' }}>{error}</div>}
          {success && <div className="auth-success" style={{ gridColumn: '1 / -1' }}>{success}</div>}
          <div style={{ gridColumn: '1 / -1' }}>
            <Button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create Account'}</Button>
          </div>
        </form>

        <div className="auth-footer">
          Already have an account? <a onClick={() => window.location.href = '/login'}>Sign in</a>
        </div>
        <div className="auth-note">
          After signup, an administrator will review and approve your account before you can sign in.
        </div>
      </div>
    </div>
  );
};

export default Signup;
