import type { AttendanceStatus } from '../types';

export type SegmentType = 'before' | 'middle' | 'after';

export interface SegmentStyle {
  colorClass: string;
  tooltip: string;
}

/** Minimal attendance data needed for three-segment rendering */
export interface AttendanceSegmentData {
  status: AttendanceStatus | string;
  detected_before: boolean;
  detected_after: boolean;
  has_leave: boolean;
  leave_type?: string | null;
  manual_override?: boolean;
}

export interface ParsedSegments {
  before: boolean;
  middle: boolean;
  after: boolean;
}

/**
 * Parse attendance data into per-segment presence booleans.
 * If manual_override is set, derives presence from status rather than detection flags.
 */
export function parseAttendanceSegments(data: AttendanceSegmentData): ParsedSegments {
  if (data.manual_override) {
    const before = ['normal', 'early_leave'].includes(data.status);
    const after = ['normal', 'late'].includes(data.status);
    const middle = data.status !== 'absent';
    return { before, middle, after };
  }

  // For status-only data (e.g. public matrix with leave_* statuses), infer from status
  const status = data.status;
  if (status === 'normal') {
    return { before: true, middle: true, after: true };
  }
  if (status === 'late' || status === 'leave_late') {
    return { before: false, middle: true, after: true };
  }
  if (status === 'early_leave' || status === 'leave_early') {
    return { before: true, middle: true, after: false };
  }
  if (status === 'absent' || status === 'leave_absent') {
    return { before: false, middle: false, after: false };
  }

  // Fallback to detection flags
  const before = data.detected_before;
  const after = data.detected_after;
  const middle = before || after;
  return { before, middle, after };
}

/**
 * Get display style for a single segment.
 * Uses precise leave matching: leave_type 'late' only covers before segment,
 * 'early' only covers after segment, 'full' covers all segments.
 */
export function getSegmentStyle(
  isPresent: boolean,
  hasLeave: boolean,
  leaveType: string | null | undefined,
  segment: SegmentType,
  labels: Record<SegmentType, string> = { before: '签到', middle: '排练', after: '签退' },
): SegmentStyle {
  const label = labels[segment];

  if (isPresent) {
    return { colorClass: 'bg-green-500', tooltip: `${label}出勤` };
  }

  // Precise leave matching per segment
  const isLeaveApplicable = hasLeave && (
    leaveType === 'full' ||
    (segment === 'before' && leaveType === 'late') ||
    (segment === 'after' && leaveType === 'early')
  );
  if (isLeaveApplicable) {
    return { colorClass: 'bg-blue-500', tooltip: `${label}请假` };
  }

  return { colorClass: 'bg-orange-500', tooltip: `${label}缺勤` };
}

/** Compute all three segment styles from attendance data */
export function getAttendanceStyles(
  data: AttendanceSegmentData,
  labels?: Record<SegmentType, string>,
): { before: SegmentStyle; middle: SegmentStyle; after: SegmentStyle } {
  const segments = parseAttendanceSegments(data);
  const leaveType = data.leave_type ?? null;
  return {
    before: getSegmentStyle(segments.before, data.has_leave, leaveType, 'before', labels),
    middle: getSegmentStyle(segments.middle, data.has_leave, leaveType, 'middle', labels),
    after: getSegmentStyle(segments.after, data.has_leave, leaveType, 'after', labels),
  };
}
