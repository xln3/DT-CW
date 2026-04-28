import type { OverviewMatrixCell } from '../../../types';

interface AttendanceBarProps {
  cell: OverviewMatrixCell;
}

/**
 * Aggregate attendance bar for a single rehearsal: proportional segments
 * for normal/partial/absent. Colors are aligned with the per-member
 * AttendanceCell language (green=present, amber=partial, orange=absent).
 */
export default function AttendanceBar({ cell }: AttendanceBarProps) {
  const { normal, partial, absent, total, counts } = cell;

  if (total === 0) {
    return (
      <div
        className="w-full h-5 bg-gray-100 rounded-sm border border-dashed border-gray-300"
        title="未标记"
      />
    );
  }

  const normalPct = (normal / total) * 100;
  const partialPct = (partial / total) * 100;
  const absentPct = (absent / total) * 100;

  const tooltip = `正常 ${normal} · 迟到/早退 ${partial} · 缺勤/请假 ${absent}（共 ${total} 人）`;

  return (
    <div
      className={`w-full h-5 flex rounded-sm overflow-hidden ${!counts ? 'opacity-50' : ''}`}
      title={counts ? tooltip : `${tooltip} · 不计入考勤`}
    >
      {normalPct > 0 && (
        <div
          className="bg-green-500 h-full flex items-center justify-center overflow-hidden"
          style={{ width: `${normalPct}%` }}
        >
          {normalPct > 18 && (
            <span className="text-[10px] font-medium text-white drop-shadow-sm">{normal}</span>
          )}
        </div>
      )}
      {partialPct > 0 && (
        <div
          className="bg-amber-400 h-full flex items-center justify-center overflow-hidden"
          style={{ width: `${partialPct}%` }}
        >
          {partialPct > 18 && (
            <span className="text-[10px] font-medium text-white drop-shadow-sm">{partial}</span>
          )}
        </div>
      )}
      {absentPct > 0 && (
        <div
          className="bg-orange-500 h-full flex items-center justify-center overflow-hidden"
          style={{ width: `${absentPct}%` }}
        >
          {absentPct > 18 && (
            <span className="text-[10px] font-medium text-white drop-shadow-sm">{absent}</span>
          )}
        </div>
      )}
    </div>
  );
}
