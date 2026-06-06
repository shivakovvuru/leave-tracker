import React, { useEffect, useState } from 'react';
import { Leaves } from '../api';
import { Leave } from '../types';
import { Button, Badge, EmptyState } from '../components/FormControls';
import { IconCheck } from '../components/Icons';

const Approvals: React.FC = () => {
  const [items, setItems] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    Leaves.list().then(all => {
      // Sort: most recent first
      all.sort((a, b) => (b.id || 0) - (a.id || 0));
      setItems(all);
      setLoading(false);
    });
  };
  useEffect(() => { refresh(); }, []);

  const approveNew = async (id: number) => {
    await Leaves.update(id, { status: 'Approved' });
    refresh();
  };
  const rejectNew = async (id: number) => {
    await Leaves.update(id, { status: 'Rejected' });
    refresh();
  };
  const approvePendingUpdate = async (id: number) => {
    await Leaves.update(id, { action: 'approve_pending' });
    refresh();
  };
  const rejectPendingUpdate = async (id: number) => {
    await Leaves.update(id, { action: 'reject_pending' });
    refresh();
  };

  const pendingNew      = items.filter(l => l.status === 'Pending' && l.pending_update !== 1);
  const pendingChanges  = items.filter(l => l.pending_update === 1);
  const recentlyDecided = items
    .filter(l => (l.status === 'Approved' || l.status === 'Rejected') && l.pending_update !== 1)
    .slice(0, 10);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Approvals</h1>
          <p className="page-sub">Approve or reject pending leave submissions, and review member-requested changes to already-approved leaves.</p>
        </div>
      </div>

      {loading ? (
        <div className="card-empty">Loading…</div>
      ) : (
        <>
          {/* 1) Pending submissions */}
          <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="card-header">
              <h3>Pending Leave Submissions</h3>
              <Badge tone="warning">{pendingNew.length}</Badge>
            </div>
            {pendingNew.length === 0 ? (
              <div className="card-empty">No pending submissions.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Member</th><th>Project</th><th>Type</th>
                    <th>From</th><th>To</th><th>Days</th>
                    <th>Reason</th><th>Requested</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingNew.map(l => (
                    <tr key={l.id}>
                      <td>
                        <div className="cell-primary">{l.member_name}</div>
                        <div className="cell-sub">{l.role_name}</div>
                      </td>
                      <td>{l.project_name || '—'}</td>
                      <td><Badge tone="purple">{l.leave_type}</Badge></td>
                      <td>{l.start_date}</td>
                      <td>{l.end_date}</td>
                      <td>{l.days}</td>
                      <td className="truncate" title={l.reason || ''}>{l.reason || '—'}</td>
                      <td>{(l.created_at || '').slice(0, 10) || '—'}</td>
                      <td>
                        <div className="row-actions">
                          <Button size="sm" onClick={() => approveNew(l.id)} icon={<IconCheck size={14} />}>Approve</Button>
                          <Button size="sm" variant="danger" onClick={() => rejectNew(l.id)}>Reject</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 2) Pending updates to already-approved leaves */}
          <div className="card">
            <div className="card-header">
              <h3>Pending Changes to Approved Leaves</h3>
              <Badge tone="info">{pendingChanges.length}</Badge>
            </div>
            {pendingChanges.length === 0 ? (
              <EmptyState
                image="/empty-projects.svg"
                title="No pending approvals"
                subtitle="Members' updates to approved leaves will appear here for your review."
              />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Member</th><th>Project</th><th>Type</th>
                    <th>Current</th><th>Proposed</th>
                    <th>Reason</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingChanges.map(l => {
                    let proposed: any = null;
                    try { proposed = JSON.parse(l.pending_data || 'null'); } catch {}
                    return (
                      <tr key={l.id}>
                        <td>
                          <div className="cell-primary">{l.member_name}</div>
                          <div className="cell-sub">{l.role_name}</div>
                        </td>
                        <td>{l.project_name || '—'}</td>
                        <td><Badge tone="purple">{l.leave_type}</Badge></td>
                        <td>
                          <div className="cell-primary">{l.start_date} → {l.end_date}</div>
                          <div className="cell-sub">{l.days} day(s)</div>
                        </td>
                        <td>
                          {proposed ? (
                            <div>
                              <div className="cell-primary">{proposed.start_date} → {proposed.end_date}</div>
                              {proposed.leave_type !== l.leave_type && <div className="cell-sub">type: {proposed.leave_type}</div>}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="truncate" title={proposed?.reason || ''}>{proposed?.reason || '—'}</td>
                        <td>
                          <div className="row-actions">
                            <button className="icon-btn" onClick={() => approvePendingUpdate(l.id)} title="Approve" style={{ color: '#047857' }}>
                              <IconCheck size={16} />
                            </button>
                            <button className="icon-btn danger" onClick={() => rejectPendingUpdate(l.id)} title="Reject">×</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* 3) Recently decided (read-only) */}
          {recentlyDecided.length > 0 && (
            <div className="card">
              <div className="card-header"><h3>Recently Decided</h3><Badge>{recentlyDecided.length}</Badge></div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Member</th><th>Type</th><th>From</th><th>To</th>
                    <th>Days</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentlyDecided.map(l => (
                    <tr key={l.id}>
                      <td>
                        <div className="cell-primary">{l.member_name}</div>
                        <div className="cell-sub">{l.role_name}</div>
                      </td>
                      <td><Badge tone="purple">{l.leave_type}</Badge></td>
                      <td>{l.start_date}</td>
                      <td>{l.end_date}</td>
                      <td>{l.days}</td>
                      <td>
                        <Badge tone={l.status === 'Approved' ? 'success' : 'danger'}>{l.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Approvals;
