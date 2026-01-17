import type { ProgramMatrixCell, AttendanceStatus } from '../../../types';

interface ThreeSegmentCellProps {
  cell: ProgramMatrixCell | null;
  counts: boolean;
}

type SegmentType = 'before' | 'middle' | 'after';

interface SegmentStyle {
  colorClass: string;
  tooltip: string;
}

/**
 * Three-segment attendance cell showing before/middle/after attendance status
 * Used in program detail matrix to show individual member attendance
 */
export default function ThreeSegmentCell({ cell, counts }: ThreeSegmentCellProps) {
  if (cell === null) {
    return (
      <div className="inline-flex items-center justify-center w-10" title="不在节目中">
        <span className="text-gray-300">—</span>
      </div>
    );
  }

  const { status, detected_before, detected_after, has_leave } = cell;

  // Determine presence based on status
  let beforePresent = detected_before;
  let afterPresent = detected_after;
  let middlePresent = beforePresent || afterPresent;

  // Infer from status
  if (status === 'normal') {
    beforePresent = true;
    afterPresent = true;
    middlePresent = true;
  } else if (status === 'late') {
    beforePresent = false;
    afterPresent = true;
    middlePresent = true;
  } else if (status === 'early_leave') {
    beforePresent = true;
    afterPresent = false;
    middlePresent = true;
  } else if (status === 'absent') {
    beforePresent = false;
    afterPresent = false;
    middlePresent = false;
  }

  // Get leave type from status
  const getLeaveType = (status: AttendanceStatus): 'full' | 'late' | 'early' | null => {
    if (status === 'leave_absent') return 'full';
    if (status === 'leave_late') return 'late';
    if (status === 'leave_early') return 'early';
    return null;
  };

  const leaveType = getLeaveType(status);

  const getSegmentStyle = (
    isPresent: boolean,
    hasLeave: boolean,
    leaveType: 'full' | 'late' | 'early' | null,
    segment: SegmentType
  ): SegmentStyle => {
    const labels: Record<SegmentType, string> = {
      before: '签到',
      middle: '排练',
      after: '签退',
    };
    const label = labels[segment];

    if (isPresent) {
      return { colorClass: 'bg-green-500', tooltip: `${label}出勤` };
    }
    if (hasLeave && leaveType) {
      return { colorClass: 'bg-blue-500', tooltip: `${label}请假` };
    }
    return { colorClass: 'bg-orange-500', tooltip: `${label}缺勤` };
  };

  const beforeStyle = getSegmentStyle(beforePresent, has_leave, leaveType, 'before');
  const middleStyle = getSegmentStyle(middlePresent, has_leave, leaveType, 'middle');
  const afterStyle = getSegmentStyle(afterPresent, has_leave, leaveType, 'after');

  return (
    <div
      className={`inline-flex items-center ${!counts ? 'opacity-50' : ''}`}
      title={`${beforeStyle.tooltip} | ${middleStyle.tooltip} | ${afterStyle.tooltip}${!counts ? ' (不计入考勤)' : ''}`}
    >
      <div className={`w-1.5 h-4 rounded-l-sm ${beforeStyle.colorClass}`} />
      <div className={`w-4 h-4 ${middleStyle.colorClass}`} />
      <div className={`w-1.5 h-4 rounded-r-sm ${afterStyle.colorClass}`} />
    </div>
  );
}
