import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Members from './pages/Members';
import CalendarPage from './pages/CalendarPage';
import Reports from './pages/Reports';
import Holidays from './pages/Holidays';
import MyLeaves from './pages/MyLeaves';
import Approvals from './pages/Approvals';
import Years from './pages/Years';
import MyProfile from './pages/MyProfile';
import Login from './pages/Login';
import Signup from './pages/Signup';

export type Page =
  | 'dashboard' | 'projects' | 'members' | 'calendar'
  | 'reports'  | 'holidays'  | 'my-leaves' | 'approvals' | 'years' | 'profile';

const ADMIN_PAGES: Page[] = ['dashboard', 'projects', 'members', 'calendar', 'reports', 'holidays', 'approvals', 'years'];
const MEMBER_PAGES: Page[] = ['dashboard', 'projects', 'calendar', 'my-leaves'];

const Inner: React.FC = () => {
  const { user, loading } = useAuth();
  const path = window.location.pathname;

  // Redirect unauthenticated users to /login via an effect (avoids side-effect-in-render)
  React.useEffect(() => {
    const isPublic = path === '/login' || path === '/signup';
    if (!loading && !user && !isPublic) window.location.href = '/login';
  }, [path, user, loading]);

  // Public routes
  if (path === '/login')  return <Login />;
  if (path === '/signup') return <Signup />;

  if (loading) {
    return <div className="auth-page"><div className="auth-card">Loading…</div></div>;
  }
  if (!user) return null;

  return <AppShell role={user.role} />;
};

const AppShell: React.FC<{ role: 'admin' | 'member' }> = ({ role }) => {
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Use History API to keep the URL in sync with the page
  useEffect(() => {
    const onPop = () => { /* browser back/forward — noop for now */ };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar current={page} role={role} onNavigate={setPage} open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />
      <div className="app-main">
        <Header onToggleSidebar={() => setSidebarOpen(o => !o)} onNavigate={setPage} />
        <main className="app-content">
          {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
          {page === 'projects'  && <Projects />}
          {page === 'members'   && role === 'admin' && <Members />}
          {page === 'calendar'  && <CalendarPage />}
          {page === 'reports'   && role === 'admin' && <Reports />}
          {page === 'holidays'  && role === 'admin' && <Holidays />}
          {page === 'my-leaves' && role === 'member' && <MyLeaves />}
          {page === 'approvals' && role === 'admin' && <Approvals />}
          {page === 'years'     && role === 'admin' && <Years />}
          {page === 'profile'   && <MyProfile />}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <Inner />
  </AuthProvider>
);

export default App;
