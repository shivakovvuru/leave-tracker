import React, { useEffect, useMemo, useState } from 'react';
import { Leaves, Members, Projects, Holidays, Years as YearsApi } from '../api';
import { Leave, LeaveType, Member, Project, PublicHoliday, FiscalYear } from '../types';
import { useAuth } from '../AuthContext';
import Modal from '../components/Modal';
import {
  Button, Field, Input, Select, Textarea, Badge,
} from '../components/FormControls';
import { IconPlus, IconEdit, IconTrash, IconChevronLeft, IconChevronRight, IconDownload, IconCheck } from '../components/Icons';

type View = 'year' | 'month' | 'week';

const LEAVE_COLORS: Record<LeaveType, string> = {
  'PL':             '#A100FF',
  'Sick Leave':     '#B42318',
  'Unplanned Leave':'#B54708',
};

const LEAVE_LABELS: Record<LeaveType, string> = {
  'PL':             'PL',
  'Sick Leave':     'Sick',
  'Unplanned Leave':'Unplanned',
};

const LEAVE_TYPES: LeaveType[] = ['PL', 'Sick Leave', 'Unplanned Leave'];

const CalendarPage: React.FC = () => {
  const { user, member } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [view, setView] = useState<View>('month');
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [activeYearId, setActiveYearId] = useState<number | null>(null);
  const [cursor, setCursor] = useState(new Date());
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterMember, setFilterMember] = useState<string>('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Leave | null>(null);
  const [form, setForm] = useState<Partial<Leave>>({});

  // Load fiscal years — only active ones are usable for the calendar
  useEffect(() => {
    YearsApi.list().then(ys => {
      const active = ys.filter(y => y.active);
      setFiscalYears(active);
      // Prefer the active year that contains today, so the calendar opens on
      // the current month instead of jumping to January.
      const today = new Date();
      const match = active.find(y => y.year === today.getFullYear()) || active[0];
      if (match) {
        setActiveYearId(match.id);
        const m = match.year === today.getFullYear() ? today.getMonth() : 0;
        setCursor(new Date(match.year, m, 1));
      }
    });
  }, []);

  // When the user changes the fiscal-year dropdown, keep the current month
  // visible — only swap the year, don't reset to January.
  useEffect(() => {
    if (!activeYearId) return;
    const fy = fiscalYears.find(y => y.id === activeYearId);
    if (!fy) return;
    setCursor(prev => {
      if (prev.getFullYear() === fy.year) return prev;
      return new Date(fy.year, prev.getMonth(), 1);
    });
  }, [activeYearId, fiscalYears]);

  const refresh = () => {
    Leaves.list().then(setLeaves);
    Holidays.list().then(setHolidays);
    Members.list().then(setMembers);
    Projects.list().then(setProjects);
  };
  useEffect(refresh, []);
  // Refetch on focus/visibility — picks up admin approvals/cancels in another tab
  useEffect(() => {
    const onVis = () => { if (!document.hidden) refresh(); };
    const onFocus = () => refresh();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // For members, restrict available filters
  const visibleLeaves = useMemo(() => {
    return leaves.filter(l => {
      if (filterProject && String(l.project_id || '') !== filterProject) return false;
      if (filterMember && String(l.member_id) !== filterMember) return false;
      return true;
    });
  }, [leaves, filterProject, filterMember]);

  const navigate = (delta: number) => {
    const d = new Date(cursor);
    if (view === 'year') d.setFullYear(d.getFullYear() + delta);
    else if (view === 'month') d.setMonth(d.getMonth() + delta);
    else d.setDate(d.getDate() + delta * 7);
    setCursor(d);
  };
  const goToday = () => {
    const fy = fiscalYears.find(y => y.year === new Date().getFullYear());
    if (fy) setActiveYearId(fy.id);
    setCursor(new Date());
  };

  const todayStr  = new Date().toISOString().slice(0, 10);
  const maxDateStr = (() => { const d = new Date(); d.setDate(d.getDate() + 90); return d.toISOString().slice(0, 10); })();

  const openAdd = (date?: string) => {
    // Guard: only allow apply/leave in the active fiscal year
    const fy = fiscalYears.find(y => y.id === activeYearId);
    const target = date || new Date().toISOString().slice(0, 10);
    if (fy) {
      const yearStart = `${fy.year}-01-01`;
      const yearEnd   = `${fy.year}-12-31`;
      if (target < yearStart || target > yearEnd) {
        alert(`Fiscal year ${fy.year} is not active. Activate it in Years to apply leave.`);
        return;
      }
    } else {
      alert('No active fiscal year. Ask the admin to activate one in Years.');
      return;
    }
    // Past / future window
    if (target < todayStr) {
      alert('Cannot apply leave for past dates.'); return;
    }
    if (target > maxDateStr) {
      alert(`Cannot apply leave more than 3 months in advance (max ${maxDateStr}).`); return;
    }
    // Guard: weekends are not leave-eligible
    const targetDow = new Date(target + 'T00:00:00').getDay();
    if (targetDow === 0 || targetDow === 6) {
      alert('Leaves cannot be applied on weekends (Saturday / Sunday). Pick a weekday.');
      return;
    }
    setEditing(null);
    setForm({
      leave_type: 'PL',
      start_date: target,
      end_date:   target,
    });
    setShowModal(true);
  };
  const openEdit = (l: Leave) => {
    setEditing(l);
    setForm({ leave_type: l.leave_type, start_date: l.start_date, end_date: l.end_date, reason: l.reason || '' });
    setShowModal(true);
  };
  const save = async () => {
    try {
      if (editing) await Leaves.update(editing.id, form);
      else         await Leaves.create(form);
      setShowModal(false);
      refresh();
    } catch (e) {
      alert((e as Error).message);
    }
  };
  const remove = async (id: number) => {
    if (!window.confirm('Delete this leave record? (Admin only)')) return;
    try { await Leaves.remove(id); refresh(); } catch (e: any) { alert(e.message); }
  };
  const cancel = async (l: Leave) => {
    if (l.status === 'Approved' && !isAdmin) {
      alert('You can only cancel a Pending leave. Ask your admin to cancel an approved leave.');
      return;
    }
    const msg = isAdmin
      ? 'Cancel this leave? The member will be notified.'
      : 'Cancel this Pending leave?';
    if (!window.confirm(msg)) return;
    try {
      await Leaves.update(l.id, { action: 'cancel' });
      refresh();
    } catch (e: any) { alert(e.message); }
  };
  const approve = async (id: number) => {
    await Leaves.update(id, { status: 'Approved' });
    refresh();
  };

  const exportCsv = () => {
    const rows = [
      ['Member', 'Role', 'Project', 'Type', 'Start', 'End', 'Days', 'Status', 'Reason'],
      ...visibleLeaves.map(l => [
        l.member_name, l.role_name, l.project_name, l.leave_type,
        l.start_date, l.end_date, String(l.days || ''), l.status, l.reason || '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leaves-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const title = view === 'year'
    ? cursor.getFullYear().toString()
    : view === 'month'
      ? cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : `Week of ${getWeekStart(cursor).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Calendar</h1>
          <p className="page-sub">
            {isAdmin
              ? 'View and manage all leaves, public holidays and unplanned leaves.'
              : 'View your leaves and your project teammates\' leave plans. Apply or update your own.'}
          </p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" onClick={exportCsv} icon={<IconDownload size={16} />}>Export CSV</Button>
          <Button onClick={() => openAdd()} icon={<IconPlus size={16} />}>Apply Leave</Button>
        </div>
      </div>

      <div className="toolbar">
        <div className="view-switch">
          <button className={view === 'year'  ? 'active' : ''} onClick={() => setView('year')}>Year</button>
          <button className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>Month</button>
          <button className={view === 'week'  ? 'active' : ''} onClick={() => setView('week')}>Week</button>
        </div>
        <div className="nav-group">
          <button className="icon-btn" onClick={() => navigate(-1)}><IconChevronLeft size={16} /></button>
          <Button variant="secondary" size="sm" onClick={goToday}>Today</Button>
          <button className="icon-btn" onClick={() => navigate(1)}><IconChevronRight size={16} /></button>
        </div>
        <div className="calendar-title">{title}</div>
        <select className="select" value={activeYearId || ''} onChange={e => setActiveYearId(Number(e.target.value))}>
          {fiscalYears.map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
        </select>
        {isAdmin && (
          <>
            <select className="select" value={filterMember} onChange={e => setFilterMember(e.target.value)}>
              <option value="">All Members</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select className="select" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </>
        )}
      </div>

      <div className="legend">
        {LEAVE_TYPES.map(t => (
          <span key={t} className="legend-item">
            <span className="dot" style={{ background: LEAVE_COLORS[t] }} /> {t}
          </span>
        ))}
        <span className="legend-item"><span className="dot weekend" /> Weekend (Sat / Sun)</span>
        <span className="legend-item"><span className="dot" style={{ background: '#10b981' }} /> Public Holiday</span>
      </div>

      <div className="card calendar-card">
        {view === 'year'  && <YearView  cursor={cursor} leaves={visibleLeaves} holidays={holidays} onAdd={openAdd} />}
        {view === 'month' && <MonthView cursor={cursor} leaves={visibleLeaves} holidays={holidays} onAdd={openAdd} />}
        {view === 'week'  && <WeekView  cursor={cursor} leaves={visibleLeaves} holidays={holidays} onAdd={openAdd} />}
      </div>

      <div className="card">
        <div className="card-header"><h3>Leave Records</h3></div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Member</th><th>Type</th><th>Project</th>
              <th>Start</th><th>End</th><th>Days</th>
              <th>Status</th><th>Reason</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visibleLeaves.length === 0 ? (
              <tr><td colSpan={9} className="cell-empty">No leave records match the filters.</td></tr>
            ) : visibleLeaves.map(l => {
              const canEdit = isAdmin || l.member_id === member?.id;
              return (
                <tr key={l.id}>
                  <td>
                    <div className="cell-primary">{l.member_name}</div>
                    <div className="cell-sub">{l.role_name}</div>
                  </td>
                  <td>
                    <span className="pill" style={{ background: LEAVE_COLORS[l.leave_type] + '22', color: LEAVE_COLORS[l.leave_type] }}>
                      {l.leave_type}
                    </span>
                  </td>
                  <td>{l.project_name || '—'}</td>
                  <td>{l.start_date}</td>
                  <td>{l.end_date}</td>
                  <td>{l.days}</td>
                  <td>
                    <Badge tone={l.status === 'Approved' ? 'success' : l.status === 'Pending' ? 'warning' : 'danger'}>
                      {l.status}
                    </Badge>
                    {l.pending_update === 1 && <Badge tone="warning">Awaiting Admin</Badge>}
                  </td>
                  <td className="truncate">{l.reason || '—'}</td>
                  <td>
                    <div className="row-actions">
                      {canEdit && (
                        <button className="icon-btn" onClick={() => openEdit(l)}><IconEdit size={14} /></button>
                      )}
                      {isAdmin && l.status === 'Pending' && (
                        <button className="icon-btn" onClick={() => approve(l.id)} title="Approve" style={{ color: '#047857' }}>
                          <IconCheck size={14} />
                        </button>
                      )}
                      {/* Cancel: members on their own Pending, admins on any */}
                      {((!isAdmin && canEdit && l.status === 'Pending') || isAdmin) && (
                        <button className="icon-btn danger" onClick={() => cancel(l)} title="Cancel leave">
                          <IconTrash size={14} />
                        </button>
                      )}
                      {isAdmin && (
                        <button className="icon-btn danger" onClick={() => remove(l.id)} title="Delete"><IconTrash size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={showModal}
        title={editing ? (isAdmin ? 'Edit Leave' : 'Request Leave Change') : 'Apply for Leave'}
        onClose={() => setShowModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? (isAdmin ? 'Save' : 'Submit for Approval') : 'Submit'}</Button>
          </>
        }
      >
        <div className="form-grid">
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Leave Type" required>
              <Select value={form.leave_type || 'PL'} onChange={e => setForm({ ...form, leave_type: e.target.value as LeaveType })}>
                {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Start Date" required hint="Today through 90 days from now">
            <Input
              type="date"
              value={form.start_date || ''}
              min={todayStr}
              max={maxDateStr}
              onChange={e => setForm({ ...form, start_date: e.target.value })}
            />
          </Field>
          <Field label="End Date" required hint="Today through 90 days from now">
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
              <Textarea rows={2} value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ---------- helpers ----------
function getWeekStart(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  r.setDate(r.getDate() + diff);
  return r;
}
function fmt(d: Date): string { return d.toISOString().slice(0, 10); }
function isWeekend(d: Date) { const w = d.getDay(); return w === 0 || w === 6; }
function getLeavesForDate(date: Date, leaves: Leave[], holidays: PublicHoliday[]) {
  const ds = fmt(date);
  if (isWeekend(date)) return [{ type: 'weekend' as const }];
  const out: any[] = [];
  for (const l of leaves) {
    if (l.start_date <= ds && l.end_date >= ds) out.push({ type: l.leave_type, items: [l] });
  }
  for (const h of holidays) {
    if (h.date === ds) out.push({ type: 'Public Holiday', label: h.name });
  }
  return out;
}

const YearView: React.FC<{ cursor: Date; leaves: Leave[]; holidays: PublicHoliday[]; onAdd: (d: string) => void }> = ({ cursor, leaves, holidays, onAdd }) => {
  const year = cursor.getFullYear();
  return (
    <div className="year-grid">
      {Array.from({ length: 12 }).map((_, m) => {
        const first = new Date(year, m, 1);
        const last  = new Date(year, m + 1, 0);
        const startWeekday = (first.getDay() + 6) % 7;
        const days = last.getDate();
        return (
          <div key={m} className="mini-month">
            <div className="mini-month-title">{first.toLocaleDateString('en-US', { month: 'long' })}</div>
            <div className="mini-weekdays">
              {['M','T','W','T','F','S','S'].map((d, i) => <span key={i} className={i >= 5 ? 'we' : ''}>{d}</span>)}
            </div>
            <div className="mini-grid">
              {Array.from({ length: startWeekday }).map((_, i) => <span key={'p'+i} />)}
              {Array.from({ length: days }).map((_, d) => {
                const date = new Date(year, m, d + 1);
                const marks = getLeavesForDate(date, leaves, holidays);
                const weekend = isWeekend(date);
                return (
                  <button
                    key={d}
                    className={`mini-cell ${weekend ? 'we disabled' : ''}`}
                    onClick={() => { if (!weekend) onAdd(fmt(date)); }}
                    disabled={weekend}
                    aria-disabled={weekend}
                    title={weekend ? 'Weekend — leaves cannot be applied' : marks.map(m => m.label || m.type).join(', ')}
                  >
                    <span className="mini-day">{d + 1}</span>
                    <div className="mini-marks">
                      {marks.slice(0, 3).map((m, i) => (
                        <span key={i} className={`mini-mark mark-${m.type.toString().replace(/\s/g, '')}`} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const MonthView: React.FC<{ cursor: Date; leaves: Leave[]; holidays: PublicHoliday[]; onAdd: (d: string) => void }> = ({ cursor, leaves, holidays, onAdd }) => {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const startWeekday = (first.getDay() + 6) % 7;
  const days = last.getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="month-grid">
      <div className="month-weekdays">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => (
          <div key={d} className={i >= 5 ? 'month-weekday weekend' : 'month-weekday'}>{d}</div>
        ))}
      </div>
      <div className="month-cells">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="month-cell empty" />;
          const marks = getLeavesForDate(d, leaves, holidays);
          const weekend = isWeekend(d);
          const isToday = fmt(d) === fmt(new Date());
          return (
            <button
              key={i}
              className={`month-cell ${weekend ? 'weekend disabled' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => { if (!weekend) onAdd(fmt(d)); }}
              disabled={weekend}
              aria-disabled={weekend}
              title={weekend ? 'Weekend — leaves cannot be applied' : undefined}
            >
              <div className="month-day-num">{d.getDate()}</div>
              <div className="month-marks">
                {marks.slice(0, 3).map((m, k) => (
                  <span key={k} className={`month-mark mark-${m.type.toString().replace(/\s/g, '')}`} title={m.label || m.type}>
                    {m.label || LEAVE_LABELS[m.type as LeaveType] || m.type}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const WeekView: React.FC<{ cursor: Date; leaves: Leave[]; holidays: PublicHoliday[]; onAdd: (d: string) => void }> = ({ cursor, leaves, holidays, onAdd }) => {
  const start = getWeekStart(cursor);
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i); return d;
  });
  return (
    <div className="week-grid">
      {days.map(d => {
        const marks = getLeavesForDate(d, leaves, holidays);
        const weekend = isWeekend(d);
        const isToday = fmt(d) === fmt(new Date());
        return (
          <div key={fmt(d)} className={`week-col ${weekend ? 'weekend' : ''} ${isToday ? 'today' : ''}`}>
            <div className="week-day-head">
              <div className="week-dow">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
              <div className="week-dom">{d.getDate()}</div>
            </div>
            <button
              className="week-add"
              onClick={() => { if (!weekend) onAdd(fmt(d)); }}
              disabled={weekend}
              title={weekend ? 'Weekend — leaves cannot be applied' : 'Apply leave on this day'}
            >+ Apply</button>
            <div className="week-marks">
              {marks.length === 0 ? (
                <div className="muted small">No entries</div>
              ) : marks.map((m, k) => (
                <div key={k} className={`week-mark mark-${m.type.toString().replace(/\s/g, '')}`}>
                  {m.label || LEAVE_LABELS[m.type as LeaveType] || m.type}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CalendarPage;
