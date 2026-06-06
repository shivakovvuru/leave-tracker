import React, { useEffect, useRef, useState } from 'react';
import { IconSearch, IconBell, IconCalendar } from './Icons';
import { useAuth } from '../AuthContext';
import { Badge } from './FormControls';

type Props = { onToggleSidebar: () => void; onNavigate?: (page: any) => void };

const KIND_TONE: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  leave_submitted: 'info',
  leave_approved:  'success',
  leave_rejected:  'danger',
  leave_cancelled: 'default',
  leave_changed:   'warning',
};

const Header: React.FC<Props> = ({ onToggleSidebar, onNavigate }) => {
  const { user, member, notifications, unread, markAllRead, markOneRead } = useAuth();
  const displayName = member?.name || user?.name || '';
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <header className="app-header">
      <div className="app-header-left">
        <button className="header-toggle" onClick={onToggleSidebar} aria-label="Toggle menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <div className="header-search">
          <IconSearch size={18} className="header-search-icon" />
          <input placeholder="Search projects, members, leaves..." />
        </div>
      </div>
      <div className="app-header-right">
        <div className="header-date">
          <IconCalendar size={16} className="header-date-icon" />
          <span>{today}</span>
        </div>
        <div className="header-bell-wrap" ref={bellRef}>
          <button
            className="header-bell"
            aria-label="Notifications"
            onClick={() => setOpen(o => !o)}
          >
            <IconBell size={20} />
            {unread > 0 && <span className="header-bell-badge">{unread > 9 ? '9+' : unread}</span>}
          </button>
          {open && (
            <div className="notif-dropdown" role="menu">
              <div className="notif-header">
                <strong>Notifications</strong>
                {unread > 0 && (
                  <button className="notif-clear" onClick={async () => { await markAllRead(); }}>
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="notif-empty">No notifications yet.</div>
              ) : (
                <ul className="notif-list">
                  {notifications.map(n => (
                    <li
                      key={n.id}
                      className={`notif-item ${n.read ? '' : 'unread'}`}
                      onClick={() => {
                        if (!n.read) markOneRead(n.id);
                        setOpen(false);
                        if (onNavigate) {
                          // Route the user to the right place
                          if (n.kind === 'leave_approved' || n.kind === 'leave_rejected') {
                            onNavigate(user?.role === 'admin' ? 'calendar' : 'my-leaves');
                          } else {
                            onNavigate(user?.role === 'admin' ? 'approvals' : 'calendar');
                          }
                        }
                      }}
                    >
                      <div className="notif-row">
                        <Badge tone={KIND_TONE[n.kind] || 'default'}>
                          {n.kind.replace('leave_', '')}
                        </Badge>
                        <span className="notif-time">{(n.created_at || '').slice(0, 16).replace('T', ' ')}</span>
                      </div>
                      <div className="notif-msg">{n.message}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <button className="header-user header-user-button" onClick={() => onNavigate && onNavigate('profile')} title="Open my profile">
          <div className="avatar">{displayName.charAt(0).toUpperCase()}</div>
          <div className="header-user-info">
            <div className="header-user-name">{displayName}</div>
            <div className="header-user-role">{user?.email}</div>
          </div>
        </button>
      </div>
    </header>
  );
};

export default Header;
