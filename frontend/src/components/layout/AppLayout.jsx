import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import useActivityReminders from '../../hooks/useActivityReminders';
import usePushSubscription from '../../hooks/usePushSubscription';
import { useAuth } from '../../context/AuthContext';

const SAAS_ADMIN_ALLOWED = ['/saas-admin', '/database-viewer', '/profile'];

export default function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  useActivityReminders();
  usePushSubscription();

  const isGlobalAdmin = user && user.role === 'admin' && !user.client_id;
  if (isGlobalAdmin && !SAAS_ADMIN_ALLOWED.some((p) => location.pathname.startsWith(p))) {
    return <Navigate to="/saas-admin" replace />;
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
