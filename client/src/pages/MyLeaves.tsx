import React, { useEffect, useState } from 'react';
import { Leaves } from '../api';
import { Leave, LeaveType } from '../types';
import { useAuth } from '../AuthContext';
import Modal from '../components/Modal';
import {
  Button, Field, Input, Select, Textarea, Badge,
} from '../components/FormControls';
import { IconPlus, IconEdit, IconTrash } from '../components/Icons';

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  'PL': 'PL (Planned Leave)',
  'Sick Leave': 'Sick Leave',
  'Unplanned Leave': 'Unplanned Leave',
};

const MyLeaves: React.FC = () => {
  const { member } = useAuth();
  const [items, setItems] = useState<Leave[]>([]);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<Leave | null>(null);
  const [form, setForm] = useState<Partial<Leave>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    if (!member) return;
    Leaves.list({ member_id: member.id }).then(setItems);
  };
  useEffect(() => { refresh(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [member]);
  // Refetch when the tab regains focus / page becomes visible — covers
  // the case where the admin approved a leave while the member was elsewhere
  useEffect(() => {
    const onVis = () => { if (!document.hidden) refresh(); };
    const onFocus = () => refresh();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member]);

  const openAdd = () => {
    setEditing(null);
    setError(null);
    setForm({
      leave_type: 'PL',
      start_date: new Date().toISOString().slice(0, 10),
      end_date:   new Date().toISOString().slice(0, 10),
    });
    setShow(true);
  };
  const openEdit = (l: Leave) => {
    setEditing(l);
    setError(null);
    setForm({ leave_type: l.leave_type, start_date: l.start_date, end_date: l.end_date, reason: l.reason || '' });
    setShow(true);
  };
  const todayStr   = new Date().toISOString().slice(0, 10);
  const maxDateStr = (() => { const d = new Date(); d.setDate(d.getDate() + 90); return d.toISOString().slice(0, 10); })();
  const isWeekend  = (s: string) => { const d = new Date(s + 'T00:00:00').getDay(); return d === 0 || d === 6; };

  const save = async () => {
    setError(null);
    // Client-side pre-validation
    if (!form.start_date || !form.end_date) { setError('Start and end dates are required.'); return; }
    if (form.start_date < todayStr) { setError('Cannot apply leave for past dates.'); return; }
    if (form.start_date > maxDateStr || form.end_date > maxDateStr) { setError(`Cannot apply leave more than 3 months in advance (max ${maxDateStr}).`); return; }
    if (isWeekend(form.start_date) || isWeekend(form.end_date)) {
      setError('Leaves cannot be applied on weekends (Saturday / Sunday). Pick a weekday.'); return;
    }
    try {
      if (editing) {
        await Leaves.update(editing.id, form);
      } else {
        await Leaves.create(form);
      }
      setShow(false);
      refresh();
    } catch (e: any) {
      setError(e.message);
    }
  };
  const cancel = async (l: Leave) => {
    if (l.status !== 'Pending') {
      alert('You can only cancel a leave while it is still Pending. Ask your admin to cancel an approved leave.');
      return;
    }
    if (!window.confirm('Cancel this leave request?')) return;
    try {
      await Leaves.update(l.id, { action: 'cancel' });
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const my = items.filter(l => l.member_id === member?.id);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = my.filter(l => l.end_date >= today && l.status !== 'Rejected');
  const rejected = my.filter(l => l.status === 'Rejected');
  const past = my.filter(l => l.end_date < today);
  const pendingChanges = my.filter(l => l.pending_update === 1);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>My Leaves</h1>
          <p className="page-sub">Apply for leave, view your history, and request changes. Updates to approved leaves go to admin for approval.</p>
        </div>
        <div className="page-actions">
          <Button onClick={openAdd} icon={<IconPlus size={16} />}>Apply Leave</Button>
        </div>
      </div>

      {pendingChanges.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="card-header"><h3>Pending Updates</h3><Badge tone="warning">{pendingChanges.length}</Badge></div>
          <p className="muted small" style={{ marginBottom: 12 }}>These changes are awaiting admin approval.</p>
          <ul className="leave-list">
            {pendingChanges.map(l => {
              let p: any = null; try { p = JSON.parse(l.pending_data || 'null'); } catch {}
              return (
                <li key={l.id} className="leave-list-item">
                  <div className="leave-dot" style={{ background: '#f59e0b' }} />
                  <div className="leave-list-info">
                    <div className="cell-primary">{l.leave_type} • {l.start_date} → {l.end_date}</div>
                    {p && <div className="cell-sub">Proposed: {p.start_date} → {p.end_date}{p.reason ? ` — ${p.reason}` : ''}</div>}
                  </div>
                  <Badge tone="warning">Awaiting Approval</Badge>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h3>Upcoming & Pending</h3><Badge tone="info">{upcoming.length}</Badge></div>
        {upcoming.length === 0 ? (
          <div className="card-empty">No upcoming leaves.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th><th>From</th><th>To</th><th>Days</th>
                <th>Reason</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map(l => (
                <tr key={l.id}>
                  <td><span className="pill" style={{ background: '#e0e7ff', color: '#4338ca' }}>{l.leave_type}</span></td>
                  <td>{l.start_date}</td>
                  <td>{l.end_date}</td>
                  <td>{l.days}</td>
                  <td className="truncate" title={l.reason || ''}>{l.reason || '—'}</td>
                  <td>
                    <Badge tone={l.status === 'Approved' ? 'success' : l.status === 'Pending' ? 'warning' : 'danger'}>
                      {l.status}
                    </Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => openEdit(l)} title="Edit / request change"><IconEdit size={14} /></button>
                      {l.status === 'Pending' && (
                        <button className="icon-btn danger" onClick={() => cancel(l)} title="Cancel leave"><IconTrash size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rejected.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid #B42318' }}>
          <div className="card-header"><h3>Rejected</h3><Badge tone="danger">{rejected.length}</Badge></div>
          {rejected.length === 0 ? (
            <div className="card-empty">No rejected leaves.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rejected.map(l => (
                  <tr key={l.id}>
                    <td><span className="pill" style={{ background: '#fee2e2', color: '#B42318' }}>{l.leave_type}</span></td>
                    <td>{l.start_date}</td>
                    <td>{l.end_date}</td>
                    <td>{l.days}</td>
                    <td className="truncate" title={l.reason || ''}>{l.reason || '—'}</td>
                    <td><Badge tone="danger">Rejected</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-header"><h3>Past Leaves</h3><Badge>{past.length}</Badge></div>
        {past.length === 0 ? (
          <div className="card-empty">No past leaves.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {past.map(l => (
                <tr key={l.id}>
                  <td><span className="pill" style={{ background: '#e0e7ff', color: '#4338ca' }}>{l.leave_type}</span></td>
                  <td>{l.start_date}</td>
                  <td>{l.end_date}</td>
                  <td>{l.days}</td>
                  <td>
                    <Badge tone={l.status === 'Approved' ? 'success' : l.status === 'Pending' ? 'warning' : 'danger'}>
                      {l.status}
                    </Badge>
                  </td>
                  <td className="truncate">{l.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={show}
        title={editing ? 'Edit Leave' : 'Apply for Leave'}
        onClose={() => setShow(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShow(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Submit Change' : 'Submit'}</Button>
          </>
        }
      >
        <div className="form-grid">
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Leave Type" required>
              <Select value={form.leave_type || 'PL'} onChange={e => setForm({ ...form, leave_type: e.target.value as LeaveType })}>
                {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="From" required hint="Today through 90 days from now">
            <Input
              type="date"
              value={form.start_date || ''}
              min={todayStr}
              max={maxDateStr}
              onChange={e => setForm({ ...form, start_date: e.target.value })}
            />
          </Field>
          <Field label="To" required hint="Today through 90 days from now">
            <Input
              type="date"
              value={form.end_date || ''}
              min={form.start_date || todayStr}
              max={maxDateStr}
              onChange={e => setForm({ ...form, end_date: e.target.value })}
            />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Reason" hint="Optional">
              <Textarea rows={2} value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Optional context for your manager…" />
            </Field>
          </div>
          {error && <div className="auth-error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
        </div>
      </Modal>
    </div>
  );
};

export default MyLeaves;
