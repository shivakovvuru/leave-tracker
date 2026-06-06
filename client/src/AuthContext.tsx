import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Auth, Notifications as NotificationsApi } from './api';
import { User, Member, Notification } from './types';

type AuthState = {
  user: User | null;
  member: Member | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  // Notifications
  notifications: Notification[];
  unread: number;
  refreshNotifications: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markOneRead: (id: number) => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]   = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const refresh = async () => {
    try {
      const r = await Auth.me();
      setUser(r.user);
      setMember(r.member);
    } catch {
      setUser(null);
      setMember(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshNotifications = useCallback(async () => {
    if (!user) { setNotifications([]); setUnread(0); return; }
    try {
      const r = await NotificationsApi.list();
      setNotifications(r.items);
      setUnread(r.unread);
    } catch {
      setNotifications([]); setUnread(0);
    }
  }, [user]);

  useEffect(() => { refresh(); }, []);

  // Poll notifications every 30s once we have a user
  useEffect(() => {
    if (!user) return;
    refreshNotifications();
    const t = setInterval(refreshNotifications, 30000);
    return () => clearInterval(t);
  }, [user, refreshNotifications]);

  const login = async (email: string, password: string) => {
    const r = await Auth.login({ email, password });
    setUser(r.user);
    setMember(r.member);
  };
  const signup = async (name: string, email: string, password: string) => {
    const r = await Auth.signup({ name, email, password });
    return r.message;
  };
  const logout = async () => {
    await Auth.logout();
    setUser(null);
    setMember(null);
    setNotifications([]); setUnread(0);
  };
  const markAllRead = async () => {
    await NotificationsApi.markAll();
    setNotifications(ns => ns.map(n => ({ ...n, read: 1 })));
    setUnread(0);
  };
  const markOneRead = async (id: number) => {
    // Optimistic local update so the UI reflects the change immediately
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: 1 } : n));
    setUnread(u => Math.max(0, u - 1));
    try {
      await NotificationsApi.markOne(id);
    } catch {
      // If the call fails, refresh from the server to reconcile
      refreshNotifications();
    }
  };

  return (
    <Ctx.Provider value={{
      user, member, loading, login, signup, logout, refresh,
      notifications, unread, refreshNotifications, markAllRead, markOneRead,
    }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
