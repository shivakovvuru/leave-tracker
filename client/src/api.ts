import {
  Project, Member, Role, Leave, PublicHoliday, FiscalYear, User, LeaveType, LeaveStatus, Notification,
} from './types';

const API = process.env.REACT_APP_API_URL || '/api';

function getToken(): string | null { return localStorage.getItem('lt_token'); }
function setToken(t: string | null) { if (t) localStorage.setItem('lt_token', t); else localStorage.removeItem('lt_token'); }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { headers, ...init });
  if (res.status === 401) {
    setToken(null);
    if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
      window.location.href = '/login';
    }
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ===== Auth =====
export const Auth = {
  signup: (data: { email: string; password: string; name: string }) =>
    request<{ id: number; message: string }>('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  login: async (data: { email: string; password: string }) => {
    const r = await request<{ token: string; user: User; member: Member | null }>('/auth/login', {
      method: 'POST', body: JSON.stringify(data),
    });
    setToken(r.token);
    return r;
  },
  logout: async () => {
    try { await request('/auth/logout', { method: 'POST' }); } catch {}
    setToken(null);
  },
  me: () => request<{ user: User; member: Member | null }>('/auth/me'),
  pendingUsers: () => request<User[]>('/auth/pending-users'),
  approve: (id: number) => request(`/auth/approve/${id}`, { method: 'POST' }),
  reject:  (id: number) => request(`/auth/reject/${id}`,  { method: 'POST' }),
  updateProfile: (data: { first_name?: string; last_name?: string; mobile?: string; current_password?: string; new_password?: string }) =>
    request<{ user: User; passwordChanged: boolean }>('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
};

// ===== Notifications =====
export const Notifications = {
  list:   () => request<{ items: Notification[]; unread: number }>('/notifications'),
  markAll: () => request('/notifications/mark-read', { method: 'POST' }),
  markOne: (id: number) => request(`/notifications/${id}/read`, { method: 'POST' }),
};

// ===== Fiscal Years =====
export const Years = {
  list: () => request<FiscalYear[]>('/years'),
  create: (year: number, label?: string) =>
    request<{ id: number }>('/years', { method: 'POST', body: JSON.stringify({ year, label }) }),
  update: (id: number, data: { active?: boolean; label?: string }) =>
    request(`/years/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) => request(`/years/${id}`, { method: 'DELETE' }),
};

// ===== Roles =====
export const Roles = {
  list: () => request<Role[]>('/roles'),
  create: (name: string) => request<{ id: number; name: string }>('/roles', { method: 'POST', body: JSON.stringify({ name }) }),
  remove: (id: number) => request(`/roles/${id}`, { method: 'DELETE' }),
};

// ===== Projects =====
export const Projects = {
  list: () => request<Project[]>('/projects'),
  get: (id: number) => request<Project & { members: Member[] }>(`/projects/${id}`),
  create: (data: Partial<Project>) => request<{ id: number }>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Project>) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) => request(`/projects/${id}`, { method: 'DELETE' }),
};

// ===== Members =====
export const Members = {
  list: (project_id?: number) =>
    request<Member[]>(`/members${project_id ? `?project_id=${project_id}` : ''}`),
  create: (data: Partial<Member>) => request<{ id: number }>('/members', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Member>) => request(`/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) => request(`/members/${id}`, { method: 'DELETE' }),
};

// ===== Leaves =====
export const Leaves = {
  list: (params?: { member_id?: number; project_id?: number; start?: string; end?: string; leave_type?: LeaveType; status?: LeaveStatus }) => {
    const q = new URLSearchParams();
    if (params?.member_id)   q.set('member_id', String(params.member_id));
    if (params?.project_id)  q.set('project_id', String(params.project_id));
    if (params?.start)       q.set('start', params.start);
    if (params?.end)         q.set('end', params.end);
    if (params?.leave_type)  q.set('leave_type', params.leave_type);
    if (params?.status)      q.set('status', params.status);
    const qs = q.toString();
    return request<Leave[]>(`/leaves${qs ? `?${qs}` : ''}`);
  },
  create: (data: Partial<Leave>) => request<{ id: number; days: number; status: string }>('/leaves', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Leave> & { action?: 'approve_pending' | 'reject_pending' | 'cancel' | string }) =>
    request(`/leaves/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) => request(`/leaves/${id}`, { method: 'DELETE' }),
};

export const Holidays = {
  list: (year?: number) => request<PublicHoliday[]>(`/holidays${year ? `?year=${year}` : ''}`),
  create: (data: { date: string; name: string; fiscal_year_id?: number }) =>
    request<{ id: number }>('/holidays', { method: 'POST', body: JSON.stringify(data) }),
  remove: (id: number) => request(`/holidays/${id}`, { method: 'DELETE' }),
};

export const Reports = {
  summary: (params?: { project_id?: number; year?: number }) => {
    const q = new URLSearchParams();
    if (params?.project_id) q.set('project_id', String(params.project_id));
    if (params?.year)      q.set('year', String(params.year));
    const qs = q.toString();
    return request<{
      year: number;
      byType:        { leave_type: string; total_days: number; total_records: number }[];
      byMember:      { id: number; name: string; role_name: string; pl_days: number; sick_days: number; unplanned_days: number }[];
      byMonth:       { month: string; total_days: number }[];
      byProject:     { name: string; total_days: number; total_records: number }[];
      byMemberShare: { id: number; name: string; role_name: string; project_name: string; total_days: number }[];
    }>(`/reports/summary${qs ? `?${qs}` : ''}`);
  },
};
