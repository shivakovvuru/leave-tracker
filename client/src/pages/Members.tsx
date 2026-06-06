import React, { useEffect, useState } from 'react';
import { Members as MembersApi, Roles, Projects, Years as YearsApi, Auth } from '../api';
import { Member, Role, Project, FiscalYear } from '../types';
import { useAuth } from '../AuthContext';
import Modal from '../components/Modal';
import {
  Button, Field, Input, Select, Badge, EmptyState,
} from '../components/FormControls';
import { IconPlus, IconEdit, IconTrash, IconCheck } from '../components/Icons';

const Members: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('');

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [mForm, setMForm] = useState<Partial<Member>>({});

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRole, setNewRole] = useState('');

  const refresh = () => {
    MembersApi.list().then(setMembers);
    Roles.list().then(setRoles);
    Projects.list().then(setProjects);
    YearsApi.list().then(setFiscalYears);
    if (isAdmin) Auth.pendingUsers().then(setPendingUsers).catch(() => {});
  };
  useEffect(refresh, [isAdmin]);

  const filtered = members.filter(m => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterProject && String(m.project_id || '') !== filterProject) return false;
    if (filterRole && String(m.role_id || '') !== filterRole) return false;
    return true;
  });

  const openAdd = () => {
    setEditing(null);
    setMForm({ join_date: new Date().toISOString().slice(0, 10) });
    setShowMemberModal(true);
  };
  const openEdit = (m: Member) => {
    setEditing(m);
    setMForm({ ...m });
    setShowMemberModal(true);
  };
  const save = async () => {
    if (!mForm.name || !mForm.email) return;
    if (editing) await MembersApi.update(editing.id, mForm);
    else await MembersApi.create(mForm);
    setShowMemberModal(false);
    refresh();
  };
  const remove = async (id: number) => {
    if (!window.confirm('Remove this member?')) return;
    await MembersApi.remove(id);
    refresh();
  };
  const addRole = async () => {
    if (!newRole.trim()) return;
    await Roles.create(newRole.trim());
    setNewRole('');
    setShowRoleModal(false);
    refresh();
  };
  const approveUser = async (id: number) => { await Auth.approve(id); refresh(); };
  const rejectUser  = async (id: number) => { await Auth.reject(id);  refresh(); };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Team Members</h1>
          <p className="page-sub">Manage team members, assign roles and projects. New sign-ups appear below for approval.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" onClick={() => setShowRoleModal(true)} icon={<IconPlus size={16} />}>New Role</Button>
          <Button onClick={openAdd} icon={<IconPlus size={16} />}>Add Member</Button>
        </div>
      </div>

      {isAdmin && pendingUsers.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="card-header"><h3>Pending Sign-ups</h3><Badge tone="warning">{pendingUsers.length}</Badge></div>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Requested</th><th></th></tr></thead>
            <tbody>
              {pendingUsers.map(u => (
                <tr key={u.id}>
                  <td><div className="cell-primary">{u.name}</div></td>
                  <td>{u.email}</td>
                  <td>{u.created_at?.slice(0, 10) || '—'}</td>
                  <td>
                    <div className="row-actions">
                      <Button size="sm" onClick={() => approveUser(u.id)} icon={<IconCheck size={14} />}>Approve & Create Profile</Button>
                      <Button size="sm" variant="danger" onClick={() => rejectUser(u.id)}>Reject</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small" style={{ marginTop: 10 }}>
            After approving, the new member appears in the list below. Use <strong>Edit</strong> on their row to assign a project and role.
          </p>
        </div>
      )}

      <div className="toolbar">
        <input className="input toolbar-search" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="select" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">All Roles</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select className="select" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="toolbar-meta">{filtered.length} member(s)</div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          image="/empty-projects.svg"
          title="No members yet"
          subtitle="Add your first team member to begin tracking leaves."
          action={<Button onClick={openAdd} icon={<IconPlus size={16} />}>Add Member</Button>}
        />
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Project</th>
                <th>Mobile</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id}>
                  <td>
                    <div className="cell-with-avatar">
                      <div className="avatar small">{m.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div className="cell-primary">{m.name}</div>
                        <div className="cell-sub">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><Badge tone="purple">{m.role_name || '—'}</Badge></td>
                  <td>{m.project_name || <span className="muted">Unassigned</span>}</td>
                  <td>{m.mobile || <span className="muted">—</span>}</td>
                  <td>{m.join_date || '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => openEdit(m)} title="Edit"><IconEdit size={14} /></button>
                      <button className="icon-btn danger" onClick={() => remove(m.id)} title="Delete"><IconTrash size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showMemberModal}
        title={editing ? 'Edit Member' : 'Add Member'}
        onClose={() => setShowMemberModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowMemberModal(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save Changes' : 'Add Member'}</Button>
          </>
        }
      >
        <div className="form-grid">
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Full Name" required>
              <Input value={mForm.name || ''} onChange={e => setMForm({ ...mForm, name: e.target.value })} />
            </Field>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Email" required>
              <Input type="email" value={mForm.email || ''} onChange={e => setMForm({ ...mForm, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Role">
            <Select value={mForm.role_id || ''} onChange={e => setMForm({ ...mForm, role_id: Number(e.target.value) || null })}>
              <option value="">Select a role</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          <Field label="Project">
            <Select value={mForm.project_id || ''} onChange={e => setMForm({ ...mForm, project_id: Number(e.target.value) || null })}>
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Join Date">
            <Input type="date" value={mForm.join_date || ''} onChange={e => setMForm({ ...mForm, join_date: e.target.value })} />
          </Field>
          <Field label="Mobile" hint={editing ? 'Writes through to the linked user account' : 'Available after the member is linked to a user'}>
            <Input
              value={mForm.mobile || ''}
              onChange={e => setMForm({ ...mForm, mobile: e.target.value })}
              placeholder="+1-555-0000"
              disabled={!editing}
            />
          </Field>
          {isAdmin && pendingUsers.length > 0 && (
            <Field label="Link to User Account" hint="Optional — link to a registered user">
              <Select value={mForm.user_id || ''} onChange={e => setMForm({ ...mForm, user_id: Number(e.target.value) || null })}>
                <option value="">No user link</option>
                {pendingUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </Select>
            </Field>
          )}
        </div>
      </Modal>

      <Modal
        open={showRoleModal}
        title="New Role"
        onClose={() => setShowRoleModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRoleModal(false)}>Cancel</Button>
            <Button onClick={addRole}>Create Role</Button>
          </>
        }
      >
        <Field label="Role Name" required>
          <Input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="e.g. Tech Lead" />
        </Field>
        <div style={{ marginTop: 24 }}>
          <h4 style={{ marginBottom: 8 }}>Existing Roles</h4>
          <div className="chip-wrap">
            {roles.map(r => (
              <span key={r.id} className="chip">
                {r.name}
                <button className="chip-remove" onClick={async () => { await Roles.remove(r.id); refresh(); }}>×</button>
              </span>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Members;
