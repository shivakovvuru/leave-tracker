export type LeaveType = 'PL' | 'Sick Leave' | 'Unplanned Leave';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';
export type UserRole = 'admin' | 'member';

export interface User {
  id: number;
  email: string;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  mobile?: string | null;
  role: UserRole;
  approved: boolean;
}

export interface Member {
  id: number;
  user_id?: number | null;
  name: string;
  email: string;
  role_id?: number | null;
  role_name?: string;
  project_id?: number | null;
  project_name?: string;
  join_date?: string | null;
  avatar?: string | null;
  // Surfaced from the joined users row — only set when a user is linked
  first_name?: string | null;
  last_name?: string | null;
  mobile?: string | null;
}

export interface Role { id: number; name: string; }

export interface Project {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
  created_at?: string;
  member_count?: number;
}

export interface Leave {
  id: number;
  member_id: number;
  member_name?: string;
  member_email?: string;
  role_name?: string;
  project_id?: number | null;
  project_name?: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days?: number;
  reason?: string | null;
  status?: LeaveStatus;
  pending_update?: number;
  pending_data?: string | null;
  created_at?: string;
}

export interface PublicHoliday {
  id: number;
  date: string;
  name: string;
  fiscal_year_id?: number | null;
}

export interface FiscalYear {
  id: number;
  year: number;
  label?: string | null;
  active: number;
  created_at?: string;
}

export interface Notification {
  id: number;
  user_id: number;
  kind: string;
  message: string;
  leave_id?: number | null;
  read: number;
  created_at: string;
}
