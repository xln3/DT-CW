import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Layouts
import AdminLayout from './components/Layout/AdminLayout';
import PublicLayout from './components/Layout/PublicLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/admin/Dashboard';
import { MemberList, MemberForm } from './pages/admin/members';
import { TeacherList, TeacherForm } from './pages/admin/teachers';
import { ProgramList, ProgramForm, ProgramDetail } from './pages/admin/programs';
import { RehearsalList, RehearsalForm, RehearsalDetail } from './pages/admin/rehearsals';
import { SemesterList, UserList, SettingsHub } from './pages/admin/settings';
import { Home, AttendanceOverview, ProgramAttendance, AttendanceSearch } from './pages/public';

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

// Public layout wrapper
function PublicLayoutWrapper() {
  return (
    <PublicLayout>
      <Outlet />
    </PublicLayout>
  );
}


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Login (standalone) */}
            <Route path="/login" element={<Login />} />

            {/* Public routes with layout */}
            <Route element={<PublicLayoutWrapper />}>
              <Route path="/" element={<Home />} />
              <Route path="/attendance" element={<AttendanceOverview />} />
              <Route path="/attendance/programs/:id" element={<ProgramAttendance />} />
              <Route path="/attendance/search" element={<AttendanceSearch />} />
            </Route>

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
                <Route path="/admin/settings" element={<SettingsHub />} />
                <Route path="/admin/settings/semesters" element={<SemesterList />} />
                <Route path="/admin/settings/users" element={<UserList />} />
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
