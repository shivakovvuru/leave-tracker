import React, { useEffect, useMemo, useState } from 'react';
import { Projects, Members, Leaves, Holidays, Reports as ReportsApi } from '../api';
import { Project, Member, Leave, PublicHoliday } from '../types';
import { useAuth } from '../AuthContext';
import { Page } from '../App';
import {
  IconProject, IconUsers, IconCalendar, IconReport, IconPlus,
} from '../components/Icons';
import { Button, Badge, Field, Select } from '../components/FormControls';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

type Props = { onNavigate: (p: Page) => void };

const LEAVE_COLORS: Record<string, string> = {
  'PL':              '#A100FF',
  'Sick Leave':      '#B42318',
  'Unplanned Leave': '#B54708',
};

const Dashboard: React.FC<Props> = ({ onNavigate }) => {
  const { user, member } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers]   = useState<Member[]>([]);
  const [leaves, setLeaves]     = useState<Leave[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [report, setReport] = useState<any>(null);
  const [selectedSlice, setSelectedSlice] = useState<string | null>(null);
  // Alphabetical default; user can override
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  useEffect(() => {
    if (sortedProjects.length && selectedProjectId === '') {
      setSelectedProjectId(sortedProjects[0].id);
    }
  }, [sortedProjects, selectedProjectId]);
  const selectedProject = useMemo(
    () => sortedProjects.find(p => p.id === selectedProjectId) || null,
    [sortedProjects, selectedProjectId]
  );

  useEffect(() => {
    Promise.all([
      Projects.list(), Members.list(), Leaves.list(), Holidays.list(),
      ReportsApi.summary().catch(() => null),
    ]).then(([p, m, l, h, r]) => {
      setProjects(p); setMembers(m); setLeaves(l); setHolidays(h); setReport(r);
    });
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  // Filter scope: when a project is selected, every tile below reflects that project only
  const scopedLeaves = useMemo(
    () => selectedProjectId
      ? leaves.filter(l => l.project_id === selectedProjectId)
      : leaves,
    [leaves, selectedProjectId]
  );
  const todayLeaves = scopedLeaves.filter(l =>
    l.start_date <= today && l.end_date >= today
  );
  const onLeaveToday = todayLeaves.filter(l => l.leave_type === 'PL' || l.leave_type === 'Unplanned Leave').length;
  const sickToday = todayLeaves.filter(l => l.leave_type === 'Sick Leave').length;

  // Hoisted hooks (rules-of-hooks): scoped report + slice reset effect
  const scopedReport = useMemo(() => {
    if (!isAdmin || !selectedProjectId) return report;
    const byType: Record<string, { leave_type: string; total_days: number; total_records: number }> = {};
    const byMember: Record<number, { id: number; name: string; role_name: string; pl_days: number; sick_days: number; unplanned_days: number }> = {};
    for (const l of scopedLeaves) {
      const t = byType[l.leave_type] || { leave_type: l.leave_type, total_days: 0, total_records: 0 };
      t.total_days   += l.days || 0;
      t.total_records += 1;
      byType[l.leave_type] = t;
      const m = members.find(x => x.id === l.member_id);
      const bm = byMember[l.member_id] || {
        id: l.member_id,
        name: m?.name || l.member_name || `Member #${l.member_id}`,
        role_name: m?.role_name || l.role_name || '',
        pl_days: 0, sick_days: 0, unplanned_days: 0,
      };
      if (l.leave_type === 'PL')             bm.pl_days       += l.days || 0;
      if (l.leave_type === 'Sick Leave')     bm.sick_days     += l.days || 0;
      if (l.leave_type === 'Unplanned Leave')bm.unplanned_days+= l.days || 0;
      byMember[l.member_id] = bm;
    }
    return { byType: Object.values(byType), byMember: Object.values(byMember), byProject: [] };
  }, [isAdmin, selectedProjectId, scopedLeaves, members, report]);

  // Reset stale slice selection if the picked slice no longer exists in the new data
  useEffect(() => {
    if (!selectedSlice || !scopedReport) return;
    const t = (scopedReport.byType || []).find((x: any) => x.leave_type === selectedSlice);
    if (!t) setSelectedSlice(null);
  }, [scopedReport, selectedSlice]);

  const upcomingHolidays = holidays
    .filter(h => h.date >= today)
    .slice(0, 4);

  // Admin view
  if (isAdmin) {
    const pieData = (scopedReport?.byType || []).map((t: any) => ({
      name: t.leave_type, value: t.total_days, records: t.total_records,
    }));
    // "By Project" only makes sense at the org level — hide it when a project is selected
    const pieProjects = selectedProjectId ? [] : ((report?.byProject || []).map((p: any) => ({
      name: p.name, value: p.total_days, records: p.total_records,
    })));

    const sliceDetails = (() => {
      if (!selectedSlice || !scopedReport) return null;
      if (pieData.find((d: any) => d.name === selectedSlice)) {
        return (scopedReport.byMember || []).filter((m: any) => {
          if (selectedSlice === 'PL')             return m.pl_days > 0;
          if (selectedSlice === 'Sick Leave')     return m.sick_days > 0;
          if (selectedSlice === 'Unplanned Leave')return m.unplanned_days > 0;
          return false;
        }).map((m: any) => ({
          name: m.name, role: m.role_name,
          days: selectedSlice === 'PL' ? m.pl_days : selectedSlice === 'Sick Leave' ? m.sick_days : m.unplanned_days,
        }));
      }
      if (pieProjects.find((d: any) => d.name === selectedSlice)) {
        return (scopedReport.byMember || []).filter((m: any) =>
          (m.pl_days + m.sick_days + m.unplanned_days) > 0
        ).map((m: any) => ({ name: m.name, role: m.role_name, days: m.pl_days + m.sick_days + m.unplanned_days }));
      }
      return null;
    })();

    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Admin Dashboard</h1>
            <p className="page-sub">
              {selectedProject
                ? `Showing all data for ${selectedProject.name}.`
                : 'Welcome back, Admin. Pick a project to drill down, or browse the org-wide view.'}
            </p>
          </div>
          <div className="page-actions">
            <Button variant="secondary" onClick={() => onNavigate('reports')} icon={<IconReport size={16} />}>View Reports</Button>
            <Button onClick={() => onNavigate('projects')} icon={<IconPlus size={16} />}>New Project</Button>
          </div>
        </div>

        <div className="kpi-grid">
          {selectedProjectId ? (
            <>
              <div className="kpi-card kpi-purple">
                <div className="kpi-icon"><IconProject size={22} /></div>
                <div>
                  <div className="kpi-label">Selected Project</div>
                  <div className="kpi-value" style={{ fontSize: 18 }}>{selectedProject?.name || '—'}</div>
                  <div className="kpi-sub">{selectedProject?.code || ''} • {selectedProject?.status}</div>
                </div>
              </div>
              <div className="kpi-card kpi-blue">
                <div className="kpi-icon"><IconUsers size={22} /></div>
                <div>
                  <div className="kpi-label">Team Members</div>
                  <div className="kpi-value">{members.filter(m => m.project_id === selectedProjectId).length}</div>
                  <div className="kpi-sub">in this project</div>
                </div>
              </div>
              <div className="kpi-card kpi-green">
                <div className="kpi-icon"><IconCalendar size={22} /></div>
                <div>
                  <div className="kpi-label">On Leave Today</div>
                  <div className="kpi-value">{onLeaveToday}</div>
                  <div className="kpi-sub">PL + Unplanned</div>
                </div>
              </div>
              <div className="kpi-card kpi-amber">
                <div className="kpi-icon"><IconReport size={22} /></div>
                <div>
                  <div className="kpi-label">Sick Today</div>
                  <div className="kpi-value">{sickToday}</div>
                  <div className="kpi-sub">requires attention</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="kpi-card kpi-purple">
                <div className="kpi-icon"><IconProject size={22} /></div>
                <div>
                  <div className="kpi-label">Total Projects</div>
                  <div className="kpi-value">{projects.length}</div>
                  <div className="kpi-sub">{projects.filter(p => p.status === 'Active').length} active</div>
                </div>
              </div>
              <div className="kpi-card kpi-blue">
                <div className="kpi-icon"><IconUsers size={22} /></div>
                <div>
                  <div className="kpi-label">Team Members</div>
                  <div className="kpi-value">{members.length}</div>
                  <div className="kpi-sub">across all projects</div>
                </div>
              </div>
              <div className="kpi-card kpi-green">
                <div className="kpi-icon"><IconCalendar size={22} /></div>
                <div>
                  <div className="kpi-label">On Leave Today</div>
                  <div className="kpi-value">{onLeaveToday}</div>
                  <div className="kpi-sub">PL + Unplanned</div>
                </div>
              </div>
              <div className="kpi-card kpi-amber">
                <div className="kpi-icon"><IconReport size={22} /></div>
                <div>
                  <div className="kpi-label">Sick Today</div>
                  <div className="kpi-value">{sickToday}</div>
                  <div className="kpi-sub">requires attention</div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Project Snapshot</h3>
            {sortedProjects.length > 0 && (
              <Field label="">
                <Select
                  value={String(selectedProjectId || '')}
                  onChange={e => setSelectedProjectId(Number(e.target.value))}
                >
                  {sortedProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          {selectedProject ? (
            <ProjectSnapshot
              project={selectedProject}
              members={members.filter(m => m.project_id === selectedProject.id)}
              leaves={leaves.filter(l => l.project_id === selectedProject.id)}
            />
          ) : (
            <div className="card-empty">No projects available.</div>
          )}
        </div>

        <div className="dash-row">
          <div className="card">
            <div className="card-header">
              <h3>{selectedProjectId ? `Project — ${selectedProject?.name || ''}` : 'Active Projects'}</h3>
              {!selectedProjectId && (
                <button
                  type="button"
                  className="card-link"
                  onClick={() => onNavigate('projects')}
                  style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
                >
                  View all →
                </button>
              )}
            </div>
            {projects.length === 0 ? (
              <div className="card-empty">No projects yet. Create your first one to get started.</div>
            ) : selectedProject ? (
              <table className="data-table">
                <thead><tr><th>Field</th><th>Value</th></tr></thead>
                <tbody>
                  <tr><td><div className="cell-primary">Name</div></td><td>{selectedProject.name}</td></tr>
                  <tr><td><div className="cell-primary">Code</div></td><td><Badge tone="info">{selectedProject.code || '—'}</Badge></td></tr>
                  <tr><td><div className="cell-primary">Status</div></td><td><Badge tone={selectedProject.status === 'Active' ? 'success' : 'default'}>{selectedProject.status}</Badge></td></tr>
                  <tr><td><div className="cell-primary">Dates</div></td><td>{selectedProject.start_date || '—'} → {selectedProject.end_date || '—'}</td></tr>
                  <tr><td><div className="cell-primary">Description</div></td><td className="muted">{selectedProject.description || '—'}</td></tr>
                  <tr><td><div className="cell-primary">Members</div></td><td>{members.filter(m => m.project_id === selectedProject.id).length}</td></tr>
                </tbody>
              </table>
            ) : (
              <table className="data-table">
                <thead><tr><th>Project</th><th>Code</th><th>Status</th><th>Members</th></tr></thead>
                <tbody>
                  {projects.slice(0, 5).map(p => (
                    <tr key={p.id}>
                      <td>
                        <div className="cell-primary">{p.name}</div>
                        <div className="cell-sub">{p.description || '—'}</div>
                      </td>
                      <td><Badge tone="info">{p.code || '—'}</Badge></td>
                      <td><Badge tone={p.status === 'Active' ? 'success' : 'default'}>{p.status}</Badge></td>
                      <td>{p.member_count || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Today's Attendance</h3>
              <Badge tone="info">{today}</Badge>
            </div>
            {todayLeaves.length === 0 ? (
              <div className="card-empty">All team members are present today 🎉</div>
            ) : (
              <ul className="leave-list">
                {todayLeaves.map(l => (
                  <li key={l.id} className="leave-list-item">
                    <div className={`leave-dot ${l.leave_type === 'Unplanned Leave' ? 'unplanned' : l.leave_type === 'Sick Leave' ? 'sick' : 'leave'}`} />
                    <div className="leave-list-info">
                      <div className="cell-primary">{l.member_name}</div>
                      <div className="cell-sub">{l.role_name} • {l.project_name}</div>
                    </div>
                    <Badge tone={l.leave_type === 'Unplanned Leave' ? 'warning' : l.leave_type === 'Sick Leave' ? 'danger' : 'info'}>
                      {l.leave_type}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="dash-row">
          <div className="card">
            <div className="card-header">
              <h3>Leave Distribution by Type</h3>
              {selectedSlice && <Badge tone="info">Click a slice • {selectedSlice}</Badge>}
            </div>
            {pieData.length === 0 ? (
              <div className="card-empty">No leave data yet.</div>
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData} dataKey="value" nameKey="name"
                      innerRadius={50} outerRadius={90} paddingAngle={3}
                      onClick={(d: any) => setSelectedSlice(prev => prev === d.name ? null : d.name)}
                      style={{ cursor: 'pointer' }}
                    >
                      {pieData.map((d: any, idx: number) => (
                        <Cell key={idx}
                          fill={LEAVE_COLORS[d.name] || '#94a3b8'}
                          stroke={selectedSlice === d.name ? '#111' : 'none'}
                          strokeWidth={selectedSlice === d.name ? 2 : 0}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {selectedSlice && sliceDetails && sliceDetails.length > 0 && (
              <div className="pie-details">
                <h4>{selectedSlice} — Members</h4>
                <table className="data-table">
                  <thead><tr><th>Member</th><th>Role</th><th>Days</th></tr></thead>
                  <tbody>
                    {sliceDetails.map((m: any) => (
                      <tr key={m.name}>
                        <td><div className="cell-primary">{m.name}</div></td>
                        <td>{m.role || '—'}</td>
                        <td><Badge tone="info">{m.days} day(s)</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!selectedProjectId && (
          <div className="card">
            <div className="card-header">
              <h3>By Project</h3>
            </div>
            {pieProjects.length === 0 ? (
              <div className="card-empty">No project data.</div>
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieProjects} dataKey="value" nameKey="name"
                      innerRadius={50} outerRadius={90} paddingAngle={3}
                      onClick={(d: any) => setSelectedSlice(prev => prev === d.name ? null : d.name)}
                      style={{ cursor: 'pointer' }}
                    >
                      {pieProjects.map((_: any, idx: number) => (
                        <Cell key={idx} fill={['#A100FF','#7300E6','#06b6d4','#10b981','#f59e0b','#ef4444'][idx % 6]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {selectedSlice && pieProjects.find((d: any) => d.name === selectedSlice) && sliceDetails && (
              <div className="pie-details">
                <h4>{selectedSlice} — Team Breakdown</h4>
                <table className="data-table">
                  <thead><tr><th>Member</th><th>Role</th><th>Total Days</th></tr></thead>
                  <tbody>
                    {sliceDetails.map((m: any) => (
                      <tr key={m.name}>
                        <td><div className="cell-primary">{m.name}</div></td>
                        <td>{m.role || '—'}</td>
                        <td><Badge tone="info">{m.days} day(s)</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><h3>Upcoming Public Holidays</h3></div>
          {upcomingHolidays.length === 0 ? (
            <div className="card-empty">No upcoming holidays found.</div>
          ) : (
            <div className="holiday-grid">
              {upcomingHolidays.map(h => (
                <div key={h.id} className="holiday-pill">
                  <div className="holiday-date">{new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { day: '2-digit' })}</div>
                  <div>
                    <div className="holiday-month">{new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}</div>
                    <div className="holiday-name">{h.name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Member view
  const myProject = projects[0];
  const projectMembers = members;
  const projectLeaves = leaves; // already filtered by backend to my project + me

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>My Dashboard</h1>
          <p className="page-sub">Hi {member?.name || user?.name}! Track your leaves and see what your team is up to.</p>
        </div>
        <div className="page-actions">
          <Button onClick={() => onNavigate('my-leaves')} icon={<IconPlus size={16} />}>Apply Leave</Button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card kpi-purple">
          <div className="kpi-icon"><IconProject size={22} /></div>
          <div>
            <div className="kpi-label">My Project</div>
            <div className="kpi-value" style={{ fontSize: 18 }}>{myProject?.name || '—'}</div>
            <div className="kpi-sub">{myProject?.code || 'Not assigned'}</div>
          </div>
        </div>
        <div className="kpi-card kpi-blue">
          <div className="kpi-icon"><IconUsers size={22} /></div>
          <div>
            <div className="kpi-label">Project Members</div>
            <div className="kpi-value">{projectMembers.length}</div>
            <div className="kpi-sub">in your team</div>
          </div>
        </div>
        <div className="kpi-card kpi-green">
          <div className="kpi-icon"><IconCalendar size={22} /></div>
          <div>
            <div className="kpi-label">My Upcoming</div>
            <div className="kpi-value">{leaves.filter(l => l.member_id === member?.id && l.end_date >= today).length}</div>
            <div className="kpi-sub">leaves planned</div>
          </div>
        </div>
        <div className="kpi-card kpi-amber">
          <div className="kpi-icon"><IconReport size={22} /></div>
          <div>
            <div className="kpi-label">My Pending</div>
            <div className="kpi-value">{leaves.filter(l => l.member_id === member?.id && l.status === 'Pending').length}</div>
            <div className="kpi-sub">
              {leaves.filter(l => l.member_id === member?.id && l.status === 'Rejected').length} rejected
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>My Project — {myProject?.name || 'N/A'}</h3>
          <Badge tone="info">{projectMembers.length} members</Badge>
        </div>
        {myProject ? (
          <>
            <p className="muted small" style={{ marginBottom: 12 }}>{myProject.description}</p>
            <div className="chip-wrap">
              {projectMembers.map(m => (
                <span key={m.id} className="chip">{m.name} • {m.role_name || 'No role'}</span>
              ))}
            </div>
          </>
        ) : (
          <div className="card-empty">You are not yet assigned to a project. Please contact your admin.</div>
        )}
      </div>

      <div className="card">
        <div className="card-header"><h3>Team Leave Plans</h3><Badge>{projectLeaves.length}</Badge></div>
        {projectLeaves.length === 0 ? (
          <div className="card-empty">No leave records in your project.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {projectLeaves.map(l => (
                <tr key={l.id}>
                  <td>
                    <div className="cell-primary">{l.member_name}{l.member_id === member?.id ? ' (You)' : ''}</div>
                    <div className="cell-sub">{l.role_name}</div>
                  </td>
                  <td><span className="pill" style={{ background: (LEAVE_COLORS[l.leave_type] || '#6366f1') + '22', color: LEAVE_COLORS[l.leave_type] || '#6366f1' }}>{l.leave_type}</span></td>
                  <td>{l.start_date}</td>
                  <td>{l.end_date}</td>
                  <td>{l.days}</td>
                  <td><Badge tone={l.status === 'Approved' ? 'success' : l.status === 'Pending' ? 'warning' : 'danger'}>{l.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header"><h3>Upcoming Public Holidays</h3></div>
        {upcomingHolidays.length === 0 ? (
          <div className="card-empty">No upcoming holidays.</div>
        ) : (
          <div className="holiday-grid">
            {upcomingHolidays.map(h => (
              <div key={h.id} className="holiday-pill">
                <div className="holiday-date">{new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { day: '2-digit' })}</div>
                <div>
                  <div className="holiday-month">{new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}</div>
                  <div className="holiday-name">{h.name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- Project Snapshot (members + 3-month leave bar chart) ----------
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const ProjectSnapshot: React.FC<{ project: Project; members: Member[]; leaves: Leave[] }> = ({ project, members, leaves }) => {
  // Compute previous 2 months + current month (3 buckets total)
  const now = new Date();
  const buckets: { key: string; label: string; year: number; month: number; start: string; end: string }[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    buckets.push({
      key:  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      start: start.toISOString().slice(0, 10),
      end:   end.toISOString().slice(0, 10),
    });
  }

  const monthData = buckets.map(b => {
    const inMonth = leaves.filter(l =>
      // overlap with month
      l.start_date <= b.end && l.end_date >= b.start
    );
    const totalDays = inMonth.reduce((acc, l) => acc + (l.days || 0), 0);
    const byMember: Record<number, number> = {};
    inMonth.forEach(l => { byMember[l.member_id] = (byMember[l.member_id] || 0) + (l.days || 0); });
    const memberRows = Object.entries(byMember).map(([mid, days]) => {
      const m = members.find(x => x.id === Number(mid));
      return { name: m?.name || `Member #${mid}`, days };
    }).sort((a, b) => b.days - a.days);
    return { ...b, totalDays, memberRows };
  });

  return (
    <div>
      <p className="muted small" style={{ marginBottom: 12 }}>
        {members.length} member(s) • {project.code || 'no code'} • {project.status}
      </p>

      <div className="dash-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <h4 style={{ marginBottom: 8 }}>Members</h4>
          {members.length === 0 ? (
            <div className="card-empty">No members in this project yet.</div>
          ) : (
            <ul className="leave-list">
              {members.map(m => (
                <li key={m.id} className="leave-list-item">
                  <div className="avatar small">{m.name.charAt(0).toUpperCase()}</div>
                  <div className="leave-list-info">
                    <div className="cell-primary">{m.name}</div>
                    <div className="cell-sub">{m.email} • {m.role_name || 'No role'}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 style={{ marginBottom: 8 }}>Leaves by month (last 3 months)</h4>
          {monthData.every(b => b.totalDays === 0) ? (
            <div className="card-empty">No leave taken in the last 3 months.</div>
          ) : (
            <>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={monthData.map(b => ({ name: b.label, days: b.totalDays }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" />
                    <YAxis fontSize={11} stroke="#94a3b8" allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="days" name="Leave days" fill="#A100FF" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chip-wrap" style={{ marginTop: 10 }}>
                {monthData.map(b => (
                  <div key={b.key} className="chip" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '8px 12px' }}>
                    <strong>{b.label}</strong>
                    <span className="muted small">{b.totalDays} day(s) total</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
