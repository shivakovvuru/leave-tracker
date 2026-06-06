import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { Auth } from '../api';
import { Button, Field, Input, Badge } from '../components/FormControls';

const MyProfile: React.FC = () => {
  const { user, member, refresh } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [mobile,    setMobile]    = useState('');
  const [email,     setEmail]     = useState('');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || (user.name || '').split(' ')[0] || '');
      setLastName(user.last_name  || (user.name || '').split(' ').slice(1).join(' ') || '');
      setMobile(user.mobile || '');
      setEmail(user.email);
    }
  }, [user]);

  const saveProfile = async () => {
    setError(null); setSuccess(null);
    setLoading(true);
    try {
      await Auth.updateProfile({ first_name: firstName, last_name: lastName, mobile });
      setSuccess('Profile updated.');
      await refresh();
    } catch (e: any) {
      setError(e.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    setError(null); setSuccess(null);
    if (newPwd !== confirmPwd) {
      setError('New password and confirmation do not match.');
      return;
    }
    setLoading(true);
    try {
      const r = await Auth.updateProfile({
        current_password: currentPwd,
        new_password: newPwd,
      });
      if (r.passwordChanged) {
        // Server invalidated all sessions; force re-login
        localStorage.removeItem('lt_token');
        window.location.href = '/login';
        return;
      }
    } catch (e: any) {
      setError(e.message || 'Password change failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>My Profile</h1>
          <p className="page-sub">Update your name, mobile, and password. Email cannot be changed.</p>
        </div>
      </div>

      <div className="dash-row">
        <div className="card">
          <div className="card-header">
            <h3>Personal Information</h3>
            <Badge tone={user?.role === 'admin' ? 'purple' : 'info'}>
              {user?.role === 'admin' ? 'Administrator' : (member?.role_name || 'Member')}
            </Badge>
          </div>
          <div className="form-grid">
            <Field label="First Name" required>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
            </Field>
            <Field label="Last Name" required>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} />
            </Field>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Email" hint="Email is fixed">
                <Input value={email} disabled />
              </Field>
            </div>
            <Field label="Mobile Number">
              <Input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+1-555-0000" />
            </Field>
            {error && <div className="auth-error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
            {success && <div className="auth-success" style={{ gridColumn: '1 / -1' }}>{success}</div>}
            <div style={{ gridColumn: '1 / -1' }}>
              <Button onClick={saveProfile} disabled={loading}>Save Profile</Button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Change Password</h3></div>
          <div className="form-grid">
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Current Password" required>
                <Input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} />
              </Field>
            </div>
            <Field label="New Password" required hint="At least 6 characters">
              <Input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
            </Field>
            <Field label="Confirm New Password" required>
              <Input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
            </Field>
            <div style={{ gridColumn: '1 / -1' }}>
              <Button onClick={changePassword} disabled={loading || !currentPwd || !newPwd || !confirmPwd}>
                Update Password
              </Button>
              <p className="muted small" style={{ marginTop: 8 }}>
                You'll be signed out and asked to log in with the new password.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
