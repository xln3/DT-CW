import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Layouts
import AdminLayout from './components/Layout/AdminLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/admin/Dashboard';
import { MemberList, MemberForm } from './pages/admin/members';
import { TeacherList, TeacherForm } from './pages/admin/teachers';
import { ProgramList, ProgramForm, ProgramDetail } from './pages/admin/programs';
import { RehearsalList, RehearsalForm, RehearsalDetail } from './pages/admin/rehearsals';

// Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected route wrapper
function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

// Public home page (placeholder)
function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary-600">艺术团综合管理系统</h1>
          <a href="/login" className="btn-primary">
            登录管理后台
          </a>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="card">
          <div className="card-body text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">欢迎访问艺术团管理系统</h2>
            <p className="text-gray-600 mb-6">
              查看考勤公示、场地日历、预算公开等公开信息
            </p>
            <div className="flex justify-center space-x-4">
              <a href="/attendance" className="btn-secondary">考勤公示</a>
              <a href="/calendar" className="btn-secondary">队历日历</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Placeholder page
function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
      <div className="card">
        <div className="card-body text-center py-12">
          <p className="text-gray-500">系统设置功能开发中...</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} />

            {/* Protected admin routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<Dashboard />} />

                {/* Members */}
                <Route path="/admin/members" element={<MemberList />} />
                <Route path="/admin/members/new" element={<MemberForm />} />
                <Route path="/admin/members/:id/edit" element={<MemberForm />} />

                {/* Teachers */}
                <Route path="/admin/teachers" element={<TeacherList />} />
                <Route path="/admin/teachers/new" element={<TeacherForm />} />
                <Route path="/admin/teachers/:id/edit" element={<TeacherForm />} />

                {/* Programs */}
                <Route path="/admin/programs" element={<ProgramList />} />
                <Route path="/admin/programs/new" element={<ProgramForm />} />
                <Route path="/admin/programs/:id" element={<ProgramDetail />} />
                <Route path="/admin/programs/:id/edit" element={<ProgramForm />} />

                {/* Rehearsals */}
                <Route path="/admin/rehearsals" element={<RehearsalList />} />
                <Route path="/admin/rehearsals/new" element={<RehearsalForm />} />
                <Route path="/admin/rehearsals/:id" element={<RehearsalDetail />} />
                <Route path="/admin/rehearsals/:id/edit" element={<RehearsalForm />} />

                {/* Settings */}
                <Route path="/admin/settings" element={<Settings />} />
              </Route>
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
