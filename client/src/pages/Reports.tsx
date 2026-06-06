import React, { useEffect, useState } from 'react';
import { Reports as ReportsApi, Projects, Years as YearsApi } from '../api';
import { Project, FiscalYear } from '../types';
import { Button, Badge, Field, Select } from '../components/FormControls';
import { IconDownload } from '../components/Icons';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid, LineChart, Line,
} from 'recharts';

const COLORS: Record<string, string> = {
  'PL':              '#A100FF',
  'Sick Leave':      '#B42318',
  'Unplanned Leave': '#B54708',
};

const Reports: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [projectId, setProjectId] = useState<string>('');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    Projects.list().then(setProjects);
    YearsApi.list().then(ys => {
      setYears(ys);
      if (ys.length && !ys.find(y => y.year === year)) setYear(ys[0].year);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    ReportsApi.summary({ year, project_id: projectId ? Number(projectId) : undefined })
      .then(setData);
  }, [year, projectId]);

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthData = (data?.byMonth || []).map((m: any) => ({
    name: monthNames[Number(m.month) - 1] || m.month,
    days: m.total_days,
  }));

  const pieData = (data?.byType || []).map((t: any) => ({
    name: t.leave_type,
    value: t.total_days,
  }));

  const exportCsv = () => {
    if (!data) return;
    const rows: string[][] = [
      ['Type', 'Total Days', 'Records'],
      ...(data.byType as any[]).map(t => [t.leave_type, String(t.total_days), String(t.total_records)]),
      [],
      ['Member', 'Role', 'PL Days', 'Sick Days', 'Unplanned Days'],
      ...(data.byMember as any[]).map(m => [m.name, m.role_name || '', String(m.pl_days), String(m.sick_days), String(m.unplanned_days)]),
    ];
    const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leave-report-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p className="page-sub">Generate insights on team availability, leave usage and trends.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" onClick={exportCsv} icon={<IconDownload size={16} />}>Export CSV</Button>
        </div>
      </div>

      <div className="toolbar">
        <Field label="Year">
          <Select value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y.id} value={y.year}>{y.year}</option>)}
          </Select>
        </Field>
        <Field label="Project">
          <Select value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      </div>

      {data && (
        <>
          <div className="kpi-grid">
            {['PL', 'Sick Leave', 'Unplanned Leave'].map(type => {
              const t = (data.byType as any[]).find(x => x.leave_type === type);
              return (
                <div key={type} className="kpi-card" style={{ borderTop: `3px solid ${COLORS[type] || '#94a3b8'}` }}>
                  <div>
                    <div className="kpi-label">{type}</div>
                    <div className="kpi-value">{t ? t.total_days : 0}</div>
                    <div className="kpi-sub">days • {t ? t.total_records : 0} record(s)</div>
                  </div>
                </div>
              );
            })}
            <div className="kpi-card kpi-purple">
              <div>
                <div className="kpi-label">Members Tracked</div>
                <div className="kpi-value">{data.byMember.length}</div>
                <div className="kpi-sub">in selected scope</div>
              </div>
            </div>
          </div>

          <div className="dash-row">
            <div className="card">
              <div className="card-header"><h3>Monthly Leave Trend</h3></div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={monthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip />
                    <Line type="monotone" dataKey="days" stroke="#A100FF" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3>Leave Type Distribution</h3></div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                      {pieData.map((entry: any, idx: number) => (
                        <Cell key={idx} fill={COLORS[entry.name] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Per-Member Leave Usage ({year})</h3></div>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={data.byMember}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} interval={0} angle={-15} dy={10} height={60} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="pl_days"        name="PL"        stackId="a" fill="#A100FF" />
                  <Bar dataKey="sick_days"     name="Sick"      stackId="a" fill="#B42318" />
                  <Bar dataKey="unplanned_days" name="Unplanned" stackId="a" fill="#B54708" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Member Summary</h3></div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th><th>Role</th>
                  <th>PL Days</th><th>Sick Days</th><th>Unplanned</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.byMember.length === 0 ? (
                  <tr><td colSpan={6} className="cell-empty">No data for the selected filters.</td></tr>
                ) : data.byMember.map((m: any) => {
                  const total = (m.pl_days || 0) + (m.sick_days || 0) + (m.unplanned_days || 0);
                  return (
                    <tr key={m.id}>
                      <td><div className="cell-primary">{m.name}</div></td>
                      <td><Badge tone="purple">{m.role_name || '—'}</Badge></td>
                      <td>{m.pl_days}</td>
                      <td>{m.sick_days}</td>
                      <td>{m.unplanned_days}</td>
                      <td><Badge tone="info">{total} day(s)</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
