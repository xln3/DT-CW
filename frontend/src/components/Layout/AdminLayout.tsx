import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  Menu,
  X,
  Users,
  UserCheck,
  Music,
  Calendar,
  Settings,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import clsx from 'clsx';

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  roles?: string[];  // Allowed roles for this nav item
}

const navItems: NavItem[] = [
  {
    name: '仪表盘',
    path: '/admin',
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ['admin', 'committee', 'program_manager'],
  },
  {
    name: '队员管理',
    path: '/admin/members',
    icon: <Users className="w-5 h-5" />,
    roles: ['admin', 'committee', 'program_manager'],
  },
  {
    name: '教师管理',
    path: '/admin/teachers',
    icon: <UserCheck className="w-5 h-5" />,
    roles: ['admin', 'committee'],
  },
  {
    name: '节目管理',
    path: '/admin/programs',
    icon: <Music className="w-5 h-5" />,
    roles: ['admin', 'committee', 'program_manager'],
  },
  {
    name: '排练厅使用时间',
    path: '/admin/schedule',
    icon: <Calendar className="w-5 h-5" />,
    roles: ['admin', 'committee', 'program_manager'],
  },
  {
    name: '队历管理',
    path: '/admin/calendar',
    icon: <Calendar className="w-5 h-5" />,
    roles: ['admin', 'committee', 'program_manager'],
  },
  {
    name: '预算管理',
    path: '/admin/budget',
    icon: <DollarSign className="w-5 h-5" />,
    roles: ['admin', 'committee'],
  },
  {
    name: '系统设置',
    path: '/admin/settings',
    icon: <Settings className="w-5 h-5" />,
    roles: ['admin', 'committee'],
  },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;  // No role restriction
    return user?.role && item.roles.includes(user.role);
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <Link to="/admin" className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="w-7 h-7" />
            <span className="text-xl font-bold text-primary-600">THUDT</span>
          </Link>
          <button
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="px-4 py-4 space-y-1">
          {filteredNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors',
                location.pathname === item.path ||
                  (item.path !== '/admin' && location.pathname.startsWith(item.path))
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              <span className="ml-3">{item.name}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top header */}
        <header className="bg-white shadow-sm z-30">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1" />

            {/* User menu */}
            <div className="relative">
              <button
                className="flex items-center space-x-3 text-sm focus:outline-none"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-700 font-medium">
                    {user?.display_name?.charAt(0) || 'U'}
                  </span>
                </div>
                <span className="hidden md:block text-gray-700">{user?.display_name}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      <div className="px-4 py-2 text-sm text-gray-500 border-b">
                        {user?.username}
                        <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {user?.role === 'admin'
                            ? '管理员'
                            : user?.role === 'committee'
                            ? '队委'
                            : user?.role === 'program_manager'
                            ? '节目负责人'
                            : '队员'}
                        </span>
                      </div>
                      <Link
                        to="/admin/settings/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        个人设置
                      </Link>
                      <button
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                        onClick={handleLogout}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        退出登录
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
