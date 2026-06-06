import React, { useEffect, useState } from 'react';
import { Projects as ProjectsApi, Members, Roles, Holidays } from '../api';
import { Project, Member, Role, PublicHoliday } from '../types';
import { useAuth } from '../AuthContext';
import Modal from '../components/Modal';
import {
  Button, Field, Input, Textarea, Select, Badge, EmptyState,
} from '../components/FormControls';
import {
  IconPlus, IconEdit, IconTrash, IconUsers, IconCalendar, IconDownload,
} from '../components/Icons';

const ProjectsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [projects, setProjects] = useState<Project[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectMembers, setProjectMembers] = useState<Member[]>([]);

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const refresh = () => {
    ProjectsApi.list().then(setProjects);
    Roles.list().then(setRoles);
    Holidays.list().then(setHolidays);
    Members.list().then(setMembers);
  };
  useEffect(refresh, []);

  useEffect(() => {
    if (selectedProject) {
      Members.list(selectedProject.id).then(setProjectMembers);
    }
  }, [selectedProject]);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.code || '').toLowerCase().includes(search.toLowerCase())
  );

  // Project form state
  const [pForm, setPForm] = useState<Partial<Project>>({});
  const openCreateProject = () => { setEditing(null); setPForm({ status: 'Active' }); setShowProjectModal(true); };
  const openEditProject   = (p: Project) => {
    setEditing(p);
    setPForm({ name: p.name, code: p.code, description: p.description,
               start_date: p.start_date, end_date: p.end_date, status: p.status });
    setShowProjectModal(true);
  };
  const saveProject = async () => {
    if (!pForm.name) return;
    if (editing) await ProjectsApi.update(editing.id, pForm);
    else await ProjectsApi.create(pForm);
    setShowProjectModal(false);
    refresh();
  };
  const deleteProject = async (id: number) => {
    if (!window.confirm('Delete this project and all its members?')) return;
    await ProjectsApi.remove(id);
    refresh();
  };

  // Member form state
  const [mForm, setMForm] = useState<Partial<Member>>({});
  const openAddMember = () => {
    setEditingMember(null);
    setMForm({ project_id: selectedProject?.id, join_date: new Date().toISOString().slice(0, 10) });
    setShowMemberModal(true);
  };
  const openEditMember = (m: Member) => {
    setEditingMember(m);
    setMForm({ ...m });
    setShowMemberModal(true);
  };
  const saveMember = async () => {
    if (!mForm.name || !mForm.email) return;
    if (editingMember) await Members.update(editingMember.id, mForm);
    else await Members.create(mForm);
    setShowMemberModal(false);
    refresh();
    if (selectedProject) {
      const list = await Members.list(selectedProject.id);
      setProjectMembers(list);
    }
  };
  const deleteMember = async (id: number) => {
    if (!window.confirm('Remove this member?')) return;
    await Members.remove(id);
    refresh();
    if (selectedProject) {
      const list = await Members.list(selectedProject.id);
      setProjectMembers(list);
    }
  };

  const exportReport = () => {
    if (!selectedProject) return;
    const rows = [
      ['Member', 'Role', 'Annual Quota', 'On Leave Today'],
      ...members.filter(m => m.project_id === selectedProject.id).map(m => {
        const today = new Date().toISOString().slice(0, 10);
        return [m.name, m.role_name || '', m.join_date || '', ''];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${selectedProject.name}-report.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="page-sub">Create projects, add team members by role, and track availability.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" onClick={exportReport} icon={<IconDownload size={16} />}>
            Export
          </Button>
          {isAdmin && (
            <Button onClick={openCreateProject} icon={<IconPlus size={16} />}>New Project</Button>
          )}
        </div>
      </div>

      <div className="toolbar">
        <input
          className="input toolbar-search"
          placeholder="Search projects by name or code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="toolbar-meta">{filtered.length} project(s)</div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          image="/empty-projects.svg"
          title="No projects found"
          subtitle={isAdmin ? "Create your first project to start tracking team leaves." : "You have no projects yet. Please contact your admin."}
          action={isAdmin ? <Button onClick={openCreateProject} icon={<IconPlus size={16} />}>New Project</Button> : undefined}
        />
      ) : (
        <div className="card-grid">
          {filtered.map(p => (
            <div key={p.id} className="project-card">
              <div className="project-card-top">
                <div>
                  <div className="project-card-code">{p.code || '—'}</div>
                  <h3 className="project-card-name">{p.name}</h3>
                  <p className="project-card-desc">{p.description || 'No description'}</p>
                </div>
                <Badge tone={p.status === 'Active' ? 'success' : 'default'}>{p.status}</Badge>
              </div>
              <div className="project-card-meta">
                <div className="meta-item">
                  <IconUsers size={16} />
                  <span>{p.member_count || 0} members</span>
                </div>
                <div className="meta-item">
                  <IconCalendar size={16} />
                  <span>{p.start_date || '—'} → {p.end_date || '—'}</span>
                </div>
              </div>
              <div className="project-card-actions">
                {isAdmin ? (
                  <Button size="sm" variant="secondary" onClick={() => setSelectedProject(p)}>
                    Manage Team
                  </Button>
                ) : <span />}
                {isAdmin && (
                  <div className="icon-actions">
                    <button className="icon-btn" onClick={() => openEditProject(p)} title="Edit">
                      <IconEdit size={16} />
                    </button>
                    <button className="icon-btn danger" onClick={() => deleteProject(p.id)} title="Delete">
                      <IconTrash size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project Form Modal */}
      <Modal
        open={showProjectModal}
        title={editing ? 'Edit Project' : 'New Project'}
        onClose={() => setShowProjectModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowProjectModal(false)}>Cancel</Button>
            <Button onClick={saveProject}>{editing ? 'Save Changes' : 'Create Project'}</Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Project Name" required>
            <Input value={pForm.name || ''} onChange={e => setPForm({ ...pForm, name: e.target.value })} placeholder="e.g. Website Redesign" />
          </Field>
          <Field label="Project Code">
            <Input value={pForm.code || ''} onChange={e => setPForm({ ...pForm, code: e.target.value })} placeholder="e.g. WEB-2026" />
          </Field>
          <Field label="Description" >
            <Textarea value={pForm.description || ''} onChange={e => setPForm({ ...pForm, description: e.target.value })} rows={3} />
          </Field>
          <Field label="Start Date">
            <Input type="date" value={pForm.start_date || ''} onChange={e => setPForm({ ...pForm, start_date: e.target.value })} />
          </Field>
          <Field label="End Date">
            <Input type="date" value={pForm.end_date || ''} onChange={e => setPForm({ ...pForm, end_date: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={pForm.status || 'Active'} onChange={e => setPForm({ ...pForm, status: e.target.value })}>
              <option>Active</option>
              <option>On Hold</option>
              <option>Completed</option>
            </Select>
          </Field>
        </div>
      </Modal>

      {/* Project Detail Drawer (modal) */}
      <Modal
        open={!!selectedProject}
        title={selectedProject ? `${selectedProject.name} — Team` : ''}
        size="lg"
        onClose={() => setSelectedProject(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedProject(null)}>Close</Button>
            {isAdmin && <Button onClick={openAddMember} icon={<IconPlus size={16} />}>Add Member</Button>}
          </>
        }
      >
        {selectedProject && (
          <div>
            <p className="muted">{selectedProject.description}</p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Join Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projectMembers.length === 0 ? (
                  <tr><td colSpan={5} className="cell-empty">No members yet. Add the first one.</td></tr>
                ) : projectMembers.map(m => (
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
                    <td>{m.email}</td>
                    <td><Badge tone="purple">{m.role_name || '—'}</Badge></td>
                    <td>{m.join_date || '—'}</td>
                    <td>
                      {isAdmin && (
                        <div className="row-actions">
                          <button className="icon-btn" onClick={() => openEditMember(m)} title="Edit">
                            <IconEdit size={14} />
                          </button>
                          <button className="icon-btn danger" onClick={() => deleteMember(m.id)} title="Delete">
                            <IconTrash size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Member Form Modal */}
      <Modal
        open={showMemberModal}
        title={editingMember ? 'Edit Member' : 'Add Member'}
        onClose={() => setShowMemberModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowMemberModal(false)}>Cancel</Button>
            <Button onClick={saveMember}>{editingMember ? 'Save Changes' : 'Add Member'}</Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Full Name" required>
            <Input value={mForm.name || ''} onChange={e => setMForm({ ...mForm, name: e.target.value })} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={mForm.email || ''} onChange={e => setMForm({ ...mForm, email: e.target.value })} />
          </Field>
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
          <Field label="Avatar URL" hint="Optional image URL">
            <Input value={mForm.avatar || ''} onChange={e => setMForm({ ...mForm, avatar: e.target.value })} placeholder="https://..." />
          </Field>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectsPage;
