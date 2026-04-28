import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type {
  User,
  Member,
  Teacher,
  Program,
  Rehearsal,
  Attendance,
  LoginForm,
  MemberForm,
  TeacherForm,
  ProgramForm,
  RehearsalForm,
  Venue,
  VenueBooking,
  VenueTimeSlot,
  VenueForm,
  VenueBookingForm,
  VenueScheduleDay,
  TeacherEntryApplication,
  TeacherEntryApplicationForm,
  PaymentSource,
  TeacherPayment,
  TeacherPaymentForm,
  BudgetCategory,
  Budget,
  Expense,
  BudgetForm,
  ExpenseForm,
  Semester,
  SemesterType,
  WeekScheduleData,
  ScheduleEvent,
  RecognitionResult,
  OverviewMatrixData,
  ProgramMatrixData,
  PaginatedResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
let accessToken: string | null = null;
let refreshToken: string | null = null;

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
};

export const getTokens = () => {
  // Always sync from localStorage to ensure we have the latest tokens
  const storedAccess = localStorage.getItem('accessToken');
  const storedRefresh = localStorage.getItem('refreshToken');
  if (storedAccess) accessToken = storedAccess;
  if (storedRefresh) refreshToken = storedRefresh;
  return { accessToken, refreshToken };
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = getTokens();
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Check error type from response
    const errorData = error.response?.data as { error?: string; message?: string } | undefined;
    const isTokenExpired = error.response?.status === 401 && errorData?.error === 'token_expired';

    if (isTokenExpired && !originalRequest._retry) {
      originalRequest._retry = true;

      const { refreshToken } = getTokens();
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, null, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          });

          const newAccessToken = response.data.access_token;
          setTokens(newAccessToken, refreshToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          return api(originalRequest);
        } catch (refreshError) {
          clearTokens();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token, clear everything and redirect to login
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    // For authorization_required (missing token), redirect to login
    if (error.response?.status === 401 && errorData?.error === 'authorization_required') {
      clearTokens();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // For other 401 errors (invalid_token, etc.), let the error propagate
    // so the UI can display the error message
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (data: LoginForm) => {
    const response = await api.post<{
      access_token: string;
      refresh_token: string;
      user: User;
      permissions: string[];
    }>('/auth/login', data);
    return response.data;
  },

  logout: async () => {
    await api.post('/auth/logout');
    clearTokens();
  },

  getMe: async () => {
    const response = await api.get<{ user: User; permissions: string[] }>('/auth/me');
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },

  updateProfile: async (data: {
    username?: string;
    display_name?: string;
    email?: string;
    phone?: string;
    gender?: string;
    department?: string;
    grade?: string;
    student_id?: string;
    member_phone?: string;
  }) => {
    const response = await api.put('/auth/profile', data);
    return response.data;
  },
};

// Members API
export const membersApi = {
  list: async (params?: { status?: string; search?: string; sort?: string; graduating?: string }) => {
    const response = await api.get<{ members: Member[] }>('/admin/members', { params });
    return response.data.members;
  },

  listPaginated: async (params: { status?: string; search?: string; sort?: string; graduating?: string; page: number; per_page?: number }) => {
    const response = await api.get<PaginatedResponse<Member>>('/admin/members', { params });
    return response.data;
  },

  get: async (id: number) => {
    const response = await api.get<{ member: Member }>(`/admin/members/${id}`);
    return response.data.member;
  },

  create: async (data: MemberForm) => {
    const response = await api.post<{ member: Member }>('/admin/members', data);
    return response.data.member;
  },

  update: async (id: number, data: Partial<MemberForm>) => {
    const response = await api.put<{ member: Member }>(`/admin/members/${id}`, data);
    return response.data.member;
  },

  delete: async (id: number) => {
    await api.delete(`/admin/members/${id}`);
  },

  batchCreate: async (members: MemberForm[]) => {
    const response = await api.post<{ created_count: number; errors: string[] }>(
      '/admin/members/batch',
      { members }
    );
    return response.data;
  },

  importCsv: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<{
      message: string;
      created_count: number;
      updated_count: number;
      skipped_count: number;
      errors: string[];
    }>('/admin/members/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  downloadTemplate: () => {
    return `${api.defaults.baseURL}/admin/members/import-template`;
  },
};

// Teachers API
export const teachersApi = {
  list: async (params?: { status?: string; search?: string }) => {
    const response = await api.get<{ teachers: Teacher[] }>('/admin/teachers', { params });
    return response.data.teachers;
  },

  get: async (id: number) => {
    const response = await api.get<{ teacher: Teacher }>(`/admin/teachers/${id}`);
    return response.data.teacher;
  },

  create: async (data: TeacherForm) => {
    const response = await api.post<{ teacher: Teacher }>('/admin/teachers', data);
    return response.data.teacher;
  },

  update: async (id: number, data: Partial<TeacherForm>) => {
    const response = await api.put<{ teacher: Teacher }>(`/admin/teachers/${id}`, data);
    return response.data.teacher;
  },

  delete: async (id: number) => {
    await api.delete(`/admin/teachers/${id}`);
  },
};

// Programs API
export const programsApi = {
  list: async (params?: { semester_id?: number; status?: string; category?: string }) => {
    const response = await api.get<{ programs: Program[] }>('/admin/programs', { params });
    return response.data.programs;
  },

  get: async (id: number, options?: { include_members?: boolean; include_rehearsals?: boolean }) => {
    const response = await api.get<{ program: Program }>(`/admin/programs/${id}`, { params: options });
    return response.data.program;
  },

  create: async (data: ProgramForm) => {
    const response = await api.post<{ program: Program }>('/admin/programs', data);
    return response.data.program;
  },

  update: async (id: number, data: Partial<ProgramForm>) => {
    const response = await api.put<{ program: Program }>(`/admin/programs/${id}`, data);
    return response.data.program;
  },

  delete: async (id: number) => {
    await api.delete(`/admin/programs/${id}`);
  },

  getMembers: async (programId: number, params?: { include_left?: boolean }) => {
    const response = await api.get<{
      members: { member: Member; role?: string; is_leader?: boolean; joined_at?: string }[];
      left_members?: { member: Member; joined_at?: string; left_at?: string; change_reason?: string }[];
    }>(
      `/admin/programs/${programId}/members`, { params }
    );
    return response.data;
  },

  setTeachers: async (programId: number, teacherIds: number[]) => {
    const response = await api.put<{ program: Program }>(
      `/admin/programs/${programId}/teachers`,
      { teacher_ids: teacherIds }
    );
    return response.data.program;
  },

  addMember: async (programId: number, memberId: number, role?: string) => {
    await api.post(`/admin/programs/${programId}/members`, { member_id: memberId, role });
  },

  removeMember: async (programId: number, memberId: number, changeReason?: string) => {
    await api.delete(`/admin/programs/${programId}/members/${memberId}`, {
      data: changeReason ? { change_reason: changeReason } : undefined,
    });
  },

  updateMember: async (
    programId: number,
    memberId: number,
    data: { joined_at?: string; left_at?: string | null }
  ) => {
    const response = await api.put(
      `/admin/programs/${programId}/members/${memberId}`,
      data
    );
    return response.data;
  },

  setMemberLeader: async (programId: number, memberId: number, isLeader: boolean) => {
    const response = await api.put(`/admin/programs/${programId}/members/${memberId}/leader`, {
      is_leader: isLeader,
    });
    return response.data;
  },

  batchAddMembers: async (programId: number, memberIds: number[], role?: string) => {
    const response = await api.post(`/admin/programs/${programId}/members/batch`, {
      member_ids: memberIds,
      role,
    });
    return response.data;
  },

  getAttendanceMatrix: async (programId: number) => {
    const response = await api.get<{
      members: { member: Member; is_leader: boolean; joined_at?: string; left_at?: string }[];
      rehearsals: RehearsalSlotDTO[];
      matrix: Record<number, Record<number, {
        status: string;
        has_leave: boolean;
        leave_type: string | null;
        detected_before: boolean;
        detected_after: boolean;
      } | null>>;
    }>(`/admin/programs/${programId}/attendance-matrix`);
    return response.data;
  },

  importCsv: async (file: File, defaultPassword?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (defaultPassword) {
      formData.append('default_password', defaultPassword);
    }
    const response = await api.post<{
      message: string;
      stats: {
        programs_created: number;
        members_created: number;
        users_created: number;
        assignments_created: number;
      };
      programs: Program[];
    }>('/admin/programs/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

// Rehearsals API
export const rehearsalsApi = {
  list: async (params?: { program_id?: number; date_from?: string; date_to?: string }) => {
    const response = await api.get<{ rehearsals: Rehearsal[] }>('/admin/rehearsals', { params });
    return response.data.rehearsals;
  },

  get: async (id: number, options?: { include_attendance?: boolean }) => {
    const response = await api.get<{ rehearsal: Rehearsal }>(`/admin/rehearsals/${id}`, {
      params: options,
    });
    return response.data.rehearsal;
  },

  create: async (data: RehearsalForm) => {
    const response = await api.post<{ rehearsal: Rehearsal }>('/admin/rehearsals', data);
    return response.data.rehearsal;
  },

  update: async (id: number, data: Partial<RehearsalForm & { videos?: string[]; status?: string }>) => {
    const response = await api.put<{ rehearsal: Rehearsal }>(`/admin/rehearsals/${id}`, data);
    return response.data.rehearsal;
  },

  delete: async (id: number) => {
    await api.delete(`/admin/rehearsals/${id}`);
  },

  getAttendance: async (id: number) => {
    const response = await api.get<{ attendance: Attendance[] }>(`/admin/rehearsals/${id}/attendance`);
    return response.data.attendance;
  },

  updateAttendance: async (
    rehearsalId: number,
    memberId: number,
    data: {
      has_leave?: boolean;
      leave_type?: string;
      leave_reason?: string;
      manual_override?: boolean;
      override_reason?: string;
      status?: string;
    }
  ) => {
    const response = await api.put<{ attendance: Attendance }>(
      `/admin/rehearsals/${rehearsalId}/attendance/${memberId}`,
      data
    );
    return response.data.attendance;
  },

  importCsv: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<{
      message: string;
      created_count: number;
      skipped_count: number;
      errors: string[];
    }>('/admin/rehearsals/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  downloadTemplate: () => {
    return `${api.defaults.baseURL}/admin/rehearsals/import-template`;
  },

  batchCancel: async (data: {
    date_from: string;
    date_to: string;
    program_ids?: number[];
    reason?: string;
    exclude_from_attendance?: boolean;
  }) => {
    const response = await api.post<{
      message: string;
      cancelled_count: number;
      cancelled_ids: number[];
      denied_count: number;
      denied_ids: number[];
    }>('/admin/rehearsals/batch-cancel', data);
    return response.data;
  },
};

// Dashboard API
export interface RehearsalSlotDTO {
  id: number;
  date: string;
  start_time: string | null;
  is_completed: boolean;
  counts_for_attendance: boolean;
}

export interface ManagedProgramAttendance {
  program_id: number;
  program_name: string;
  attendance_mode: 'rate' | 'cumulative';
  rehearsals: RehearsalSlotDTO[];
  completed_total: number;
  member_count: number;
  members: {
    member_id: number;
    member_name: string;
    is_leader: boolean;
    attendance: Record<string, string>;
    attended_count: number;
  }[];
}

export const dashboardApi = {
  getStats: async () => {
    const response = await api.get<{
      stats: {
        member_count: number;
        teacher_count: number;
        program_count: number;
        week_rehearsal_count: number;
      };
      upcoming_rehearsals: {
        id: number;
        program_name: string;
        date: string;
        start_time: string | null;
        location: string | null;
      }[];
      recent_programs: {
        id: number;
        name: string;
        category: string;
        member_count: number;
        rehearsal_count: number;
      }[];
    }>('/admin/dashboard/stats');
    return response.data;
  },

  getManagedProgramsAttendance: async (semesterId?: number) => {
    const response = await api.get<{
      programs: ManagedProgramAttendance[];
      semester_id: number | null;
    }>('/admin/dashboard/managed-programs-attendance', {
      params: { semester_id: semesterId },
    });
    return response.data;
  },
};

// Users API
export const usersApi = {
  list: async () => {
    const response = await api.get<{
      users: User[];
    }>('/admin/users');
    return response.data.users;
  },

  listPaginated: async (params: { page: number; per_page?: number }) => {
    const response = await api.get<PaginatedResponse<User>>('/admin/users', { params });
    return response.data;
  },

  get: async (id: number) => {
    const response = await api.get<{ user: User }>(`/admin/users/${id}`);
    return response.data.user;
  },

  create: async (data: {
    username: string;
    password: string;
    display_name: string;
    role: string;
    email?: string;
    phone?: string;
  }) => {
    const response = await api.post<{ user: User }>('/admin/users', data);
    return response.data.user;
  },

  update: async (
    id: number,
    data: {
      display_name?: string;
      role?: string;
      email?: string;
      phone?: string;
      status?: string;
      password?: string;
    }
  ) => {
    const response = await api.put<{ user: User }>(`/admin/users/${id}`, data);
    return response.data.user;
  },

  delete: async (id: number) => {
    await api.delete(`/admin/users/${id}`);
  },
};

// Semesters API
export const semestersApi = {
  list: async () => {
    const response = await api.get<{
      semesters: Semester[];
    }>('/admin/semesters');
    return response.data.semesters;
  },

  get: async (id: number) => {
    const response = await api.get<{ semester: Semester }>(`/admin/semesters/${id}`);
    return response.data.semester;
  },

  create: async (data: {
    name: string;
    semester_type?: SemesterType;
    start_date?: string;
    end_date?: string;
    is_current?: boolean;
  }) => {
    const response = await api.post<{ semester: Semester }>('/admin/semesters', data);
    return response.data.semester;
  },

  update: async (
    id: number,
    data: {
      name?: string;
      semester_type?: SemesterType;
      start_date?: string;
      end_date?: string;
      is_current?: boolean;
    }
  ) => {
    const response = await api.put<{ semester: Semester }>(`/admin/semesters/${id}`, data);
    return response.data.semester;
  },

  delete: async (id: number) => {
    await api.delete(`/admin/semesters/${id}`);
  },

  setCurrent: async (id: number) => {
    const response = await api.post<{ semester: Semester }>(`/admin/semesters/${id}/set-current`);
    return response.data.semester;
  },

  getCurrent: async () => {
    const response = await api.get<{ semester: Semester | null }>('/admin/semesters/current');
    return response.data.semester;
  },
};

// Public API (no auth required)
export const publicApi = {
  getAttendanceOverview: async (semesterId?: number) => {
    const response = await api.get('/public/attendance/overview', {
      params: { semester_id: semesterId },
    });
    return response.data;
  },

  getProgramAttendance: async (programId: number) => {
    const response = await api.get(`/public/attendance/programs/${programId}`);
    return response.data;
  },

  searchMemberAttendance: async (search: string, semesterId?: number) => {
    const response = await api.get('/public/attendance/members', {
      params: { search, semester_id: semesterId },
    });
    return response.data;
  },

  getOverviewMatrix: async (semesterId?: number): Promise<OverviewMatrixData> => {
    const response = await api.get<OverviewMatrixData>('/public/attendance/overview/matrix', {
      params: { semester_id: semesterId },
    });
    return response.data;
  },

  getProgramMatrix: async (programId: number): Promise<ProgramMatrixData> => {
    const response = await api.get<ProgramMatrixData>(`/public/attendance/programs/${programId}/matrix`);
    return response.data;
  },
};

export default api;

// Calendar API
export const calendarApi = {
  // Event Types
  getEventTypes: async () => {
    const response = await api.get('/admin/calendar/event-types');
    return response.data.event_types;
  },

  // Events (Admin)
  list: async (params?: {
    start_date?: string;
    end_date?: string;
    event_type_id?: number;
    program_id?: number;
    status?: string;
  }) => {
    const response = await api.get('/admin/calendar/events', { params });
    return response.data.events;
  },

  get: async (id: number) => {
    const response = await api.get(`/admin/calendar/events/${id}`);
    return response.data.event;
  },

  create: async (data: {
    event_type_id: number;
    title: string;
    description?: string;
    program_id?: number;
    start_date: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    is_all_day?: boolean;
    location?: string;
    is_recurring?: boolean;
    recurrence_rule?: string;
    reminder_minutes?: number;
    rehearsal_id?: number;
    notify_members?: boolean;
  }) => {
    const response = await api.post('/admin/calendar/events', data);
    return response.data.event;
  },

  update: async (id: number, data: Partial<{
    event_type_id: number;
    title: string;
    description: string;
    start_date: string;
    end_date: string;
    start_time: string;
    end_time: string;
    is_all_day: boolean;
    location: string;
    is_recurring: boolean;
    recurrence_rule: string;
    reminder_minutes: number;
    notify_members: boolean;
    status: string;
  }>) => {
    const response = await api.put(`/admin/calendar/events/${id}`, data);
    return response.data.event;
  },

  delete: async (id: number) => {
    await api.delete(`/admin/calendar/events/${id}`);
  },

  createFromRehearsal: async (rehearsalId: number, notifyMembers: boolean = false) => {
    const response = await api.post('/admin/calendar/events/from-rehearsal', {
      rehearsal_id: rehearsalId,
      notify_members: notifyMembers,
    });
    return response.data.event;
  },

  // Notifications
  sendNotification: async (eventId: number) => {
    const response = await api.post(`/admin/calendar/events/${eventId}/send-notification`);
    return response.data;
  },

  previewNotification: async (eventId: number) => {
    const response = await api.get(`/admin/calendar/events/${eventId}/notification-preview`);
    return response.data;
  },
};

// Public Calendar API
export const publicCalendarApi = {
  getMonthEvents: async (year: number, month: number) => {
    const response = await api.get(`/public/calendar/month/${year}/${month}`);
    return response.data;
  },

  getWeekEvents: async (date?: string) => {
    const response = await api.get('/public/calendar/week', {
      params: { date },
    });
    return response.data;
  },

  getUpcomingEvents: async (days: number = 7, limit: number = 10) => {
    const response = await api.get('/public/calendar/upcoming', {
      params: { days, limit },
    });
    return response.data;
  },

  getTodayEvents: async () => {
    const response = await api.get('/public/calendar/today');
    return response.data;
  },

  getEventTypes: async () => {
    const response = await api.get('/public/calendar/event-types');
    return response.data.event_types;
  },

  getEvent: async (id: number) => {
    const response = await api.get(`/public/calendar/events/${id}`);
    return response.data.event;
  },

  getStats: async () => {
    const response = await api.get('/public/calendar/stats');
    return response.data;
  },
};

// Venues API
export const venuesApi = {
  list: async (params?: { is_active?: boolean }) => {
    const response = await api.get<{ venues: Venue[] }>('/admin/venues', { params });
    return response.data.venues;
  },

  get: async (id: number, options?: { include_time_slots?: boolean }) => {
    const response = await api.get<{ venue: Venue }>(`/admin/venues/${id}`, { params: options });
    return response.data.venue;
  },

  create: async (data: VenueForm) => {
    const response = await api.post<{ venue: Venue }>('/admin/venues', data);
    return response.data.venue;
  },

  update: async (id: number, data: Partial<VenueForm>) => {
    const response = await api.put<{ venue: Venue }>(`/admin/venues/${id}`, data);
    return response.data.venue;
  },

  delete: async (id: number) => {
    await api.delete(`/admin/venues/${id}`);
  },

  getTimeSlots: async (venueId: number, semesterId?: number) => {
    const response = await api.get<{ time_slots: VenueTimeSlot[] }>(
      `/admin/venues/${venueId}/timeslots`,
      { params: { semester_id: semesterId } }
    );
    return response.data.time_slots;
  },

  updateTimeSlots: async (
    venueId: number,
    timeSlots: Omit<VenueTimeSlot, 'id' | 'venue_id' | 'semester_id' | 'day_name'>[],
    semesterId?: number
  ) => {
    const response = await api.put<{ time_slots: VenueTimeSlot[] }>(
      `/admin/venues/${venueId}/timeslots`,
      { time_slots: timeSlots, semester_id: semesterId }
    );
    return response.data.time_slots;
  },

  getSchedule: async (venueId: number, startDate?: string, endDate?: string) => {
    const response = await api.get<{
      venue: Venue;
      schedule: Record<string, VenueScheduleDay>;
      start_date: string;
      end_date: string;
    }>(`/admin/venues/${venueId}/schedule`, {
      params: { start_date: startDate, end_date: endDate },
    });
    return response.data;
  },

  getBookings: async (venueId: number, params?: { start_date?: string; end_date?: string; status?: string }) => {
    const response = await api.get<{ bookings: VenueBooking[] }>(
      `/admin/venues/${venueId}/bookings`,
      { params }
    );
    return response.data.bookings;
  },
};

// Bookings API
export const bookingsApi = {
  list: async (params?: {
    venue_id?: number;
    program_id?: number;
    start_date?: string;
    end_date?: string;
    status?: string;
  }) => {
    const response = await api.get<{ bookings: VenueBooking[] }>('/admin/bookings', { params });
    return response.data.bookings;
  },

  get: async (id: number) => {
    const response = await api.get<{ booking: VenueBooking }>(`/admin/bookings/${id}`);
    return response.data.booking;
  },

  create: async (data: VenueBookingForm) => {
    const response = await api.post<{ booking: VenueBooking }>('/admin/bookings', data);
    return response.data.booking;
  },

  update: async (id: number, data: Partial<VenueBookingForm>) => {
    const response = await api.put<{ booking: VenueBooking }>(`/admin/bookings/${id}`, data);
    return response.data.booking;
  },

  cancel: async (id: number) => {
    await api.delete(`/admin/bookings/${id}`);
  },
};

// Public Venues API
export const publicVenuesApi = {
  getSchedule: async (params?: { venue_id?: number; start_date?: string; end_date?: string }) => {
    const response = await api.get('/public/venues/schedule', { params });
    return response.data;
  },
};

// Public Schedule API (for week schedule view)
export const publicScheduleApi = {
  getWeekSchedule: async (params?: { start_date?: string; semester_id?: number }) => {
    const response = await api.get<WeekScheduleData>('/public/schedule/week', { params });
    return response.data;
  },

  getDaySchedule: async (date: string, semesterId?: number) => {
    const response = await api.get<{
      date: string;
      semester: Semester;
      events: ScheduleEvent[];
    }>(`/public/schedule/day/${date}`, {
      params: { semester_id: semesterId },
    });
    return response.data;
  },

  getCurrentSemester: async () => {
    const response = await api.get<{ semester: Semester | null }>('/public/schedule/current-semester');
    return response.data.semester;
  },
};


// Teacher Applications API
export const teacherApplicationsApi = {
  list: async (params?: {
    status?: string;
    teacher_id?: number;
    start_date?: string;
    end_date?: string;
  }) => {
    const response = await api.get<{ applications: TeacherEntryApplication[] }>(
      '/admin/applications',
      { params }
    );
    return response.data.applications;
  },

  listPending: async () => {
    const response = await api.get<{ applications: TeacherEntryApplication[] }>(
      '/admin/applications/pending'
    );
    return response.data.applications;
  },

  get: async (id: number) => {
    const response = await api.get<{ application: TeacherEntryApplication }>(
      `/admin/applications/${id}`
    );
    return response.data.application;
  },

  create: async (data: TeacherEntryApplicationForm) => {
    const response = await api.post<{ application: TeacherEntryApplication }>(
      '/admin/applications',
      data
    );
    return response.data.application;
  },

  update: async (id: number, data: Partial<TeacherEntryApplicationForm>) => {
    const response = await api.put<{ application: TeacherEntryApplication }>(
      `/admin/applications/${id}`,
      data
    );
    return response.data.application;
  },

  approve: async (id: number) => {
    const response = await api.post<{ application: TeacherEntryApplication }>(
      `/admin/applications/${id}/approve`
    );
    return response.data.application;
  },

  reject: async (id: number, reason?: string) => {
    const response = await api.post<{ application: TeacherEntryApplication }>(
      `/admin/applications/${id}/reject`,
      { reason }
    );
    return response.data.application;
  },

  complete: async (id: number) => {
    const response = await api.post<{ application: TeacherEntryApplication }>(
      `/admin/applications/${id}/complete`
    );
    return response.data.application;
  },

  delete: async (id: number) => {
    await api.delete(`/admin/applications/${id}`);
  },

  // Teacher-specific endpoints
  getTeacherApplications: async (teacherId: number, status?: string) => {
    const response = await api.get<{ applications: TeacherEntryApplication[] }>(
      `/admin/applications/teachers/${teacherId}/applications`,
      { params: { status } }
    );
    return response.data.applications;
  },

  createForTeacher: async (teacherId: number, data: Omit<TeacherEntryApplicationForm, 'teacher_id'>) => {
    const response = await api.post<{ application: TeacherEntryApplication }>(
      `/admin/applications/teachers/${teacherId}/applications`,
      data
    );
    return response.data.application;
  },
};

// Payment Sources API
export const paymentSourcesApi = {
  list: async (params?: { is_active?: boolean }) => {
    const response = await api.get<{ sources: PaymentSource[] }>('/admin/payments/sources', { params });
    return response.data.sources;
  },

  create: async (data: { name: string; description?: string; is_active?: boolean }) => {
    const response = await api.post<{ source: PaymentSource }>('/admin/payments/sources', data);
    return response.data.source;
  },

  update: async (id: number, data: Partial<{ name: string; description: string; is_active: boolean }>) => {
    const response = await api.put<{ source: PaymentSource }>(`/admin/payments/sources/${id}`, data);
    return response.data.source;
  },
};

// Teacher Payments API
export const teacherPaymentsApi = {
  list: async (params?: { teacher_id?: number; semester_id?: number; status?: string }) => {
    const response = await api.get<{ payments: TeacherPayment[] }>('/admin/payments', { params });
    return response.data.payments;
  },

  get: async (id: number) => {
    const response = await api.get<{ payment: TeacherPayment }>(`/admin/payments/${id}`);
    return response.data.payment;
  },

  create: async (data: TeacherPaymentForm) => {
    const response = await api.post<{ payment: TeacherPayment }>('/admin/payments', data);
    return response.data.payment;
  },

  update: async (id: number, data: Partial<TeacherPaymentForm>) => {
    const response = await api.put<{ payment: TeacherPayment }>(`/admin/payments/${id}`, data);
    return response.data.payment;
  },

  delete: async (id: number) => {
    await api.delete(`/admin/payments/${id}`);
  },

  getSummary: async (semesterId?: number) => {
    const response = await api.get('/admin/payments/summary', {
      params: { semester_id: semesterId },
    });
    return response.data;
  },

  // Teacher-specific endpoints
  getTeacherPayments: async (teacherId: number, params?: { status?: string; semester_id?: number }) => {
    const response = await api.get<{ payments: TeacherPayment[] }>(
      `/admin/payments/teachers/${teacherId}`,
      { params }
    );
    return response.data.payments;
  },

  createForTeacher: async (teacherId: number, data: Omit<TeacherPaymentForm, 'teacher_id'>) => {
    const response = await api.post<{ payment: TeacherPayment }>(
      `/admin/payments/teachers/${teacherId}`,
      data
    );
    return response.data.payment;
  },
};

// Budget Categories API
export const budgetCategoriesApi = {
  list: async (params?: { is_active?: boolean }) => {
    const response = await api.get<{ categories: BudgetCategory[] }>('/admin/budget/categories', { params });
    return response.data.categories;
  },

  create: async (data: { name: string; description?: string; sort_order?: number; is_active?: boolean }) => {
    const response = await api.post<{ category: BudgetCategory }>('/admin/budget/categories', data);
    return response.data.category;
  },

  update: async (id: number, data: Partial<{ name: string; description: string; sort_order: number; is_active: boolean }>) => {
    const response = await api.put<{ category: BudgetCategory }>(`/admin/budget/categories/${id}`, data);
    return response.data.category;
  },
};

// Budgets API
export const budgetsApi = {
  list: async (params?: { semester_id?: number; program_id?: number; category_id?: number }) => {
    const response = await api.get<{ budgets: Budget[] }>('/admin/budget', { params });
    return response.data.budgets;
  },

  get: async (id: number, options?: { include_expenses?: boolean }) => {
    const response = await api.get<{ budget: Budget }>(`/admin/budget/${id}`, { params: options });
    return response.data.budget;
  },

  create: async (data: BudgetForm) => {
    const response = await api.post<{ budget: Budget }>('/admin/budget', data);
    return response.data.budget;
  },

  update: async (id: number, data: Partial<BudgetForm>) => {
    const response = await api.put<{ budget: Budget }>(`/admin/budget/${id}`, data);
    return response.data.budget;
  },

  delete: async (id: number) => {
    await api.delete(`/admin/budget/${id}`);
  },

  getSummary: async (semesterId?: number) => {
    const response = await api.get('/admin/budget/summary', {
      params: { semester_id: semesterId },
    });
    return response.data;
  },
};

// Expenses API
export const expensesApi = {
  list: async (params?: { budget_id?: number; status?: string; start_date?: string; end_date?: string }) => {
    const response = await api.get<{ expenses: Expense[] }>('/admin/budget/expenses', { params });
    return response.data.expenses;
  },

  get: async (id: number) => {
    const response = await api.get<{ expense: Expense }>(`/admin/budget/expenses/${id}`);
    return response.data.expense;
  },

  create: async (data: ExpenseForm) => {
    const response = await api.post<{ expense: Expense }>('/admin/budget/expenses', data);
    return response.data.expense;
  },

  update: async (id: number, data: Partial<ExpenseForm>) => {
    const response = await api.put<{ expense: Expense }>(`/admin/budget/expenses/${id}`, data);
    return response.data.expense;
  },

  delete: async (id: number) => {
    await api.delete(`/admin/budget/expenses/${id}`);
  },
};

// Face Recognition API response types (matches backend)
interface RecognizePhotoResponse {
  success: boolean;
  recognition_id: number;
  program_id: number;
  total_faces: number;
  matched_count: number;
  uncertain_count: number;
  unmatched_count: number;
  faces: {
    face_id: number;
    face_crop_url: string;
    match_status: string;
    matched_member_id: number | null;
    matched_member_name: string | null;
    confidence: number | null;
    top_candidates?: { member_id: number; name: string; confidence: number }[];
  }[];
  attendance_summary: {
    detected: number[];
    not_detected: number[];
    total_members: number;
  };
  timing?: {
    detection_ms: number;
    matching_ms: number;
    total_ms: number;
  };
  message?: string;
}

// Member Portal API (for member role users)
export const memberPortalApi = {
  listSemesters: async () => {
    const response = await api.get<{ semesters: Semester[] }>('/member/semesters');
    return response.data.semesters;
  },

  getMyPrograms: async () => {
    const response = await api.get<{
      programs: {
        id: number;
        name: string;
        category: string;
        display_color: string | null;
        is_leader: boolean;
        member_count: number;
        rehearsal_count: number;
        completed_rehearsal_count: number;
      }[];
    }>('/member/my-programs');
    return response.data;
  },

  getMyProgramDetail: async (programId: number) => {
    const response = await api.get<{
      program: {
        id: number;
        name: string;
        category: string;
        display_color: string | null;
        description: string | null;
      };
      is_leader: boolean;
      members: {
        id: number;
        name: string;
        is_leader: boolean;
      }[];
      rehearsals: {
        id: number;
        scheduled_date: string;
        scheduled_start_time: string | null;
        scheduled_end_time: string | null;
        location: string | null;
        status: string;
        is_completed: boolean;
      }[];
    }>(`/member/my-programs/${programId}`);
    return response.data;
  },

  getMyAttendance: async (semesterId?: number) => {
    const response = await api.get<{
      member: {
        id: number;
        name: string;
        student_id: string;
        department: string;
      } | null;
      programs: {
        program_id: number;
        program_name: string;
        attendance_mode: 'rate' | 'cumulative';
        rehearsals: RehearsalSlotDTO[];
        completed_total: number;
        attendance: Record<string, string>;
        attended_count: number;
      }[];
    }>('/member/my-attendance', {
      params: { semester_id: semesterId },
    });
    return response.data;
  },

  getMyRehearsals: async (params?: { days?: number; limit?: number }) => {
    const response = await api.get<{
      rehearsals: {
        id: number;
        program_id: number;
        program_name: string;
        program_color: string | null;
        scheduled_date: string;
        scheduled_start_time: string | null;
        scheduled_end_time: string | null;
        location: string | null;
        notes: string | null;
      }[];
    }>('/member/my-rehearsals', { params });
    return response.data;
  },

  getMyInfo: async () => {
    const response = await api.get<{
      member: {
        id: number;
        name: string;
        student_id: string | null;
        gender: string | null;
        department: string | null;
        grade: string | null;
        phone: string | null;
        email: string | null;
        status: string;
      } | null;
      user: {
        id: number;
        username: string;
        display_name: string;
        email: string | null;
        phone: string | null;
      };
    }>('/member/my-info');
    return response.data;
  },
};

export const faceRecognitionApi = {
  // Upload and recognize group photo
  recognizePhoto: async (
    file: File,
    rehearsalId: number,
    programId: number,
    photoType: 'check_in' | 'check_out'
  ) => {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('rehearsal_id', rehearsalId.toString());
    formData.append('program_id', programId.toString());
    formData.append('photo_type', photoType);
    const response = await api.post<RecognizePhotoResponse>('/face/recognize', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Get recognition result
  getRecognitionResult: async (recognitionId: number) => {
    const response = await api.get<RecognitionResult>(`/face/recognition/${recognitionId}`);
    return response.data;
  },

  // Annotate a detected face
  annotateFace: async (
    detectedFaceId: number,
    memberId: number | null,
    feedbackType: 'correct' | 'wrong' | 'not_in_photo' = 'correct'
  ) => {
    const response = await api.post<{
      success: boolean;
      message: string;
    }>('/face/annotate', {
      detected_face_id: detectedFaceId,
      member_id: memberId,
      feedback_type: feedbackType,
    });
    return response.data;
  },

  // Get members face registration status
  getMembersStatus: async (programId?: number) => {
    const response = await api.get<{
      total: number;
      members: {
        member_id: number;
        name: string;
        status: string;
        photo_count: number;
        distinguishability_score: number | null;
        registered_at: string | null;
      }[];
    }>('/face/members-status', { params: { program_id: programId } });
    return response.data;
  },

  // Get face recognition stats
  getStats: async () => {
    const response = await api.get<{
      registration: Record<string, number>;
      recognition: {
        total_photos: number;
        avg_match_rate: number;
      };
    }>('/face/stats/overview');
    return response.data;
  },

  // Get saved recognition results for a rehearsal
  getRehearsalRecognitions: async (rehearsalId: number) => {
    const response = await api.get<{
      check_in: {
        recognition_id: number;
        photo_url: string;
        total_faces: number;
        matched_count: number;
        uncertain_count: number;
        unmatched_count: number;
        faces: {
          face_id: number;
          face_crop_url: string;
          match_status: string;
          matched_member_id: number | null;
          matched_member_name: string | null;
          confidence: number | null;
          annotated_member_id?: number;
          annotated_member_name?: string;
        }[];
      } | null;
      check_out: {
        recognition_id: number;
        photo_url: string;
        total_faces: number;
        matched_count: number;
        uncertain_count: number;
        unmatched_count: number;
        faces: {
          face_id: number;
          face_crop_url: string;
          match_status: string;
          matched_member_id: number | null;
          matched_member_name: string | null;
          confidence: number | null;
          annotated_member_id?: number;
          annotated_member_name?: string;
        }[];
      } | null;
    }>(`/face/rehearsal/${rehearsalId}/recognitions`);
    return response.data;
  },
};
