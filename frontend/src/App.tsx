import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Layouts
import AdminLayout from './components/Layout/AdminLayout';
import MemberLayout from './components/Layout/MemberLayout';
import PublicLayout from './components/Layout/PublicLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/admin/Dashboard';
import { MemberDashboard, MyPrograms, MyProgramDetail, MyAttendance, MyProfile } from './pages/member';
import { MemberList, MemberForm } from './pages/admin/members';
import { TeacherManagement, TeacherForm } from './pages/admin/teachers';
import { ProgramList, ProgramForm, ProgramDetail } from './pages/admin/programs';
import { RehearsalForm, RehearsalDetail } from './pages/admin/rehearsals';
import RehearsalHall from './pages/admin/RehearsalHall';
import { CalendarList } from './pages/admin/calendar';
import { VenueForm } from './pages/admin/venues';
import { BudgetList } from './pages/admin/budget';
import { SystemSettings } from './pages/admin/settings';
import { AttendanceOverview, ProgramAttendance } from './pages/public';
import Calendar from './pages/public/Calendar';

// Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading spinner component
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">加载中...</p>
      </div>
    </div>
  );
}

// Admin route wrapper - blocks member role from accessing /admin
function AdminRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Member role should go to member portal
  if (user?.role === 'member') {
    return <Navigate to="/member" replace />;
  }

  return <Outlet />;
}

// Member route wrapper - only allows member role
function MemberRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Non-member roles should go to admin
  if (user?.role !== 'member') {
    return <Navigate to="/admin" replace />;
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
              <Route path="/" element={<Calendar />} />
              <Route path="/attendance" element={<AttendanceOverview />} />
              <Route path="/attendance/programs/:id" element={<ProgramAttendance />} />
            </Route>

            {/* Protected member routes */}
            <Route element={<MemberRoute />}>
              <Route element={<MemberLayout />}>
                <Route path="/member" element={<MemberDashboard />} />
                <Route path="/member/programs" element={<MyPrograms />} />
                <Route path="/member/programs/:id" element={<MyProgramDetail />} />
                <Route path="/member/attendance" element={<MyAttendance />} />
                <Route path="/member/profile" element={<MyProfile />} />
              </Route>
            </Route>

            {/* Protected admin routes */}
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<Dashboard />} />

                {/* Members */}
                <Route path="/admin/members" element={<MemberList />} />
                <Route path="/admin/members/new" element={<MemberForm />} />
                <Route path="/admin/members/:id/edit" element={<MemberForm />} />

                {/* Teachers */}
                <Route path="/admin/teachers" element={<TeacherManagement />} />
                <Route path="/admin/teachers/new" element={<TeacherForm />} />
                <Route path="/admin/teachers/:id/edit" element={<TeacherForm />} />

                {/* Programs */}
                <Route path="/admin/programs" element={<ProgramList />} />
                <Route path="/admin/programs/new" element={<ProgramForm />} />
                <Route path="/admin/programs/:id" element={<ProgramDetail />} />
                <Route path="/admin/programs/:id/edit" element={<ProgramForm />} />

                {/* Rehearsal Hall (merged schedule + rehearsal management) */}
                <Route path="/admin/schedule" element={<RehearsalHall />} />

                {/* Rehearsal detail/edit/create */}
                <Route path="/admin/rehearsals" element={<Navigate to="/admin/schedule" replace />} />
                <Route path="/admin/rehearsals/new" element={<RehearsalForm />} />
                <Route path="/admin/rehearsals/:id" element={<RehearsalDetail />} />
                <Route path="/admin/rehearsals/:id/edit" element={<RehearsalForm />} />

                {/* Calendar */}
                <Route path="/admin/calendar" element={<CalendarList />} />

                {/* Venues (redirect to schedule) */}
                <Route path="/admin/venues" element={<Navigate to="/admin/schedule" replace />} />
                <Route path="/admin/venues/new" element={<VenueForm />} />
                <Route path="/admin/venues/:id/edit" element={<VenueForm />} />
                <Route path="/admin/venues/:id/schedule" element={<Navigate to="/admin/schedule" replace />} />

                {/* Budget */}
                <Route path="/admin/budget" element={<BudgetList />} />

                {/* Settings */}
                <Route path="/admin/settings" element={<SystemSettings />} />
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
