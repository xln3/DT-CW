// User types
export interface User {
  id: number;
  username: string;
  display_name: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'committee' | 'program_manager' | 'member';
  status: 'active' | 'inactive';
  member_id?: number | null;
  last_login_at?: string;
  created_at: string;
  managed_program_ids?: number[];
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
  // Extended fields
  class_name?: string;
  email?: string;
  dormitory?: string;
  birth_date?: string;
  ethnicity?: string;
  hometown?: string;
  political_status?: string;
  party_branch?: string;
  is_talented?: boolean;
  is_concentrated_class?: boolean;
  team_role?: string;
  join_year?: number;
  team_level?: string;
  graduating_this_semester?: boolean;
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
export type SemesterType = 'summer_training' | 'fall' | 'winter_training' | 'spring';

export interface Semester {
  id: number;
  name: string;
  semester_type: SemesterType;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

export const SEMESTER_TYPES = [
  { value: 'summer_training' as SemesterType, label: '暑训' },
  { value: 'fall' as SemesterType, label: '秋季' },
  { value: 'winter_training' as SemesterType, label: '寒训' },
  { value: 'spring' as SemesterType, label: '春季' },
];

export const isTrainingPeriod = (type: SemesterType): boolean => {
  return type === 'summer_training' || type === 'winter_training';
};

// Program types
export interface Program {
  id: number;
  name: string;
  category?: string;
  description?: string;
  display_color?: string;
  semester_id?: number;
  status: 'active' | 'completed' | 'cancelled';
  member_count: number;
  rehearsal_count: number;
  completed_rehearsal_count: number;
  teacher_ids?: number[];
  teacher_names?: string[];
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
  is_leader?: boolean;
  joined_at: string;
  left_at?: string;
  status: 'active' | 'left';
  change_reason?: string;
}

// Rehearsal types
export type RehearsalStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Rehearsal {
  id: number;
  program_id: number;
  program_name?: string;
  program_color?: string;
  teacher_id?: number;
  teacher_name?: string;
  scheduled_date: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  location?: string;
  status: RehearsalStatus;
  before_photo_path?: string;
  after_photo_path?: string;
  before_photo_status: 'pending' | 'uploaded' | 'processed';
  after_photo_status: 'pending' | 'uploaded' | 'processed';
  videos: string[];
  counts_towards_attendance: boolean;
  exclusion_reason?: string;
  notes?: string;
  attendance_count: number;
  created_at: string;
  updated_at: string;
  attendance?: Attendance[];
}

export const REHEARSAL_STATUS_DISPLAY: Record<RehearsalStatus, string> = {
  scheduled: '已安排',
  completed: '已完成',
  cancelled: '已取消',
};

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
  pages: number;
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
  // Extended fields
  class_name?: string;
  email?: string;
  dormitory?: string;
  birth_date?: string;
  ethnicity?: string;
  hometown?: string;
  political_status?: string;
  party_branch?: string;
  is_talented?: boolean;
  is_concentrated_class?: boolean;
  team_role?: string;
  join_year?: number;
  team_level?: string;
  graduating_this_semester?: boolean;
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
  display_color?: string;
  semester_id?: number;
  status?: 'active' | 'completed' | 'cancelled';
  teacher_ids?: number[];
}

export interface RehearsalForm {
  program_id: number;
  teacher_id?: number;
  scheduled_date: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  location?: string;
  notes?: string;
  counts_towards_attendance?: boolean;
  exclusion_reason?: string;
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

// Calendar types
export interface EventType {
  id: number;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  is_system: boolean;
  created_at: string;
}

export interface CalendarEvent {
  id: number;
  event_type_id: number;
  event_type: EventType;
  title: string;
  description?: string;
  program_id?: number;
  program?: Program;
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  is_all_day: boolean;
  location?: string;
  is_recurring: boolean;
  recurrence_rule?: string;
  reminder_minutes?: number;
  rehearsal_id?: number;
  notify_members: boolean;
  notification_sent: boolean;
  notification_sent_at?: string;
  status: 'active' | 'cancelled';
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export interface CalendarStats {
  today_events: number;
  week_events: number;
  month_events: number;
  month_type_stats: {
    event_type: EventType;
    count: number;
  }[];
}

export interface NotificationPreview {
  message: string;
  total_recipients: number;
  recipients: {
    id: number;
    name: string;
    phone?: string;
    student_id?: string;
  }[];
  notification_sent: boolean;
  notification_sent_at?: string;
}

// Venue types
export interface Venue {
  id: number;
  name: string;
  location?: string;
  capacity?: number;
  equipment?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  time_slots?: VenueTimeSlot[];
}

export interface VenueTimeSlot {
  id: number;
  venue_id: number;
  semester_id: number;
  day_of_week: number;
  day_name: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  notes?: string;
}

export interface VenueBooking {
  id: number;
  venue_id: number;
  program_id?: number;
  rehearsal_id?: number;
  date: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled';
  booked_by: number;
  booked_by_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  venue?: Venue;
  program?: {
    id: number;
    name: string;
  };
}

export interface VenueScheduleDay {
  date: string;
  day_of_week: number;
  day_name: string;
  available_slots: VenueTimeSlot[];
  bookings: VenueBooking[];
}

export interface VenueForm {
  name: string;
  location?: string;
  capacity?: number;
  equipment?: string;
  is_active?: boolean;
}

export interface VenueBookingForm {
  venue_id: number;
  program_id?: number;
  rehearsal_id?: number;
  date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

export const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// Teacher Entry Application types
export interface TeacherEntryApplication {
  id: number;
  teacher_id: number;
  teacher_name?: string;
  rehearsal_id?: number;
  entry_date: string;
  entry_time?: string;
  exit_time?: string;
  purpose?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  created_by: number;
  created_by_name?: string;
  approved_by?: number;
  approved_by_name?: string;
  approved_at?: string;
  created_at: string;
  notes?: string;
  teacher?: Teacher;
  rehearsal?: {
    id: number;
    program_name?: string;
    scheduled_date?: string;
  };
}

export interface TeacherEntryApplicationForm {
  teacher_id: number;
  rehearsal_id?: number;
  entry_date: string;
  entry_time?: string;
  exit_time?: string;
  purpose?: string;
  notes?: string;
}

export const APPLICATION_STATUS_DISPLAY: Record<string, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
  completed: '已完成',
};

export const APPLICATION_PURPOSE_DISPLAY: Record<string, string> = {
  class: '上课',
  rehearsal: '排练',
  other: '其他',
};

// Payment types
export interface PaymentSource {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface PaymentSourceDetail {
  id: number;
  payment_id: number;
  source_id: number;
  source_name?: string;
  amount: number;
  notes?: string;
}

export interface TeacherPayment {
  id: number;
  teacher_id: number;
  teacher_name?: string;
  semester_id?: number;
  semester_name?: string;
  description: string;
  total_amount: number;
  status: 'pending' | 'processing' | 'paid';
  scheduled_date?: string;
  actual_date?: string;
  reference_number?: string;
  notes?: string;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  sources?: PaymentSourceDetail[];
}

export interface TeacherPaymentForm {
  teacher_id: number;
  semester_id?: number;
  description: string;
  total_amount: number;
  status?: string;
  scheduled_date?: string;
  actual_date?: string;
  reference_number?: string;
  notes?: string;
  sources?: { source_id: number; amount: number; notes?: string }[];
}

export const PAYMENT_STATUS_DISPLAY: Record<string, string> = {
  pending: '待发放',
  processing: '处理中',
  paid: '已发放',
};

// Budget types
export interface BudgetCategory {
  id: number;
  name: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Budget {
  id: number;
  semester_id?: number;
  semester_name?: string;
  program_id?: number;
  program_name?: string;
  category_id: number;
  category_name?: string;
  name: string;
  planned_amount: number;
  spent_amount: number;
  remaining_amount: number;
  notes?: string;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  expenses?: Expense[];
}

export interface Expense {
  id: number;
  budget_id: number;
  budget_name?: string;
  category_name?: string;
  amount: number;
  description?: string;
  expense_date: string;
  receipt_number?: string;
  status: 'pending' | 'approved' | 'reimbursed' | 'cancelled';
  teacher_id?: number;
  teacher_name?: string;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetForm {
  semester_id?: number;
  program_id?: number;
  category_id: number;
  name: string;
  planned_amount: number;
  notes?: string;
}

export interface ExpenseForm {
  budget_id: number;
  amount: number;
  description?: string;
  expense_date: string;
  receipt_number?: string;
  status?: string;
  teacher_id?: number;
}

export const EXPENSE_STATUS_DISPLAY: Record<string, string> = {
  pending: '待审核',
  approved: '已审核',
  reimbursed: '已报销',
  cancelled: '已取消',
};

// Face Recognition types
export type FaceMatchStatus = 'confirmed' | 'uncertain' | 'unmatched' | 'manual' | 'self_annotated';

export interface DetectedFace {
  id: number;
  recognition_id: number;
  face_crop_url?: string;
  bbox_x?: number;
  bbox_y?: number;
  bbox_width?: number;
  bbox_height?: number;
  matched_member_id?: number;
  matched_member_name?: string;
  match_confidence?: number;
  match_status: FaceMatchStatus;
  annotated_member_id?: number;
  annotated_member_name?: string;
  created_at: string;
}

export interface PhotoRecognition {
  id: number;
  rehearsal_id: number;
  program_id: number;
  photo_type: 'check_in' | 'check_out';
  photo_url?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_faces: number;
  matched_faces: number;
  uncertain_faces: number;
  unmatched_faces: number;
  processed_at?: string;
  created_at: string;
  faces?: DetectedFace[];
}

export interface RecognitionResult {
  recognition: PhotoRecognition;
  faces: DetectedFace[];
  program_members: {
    id: number;
    name: string;
    detected: boolean;
  }[];
}

export const MATCH_STATUS_DISPLAY: Record<FaceMatchStatus, string> = {
  confirmed: '已确认',
  uncertain: '待确认',
  unmatched: '未识别',
  manual: '人工标注',
  self_annotated: '自选',
};

// Public Attendance Matrix types
export interface OverviewMatrixProgram {
  id: number;
  name: string;
  category: string;
  attendance_mode: 'rate' | 'cumulative';
}

export interface OverviewMatrixCell {
  rehearsal_id: number;
  counts: boolean;
  total: number;
  normal: number;
  partial: number;
  absent: number;
}

export interface OverviewMatrixData {
  semester: { id: number; name: string; start_date: string } | null;
  programs: OverviewMatrixProgram[];
  dates: string[];
  matrix: Record<number, Record<string, OverviewMatrixCell>>;
}

export interface ProgramMatrixMember {
  id: number;
  name: string;
  is_leader: boolean;
}

export interface ProgramMatrixRehearsal {
  id: number;
  date: string;
  counts: boolean;
}

export interface ProgramMatrixCell {
  status: AttendanceStatus;
  detected_before: boolean;
  detected_after: boolean;
  has_leave: boolean;
  leave_type?: string | null;
}

export interface ProgramMatrixSummary {
  attended: number;
  total: number;
}

export interface ProgramMatrixData {
  program: { id: number; name: string; category: string };
  members: ProgramMatrixMember[];
  rehearsals: ProgramMatrixRehearsal[];
  matrix: Record<number, Record<number, ProgramMatrixCell | null>>;
  summary: Record<number, ProgramMatrixSummary>;
}

