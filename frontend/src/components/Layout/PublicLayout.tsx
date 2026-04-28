import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, LogIn } from 'lucide-react';

const SITE_TITLE = 'THUDT 2026春季训练';

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Users, label: '考勤总览' },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/attendance');
    }
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
                  {SITE_TITLE}
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
                className="ml-4 inline-flex items-center px-5 py-2.5 bg-primary-600 text-white rounded-md text-base font-semibold shadow-md hover:bg-primary-700 hover:shadow-lg transition-all"
              >
                <LogIn className="w-5 h-5 mr-2" />
                登录
              </Link>
            </nav>

            {/* Mobile login button */}
            <div className="md:hidden flex items-center">
              <Link
                to="/login"
                className="inline-flex items-center px-3 py-2 bg-primary-600 text-white rounded-md text-sm font-semibold shadow-md hover:bg-primary-700 transition-colors"
              >
                <LogIn className="w-4 h-4 mr-1.5" />
                登录
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            {SITE_TITLE} &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
