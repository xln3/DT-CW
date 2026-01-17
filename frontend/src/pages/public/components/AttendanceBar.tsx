import type { OverviewMatrixCell } from '../../../types';

interface AttendanceBarProps {
  cell: OverviewMatrixCell;
}

/**
 * Attendance bar showing proportional segments for normal/partial/absent
 * Used in overview matrix to show attendance distribution for each rehearsal
 */
export default function AttendanceBar({ cell }: AttendanceBarProps) {
  const { normal, partial, absent, total, counts } = cell;

  if (total === 0) {
    return (
      <div className="w-full h-4 bg-gray-200 rounded" title="无考勤数据" />
    );
  }

  // Calculate percentages
  const normalPct = (normal / total) * 100;
  const partialPct = (partial / total) * 100;
  const absentPct = (absent / total) * 100;

  const tooltip = `正常: ${normal}, 迟到/早退: ${partial}, 缺勤: ${absent} (共${total}人)`;

  return (
    <div
      className={`w-full h-4 flex rounded overflow-hidden ${!counts ? 'opacity-50' : ''}`}
      title={counts ? tooltip : `${tooltip} (不计入考勤)`}
    >
      {normalPct > 0 && (
        <div
          className="bg-green-500 h-full"
          style={{ width: `${normalPct}%` }}
        />
      )}
      {partialPct > 0 && (
        <div
          className="bg-yellow-500 h-full"
          style={{ width: `${partialPct}%` }}
        />
      )}
      {absentPct > 0 && (
        <div
          className="bg-gray-400 h-full"
          style={{ width: `${absentPct}%` }}
        />
      )}
    </div>
  );
}
