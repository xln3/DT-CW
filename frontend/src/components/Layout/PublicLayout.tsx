import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Search, LogIn } from 'lucide-react';

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: '首页' },
    { path: '/attendance', icon: Users, label: '考勤总览' },
    { path: '/attendance/search', icon: Search, label: '查询考勤' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">DT</span>
                </div>
                <span className="text-xl font-bold text-gray-900">
                  THUDT 2026寒训
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Link>
              ))}
              <Link
                to="/login"
                className="ml-4 flex items-center px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                <LogIn className="w-4 h-4 mr-2" />
                管理登录
              </Link>
            </nav>

            {/* Mobile Navigation Button */}
            <div className="md:hidden flex items-center">
              <Link
                to="/login"
                className="p-2 text-gray-600 hover:text-primary-600"
              >
                <LogIn className="w-6 h-6" />
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden border-t bg-white">
          <div className="flex justify-around py-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center px-3 py-2 text-xs ${
                  isActive(item.path)
                    ? 'text-primary-600'
                    : 'text-gray-500'
                }`}
              >
                <item.icon className="w-5 h-5 mb-1" />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            THUDT 2026寒训 &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
