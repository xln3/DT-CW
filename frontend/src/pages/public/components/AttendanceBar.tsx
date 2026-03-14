import type { OverviewMatrixCell } from '../../../types';

interface AttendanceBarProps {
  cell: OverviewMatrixCell;
}

/**
 * Attendance bar showing proportional segments for normal/partial/absent
 * with count numbers displayed on segments wide enough to show them.
 */
export default function AttendanceBar({ cell }: AttendanceBarProps) {
  const { normal, partial, absent, total, counts } = cell;

  if (total === 0) {
    return (
      <div className="w-full h-6 bg-gray-200 rounded" title="无考勤数据" />
    );
  }

  // Calculate percentages
  const normalPct = (normal / total) * 100;
  const partialPct = (partial / total) * 100;
  const absentPct = (absent / total) * 100;

  const tooltip = `正常: ${normal}, 迟到/早退: ${partial}, 缺勤/请假: ${absent} (共${total}人)`;

  return (
    <div
      className={`w-full h-6 flex rounded overflow-hidden ${!counts ? 'opacity-50' : ''}`}
      title={counts ? tooltip : `${tooltip} (不计入考勤)`}
    >
      {normalPct > 0 && (
        <div
          className="bg-green-500 h-full flex items-center justify-center overflow-hidden"
          style={{ width: `${normalPct}%` }}
        >
          <span className="text-[10px] font-medium text-white drop-shadow-sm">{normal}</span>
        </div>
      )}
      {partialPct > 0 && (
        <div
          className="bg-yellow-500 h-full flex items-center justify-center overflow-hidden"
          style={{ width: `${partialPct}%` }}
        >
          <span className="text-[10px] font-medium text-white drop-shadow-sm">{partial}</span>
        </div>
      )}
      {absentPct > 0 && (
        <div
          className="bg-gray-400 h-full flex items-center justify-center overflow-hidden"
          style={{ width: `${absentPct}%` }}
        >
          <span className="text-[10px] font-medium text-white drop-shadow-sm">{absent}</span>
        </div>
      )}
    </div>
  );
}
