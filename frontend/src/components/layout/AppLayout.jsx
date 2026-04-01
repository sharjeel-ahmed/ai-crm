import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import useActivityReminders from '../../hooks/useActivityReminders';
import usePushSubscription from '../../hooks/usePushSubscription';

export default function AppLayout() {
  useActivityReminders();
  usePushSubscription();
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
