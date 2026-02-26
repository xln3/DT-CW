import type { ProgramMatrixCell } from '../../../types';
import { getAttendanceStyles } from '../../../utils/attendance';

interface ThreeSegmentCellProps {
  cell: ProgramMatrixCell | null;
  counts: boolean;
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

  const styles = getAttendanceStyles(cell);

  return (
    <div
      className={`inline-flex items-center ${!counts ? 'opacity-50' : ''}`}
      title={`${styles.before.tooltip} | ${styles.middle.tooltip} | ${styles.after.tooltip}${!counts ? ' (不计入考勤)' : ''}`}
    >
      <div className={`w-1.5 h-4 rounded-l-sm ${styles.before.colorClass}`} />
      <div className={`w-4 h-4 ${styles.middle.colorClass}`} />
      <div className={`w-1.5 h-4 rounded-r-sm ${styles.after.colorClass}`} />
    </div>
  );
}
