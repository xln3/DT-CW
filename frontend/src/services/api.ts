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
  if (!accessToken) {
    accessToken = localStorage.getItem('accessToken');
    refreshToken = localStorage.getItem('refreshToken');
  }
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

    if (error.response?.status === 401 && !originalRequest._retry) {
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
      }
    }

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
};

// Members API
export const membersApi = {
  list: async (params?: { status?: string; search?: string }) => {
    const response = await api.get<{ members: Member[] }>('/admin/members', { params });
    return response.data.members;
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

  getMembers: async (programId: number) => {
    const response = await api.get<{ members: { member: Member; role?: string }[] }>(
      `/admin/programs/${programId}/members`
    );
    return response.data.members;
  },

  addMember: async (programId: number, memberId: number, role?: string) => {
    await api.post(`/admin/programs/${programId}/members`, { member_id: memberId, role });
  },

  removeMember: async (programId: number, memberId: number) => {
    await api.delete(`/admin/programs/${programId}/members/${memberId}`);
  },

  batchAddMembers: async (programId: number, memberIds: number[], role?: string) => {
    const response = await api.post(`/admin/programs/${programId}/members/batch`, {
      member_ids: memberIds,
      role,
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

  update: async (id: number, data: Partial<RehearsalForm & { videos?: string[] }>) => {
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
};

// Dashboard API
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
};

export default api;
