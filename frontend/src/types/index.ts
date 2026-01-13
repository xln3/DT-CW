// User types
export interface User {
  id: number;
  username: string;
  display_name: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'committee' | 'program_manager';
  status: 'active' | 'inactive';
  last_login_at?: string;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  permissions: string[];
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Member types
export interface Member {
  id: number;
  name: string;
  student_id?: string;
  phone?: string;
  gender?: string;
  department?: string;
  grade?: string;
  status: 'active' | 'inactive';
  notes?: string;
  created_at: string;
  updated_at: string;
  programs?: Program[];
}

// Teacher types
export interface Teacher {
  id: number;
  name: string;
  phone?: string;
  id_card_last4?: string;
  bank_account?: string;
  specialty?: string;
  status: 'active' | 'inactive';
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Semester types
export interface Semester {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

// Program types
export interface Program {
  id: number;
  name: string;
  category?: string;
  description?: string;
  semester_id?: number;
  status: 'active' | 'completed' | 'cancelled';
  member_count: number;
  rehearsal_count: number;
  created_at: string;
  updated_at: string;
  members?: ProgramMember[];
  rehearsals?: Rehearsal[];
}

export interface ProgramMember {
  id: number;
  program_id: number;
  member_id: number;
  member?: Member;
  role?: string;
  joined_at: string;
  left_at?: string;
  status: 'active' | 'left';
}

// Rehearsal types
export interface Rehearsal {
  id: number;
  program_id: number;
  program_name?: string;
  teacher_id?: number;
  teacher_name?: string;
  scheduled_date: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  location?: string;
  before_photo_path?: string;
  after_photo_path?: string;
  before_photo_status: 'pending' | 'uploaded' | 'processed';
  after_photo_status: 'pending' | 'uploaded' | 'processed';
  videos: string[];
  notes?: string;
  attendance_count: number;
  created_at: string;
  updated_at: string;
  attendance?: Attendance[];
}

// Attendance types
export interface Attendance {
  id: number;
  rehearsal_id: number;
  member_id: number;
  member_name?: string;
  detected_before: boolean;
  detected_after: boolean;
  has_leave: boolean;
  leave_type?: 'full' | 'late' | 'early';
  leave_reason?: string;
  status: AttendanceStatus;
  manual_override: boolean;
  override_reason?: string;
  created_at: string;
  updated_at: string;
}

export type AttendanceStatus =
  | 'normal'
  | 'late'
  | 'early_leave'
  | 'absent'
  | 'leave_absent'
  | 'leave_late'
  | 'leave_early';

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

// Form types
export interface LoginForm {
  username: string;
  password: string;
}

export interface MemberForm {
  name: string;
  student_id?: string;
  phone?: string;
  gender?: string;
  department?: string;
  grade?: string;
  notes?: string;
  status?: 'active' | 'inactive';
}

export interface TeacherForm {
  name: string;
  phone?: string;
  id_card_last4?: string;
  bank_account?: string;
  specialty?: string;
  notes?: string;
  status?: 'active' | 'inactive';
}

export interface ProgramForm {
  name: string;
  category?: string;
  description?: string;
  semester_id?: number;
  status?: 'active' | 'completed' | 'cancelled';
}

export interface RehearsalForm {
  program_id: number;
  teacher_id?: number;
  scheduled_date: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  location?: string;
  notes?: string;
}

// Program categories
export const PROGRAM_CATEGORIES = [
  { value: 'dance', label: '舞蹈' },
  { value: 'choir', label: '合唱' },
  { value: 'drama', label: '话剧' },
  { value: 'orchestra', label: '器乐' },
  { value: 'other', label: '其他' },
];

// Attendance status display
export const ATTENDANCE_STATUS_DISPLAY: Record<AttendanceStatus, string> = {
  normal: '正常',
  late: '迟到',
  early_leave: '早退',
  absent: '缺勤',
  leave_absent: '请假',
  leave_late: '迟到(已请假)',
  leave_early: '早退(已请假)',
};
