import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Kanban, List, Users, Building2, Handshake,
  CalendarCheck, BarChart3, Settings, LogOut, Sparkles, ScrollText,
  PanelLeftClose, PanelLeftOpen, UserRound, Filter, ShieldCheck, Database
} from 'lucide-react';
import { useEffect, useState } from 'react';

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', tenantOnly: true },
  { to: '/funnel', icon: Filter, label: 'Funnel', tenantOnly: true },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline', tenantOnly: true },
  { to: '/deals', icon: List, label: 'Deals', tenantOnly: true },
  { to: '/contacts', icon: Users, label: 'Contacts', tenantOnly: true },
  { to: '/companies', icon: Building2, label: 'Companies', tenantOnly: true },
  { to: '/partners', icon: Handshake, label: 'Partners', tenantOnly: true },
  { to: '/activities', icon: CalendarCheck, label: 'Activities', tenantOnly: true },
  { to: '/ai-inbox', icon: Sparkles, label: 'AI Inbox', roles: ['admin'], tenantOnly: true },
  { to: '/ai-logs', icon: ScrollText, label: 'AI Logs', roles: ['admin'], tenantOnly: true },
  { to: '/saas-admin', icon: ShieldCheck, label: 'SaaS Admin', roles: ['admin'], globalAdminOnly: true },
  { to: '/database-viewer', icon: Database, label: 'Database Viewer', roles: ['admin'], globalAdminOnly: true },
  { to: '/reports', icon: BarChart3, label: 'Reports', tenantOnly: true },
  { to: '/settings', icon: Settings, label: 'Settings', roles: ['admin'], tenantOnly: true },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === null ? true : saved === 'true';
  });
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} sticky top-0 h-screen shrink-0 bg-gray-900 text-white flex flex-col transition-all duration-200`}>
      <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-6'} py-5 border-b border-gray-700`}>
        {!collapsed && <h1 className="text-xl font-bold">Pazo CRM</h1>}
        <button onClick={() => setCollapsed(!collapsed)} className="text-gray-400 hover:text-white transition-colors">
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems
          .filter((item) => {
            if (item.roles && !item.roles.includes(user?.role)) return false;
            const isGlobalAdmin = user?.role === 'admin' && !user?.client_id;
            if (item.globalAdminOnly && !isGlobalAdmin) return false;
            if (item.tenantOnly && isGlobalAdmin) return false;
            return true;
          })
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center ${collapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <item.icon size={20} />
              {!collapsed && item.label}
            </NavLink>
          ))}
      </nav>
      <div className="px-2 py-4 border-t border-gray-700">
        <button
          onClick={() => navigate('/profile')}
          title={collapsed ? 'Profile' : undefined}
          className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors`}
        >
          <UserRound size={20} />
          {!collapsed && (
            <div className="text-left min-w-0">
              <div className="font-medium text-white truncate">{user?.name}</div>
              <div className="text-xs truncate">{user?.role}</div>
            </div>
          )}
        </button>
        {!collapsed && (
          <div className="px-3 pt-2 text-xs text-gray-500 truncate">
            {user?.email}
          </div>
        )}
        <button
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
          className={`flex items-center ${collapsed ? 'justify-center' : ''} gap-3 px-3 py-2 mt-2 w-full rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors`}
        >
          <LogOut size={20} />
          {!collapsed && 'Logout'}
        </button>
      </div>
    </aside>
  );
}
