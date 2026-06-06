import React from 'react';
import { Page } from '../App';
import { useAuth } from '../AuthContext';
import {
  IconDashboard, IconProject, IconUsers, IconCalendar,
  IconReport, IconSettings, IconClose, IconCheck,
} from './Icons';

type Item = { id: Page; label: string; Icon: React.FC<{ size?: number; className?: string }> };

const ADMIN_ITEMS: Item[] = [
  { id: 'dashboard', label: 'Dashboard',  Icon: IconDashboard },
  { id: 'projects',  label: 'Projects',   Icon: IconProject },
  { id: 'members',   label: 'Members',    Icon: IconUsers },
  { id: 'calendar',  label: 'Calendar',   Icon: IconCalendar },
  { id: 'approvals', label: 'Approvals',  Icon: IconCheck },
  { id: 'reports',   label: 'Reports',    Icon: IconReport },
  { id: 'years',     label: 'Years',      Icon: IconSettings },
  { id: 'holidays',  label: 'Holidays',   Icon: IconSettings },
  { id: 'profile',   label: 'My Profile', Icon: IconSettings },
];
const MEMBER_ITEMS: Item[] = [
  { id: 'dashboard', label: 'Dashboard',  Icon: IconDashboard },
  { id: 'projects',  label: 'My Project', Icon: IconProject },
  { id: 'calendar',  label: 'Calendar',   Icon: IconCalendar },
  { id: 'my-leaves', label: 'My Leaves',  Icon: IconCheck },
  { id: 'profile',   label: 'My Profile', Icon: IconSettings },
];

type Props = {
  current: Page;
  role: 'admin' | 'member';
  onNavigate: (p: Page) => void;
  open: boolean;
  onToggle: () => void;
};

const Sidebar: React.FC<Props> = ({ current, role, onNavigate, open, onToggle }) => {
  const { user, member, logout } = useAuth();
  const items = role === 'admin' ? ADMIN_ITEMS : MEMBER_ITEMS;
  const displayName = member?.name || user?.name || '';
  const displayRole = role === 'admin' ? 'Super Admin' : (member?.role_name || 'Member');
  const initial = (displayName || '?').charAt(0).toUpperCase();

  return (
    <aside className={`sidebar ${open ? 'open' : 'collapsed'}`}>
      <div className="sidebar-brand">
        <img src="/logo.svg" alt="logo" className="sidebar-logo" />
        {open && (
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-title">Leave Tracker</div>
            <div className="sidebar-brand-sub">{role === 'admin' ? 'Admin Console' : 'Member Portal'}</div>
          </div>
        )}
        <button className="sidebar-close" onClick={onToggle} aria-label="Toggle sidebar">
          <IconClose size={16} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {items.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`sidebar-link ${current === id ? 'active' : ''}`}
            onClick={() => onNavigate(id)}
            title={label}
          >
            <Icon size={20} />
            {open && <span>{label}</span>}
          </button>
        ))}
      </nav>

      {open && (
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{initial}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="sidebar-user-name">{displayName}</div>
              <div className="sidebar-user-role">{displayRole}</div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={async () => { await logout(); window.location.href = '/login'; }}>
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
