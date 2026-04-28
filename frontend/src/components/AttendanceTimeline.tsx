import { Crown, Sparkles } from 'lucide-react';

export interface RehearsalSlot {
  id: number;
  date: string;
  start_time: string | null;
  is_completed: boolean;
  counts_for_attendance: boolean;
}

export interface MemberRow {
  member_id: number;
  member_name: string;
  is_leader: boolean;
  attendance: Record<string, string>;
  attended_count: number;
}

export type AttendanceMode = 'rate' | 'cumulative';

interface StatusMeta {
  bg: string;
  text: string;
  label: string;
  letter: string;
}

const STATUS_META: Record<string, StatusMeta> = {
  normal:       { bg: 'bg-green-500',  text: 'text-white', label: '正常',         letter: '·' },
  late:         { bg: 'bg-yellow-400', text: 'text-white', label: '迟到',         letter: '迟' },
  early_leave:  { bg: 'bg-orange-400', text: 'text-white', label: '早退',         letter: '早' },
  absent:       { bg: 'bg-red-500',    text: 'text-white', label: '缺勤',         letter: '缺' },
  leave_absent: { bg: 'bg-blue-400',   text: 'text-white', label: '请假',         letter: '假' },
  leave_late:   { bg: 'bg-indigo-400', text: 'text-white', label: '迟到(已请假)', letter: '假' },
  leave_early:  { bg: 'bg-indigo-400', text: 'text-white', label: '早退(已请假)', letter: '假' },
};

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function rehearsalTooltip(r: RehearsalSlot): string {
  const time = r.start_time ? ` ${r.start_time}` : '';
  const flag = r.counts_for_attendance ? '' : '（不计入考勤）';
  return `${r.date}${time}${flag}`;
}

export function AttendanceCell({
  status,
  rehearsal,
}: {
  status: string | undefined;
  rehearsal: RehearsalSlot;
}) {
  const tip = rehearsalTooltip(rehearsal);
  if (status && STATUS_META[status]) {
    const meta = STATUS_META[status];
    return (
      <div
        className={`w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-medium ${meta.bg} ${meta.text}`}
        title={`${tip} — ${meta.label}`}
      >
        {meta.letter}
      </div>
    );
  }
  if (rehearsal.is_completed) {
    return (
      <div
        className="w-6 h-6 rounded-sm bg-gray-200 flex items-center justify-center text-[10px] text-gray-400"
        title={`${tip} — 未标记`}
      >
        ?
      </div>
    );
  }
  return (
    <div
      className="w-6 h-6 rounded-sm border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-[10px] text-gray-300"
      title={`${tip} — 未发生`}
    >
      ·
    </div>
  );
}

export function AttendanceLegend({ className = '' }: { className?: string }) {
  const items: Array<{ bg: string; label: string; dashed?: boolean }> = [
    { bg: 'bg-green-500',  label: '正常' },
    { bg: 'bg-yellow-400', label: '迟到' },
    { bg: 'bg-orange-400', label: '早退' },
    { bg: 'bg-red-500',    label: '缺勤' },
    { bg: 'bg-blue-400',   label: '请假' },
    { bg: 'bg-gray-50 border border-dashed border-gray-300', label: '未发生', dashed: true },
  ];
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 ${className}`}>
      {items.map((it) => (
        <span key={it.label} className="flex items-center">
          <span className={`w-3 h-3 rounded-sm mr-1 ${it.bg}`} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function summaryLabel(mode: AttendanceMode): string {
  return mode === 'cumulative' ? '已参加' : '出席';
}

function summaryNumeric(
  mode: AttendanceMode,
  attended: number,
  total: number,
): { className: string; node: React.ReactNode } {
  const className = mode === 'cumulative' ? 'text-purple-700' : 'text-gray-900';
  return {
    className,
    node: (
      <>
        <span className="font-semibold">{attended}</span>
        <span className="text-gray-400 font-normal"> / {total}</span>
      </>
    ),
  };
}

export interface AttendanceTimelineProps {
  rehearsals: RehearsalSlot[];
  members: MemberRow[];
  completedTotal: number;
  mode: AttendanceMode;
}

/**
 * Per-member attendance grid: row per member, cell per rehearsal.
 * Used by the admin Dashboard's "我负责的剧目" section.
 */
export function AttendanceTimeline({
  rehearsals,
  members,
  completedTotal,
  mode,
}: AttendanceTimelineProps) {
  if (rehearsals.length === 0) {
    return <p className="text-gray-500 text-center py-6 text-sm">本节目暂无排练</p>;
  }
  if (members.length === 0) {
    return <p className="text-gray-500 text-center py-6 text-sm">暂无成员</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-x-1 border-spacing-y-0.5">
        <thead>
          <tr>
            <th className="text-left px-2 py-1 text-xs font-medium text-gray-500 sticky left-0 bg-white z-10">
              成员
            </th>
            {rehearsals.map((r) => (
              <th
                key={r.id}
                className={`px-0 py-1 text-center text-[10px] font-normal w-6 ${
                  r.is_completed ? 'text-gray-500' : 'text-gray-300'
                }`}
                title={rehearsalTooltip(r)}
              >
                {shortDate(r.date)}
              </th>
            ))}
            <th className="text-right px-2 py-1 text-xs font-medium text-gray-500 whitespace-nowrap">
              {summaryLabel(mode)}
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const sum = summaryNumeric(mode, m.attended_count, completedTotal);
            return (
              <tr key={m.member_id}>
                <td className="px-2 text-sm text-gray-900 sticky left-0 bg-white z-10 whitespace-nowrap">
                  <span className="inline-flex items-center">
                    {m.is_leader && <Crown className="w-3.5 h-3.5 text-amber-500 mr-1" />}
                    {m.member_name}
                  </span>
                </td>
                {rehearsals.map((r) => (
                  <td key={r.id} className="p-0 align-middle">
                    <AttendanceCell status={m.attendance[String(r.id)]} rehearsal={r} />
                  </td>
                ))}
                <td className={`px-2 text-right text-sm whitespace-nowrap ${sum.className}`}>
                  {sum.node}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Single-row timeline used inline (dashboard "我的考勤" block, /member page).
 * Caller controls the surrounding card / spacing.
 */
export function PersonalProgramRow({
  programName,
  mode,
  rehearsals,
  attendance,
  attendedCount,
  completedTotal,
}: {
  programName: string;
  mode: AttendanceMode;
  rehearsals: RehearsalSlot[];
  attendance: Record<string, string>;
  attendedCount: number;
  completedTotal: number;
}) {
  const sum = summaryNumeric(mode, attendedCount, completedTotal);
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="text-sm text-gray-700 w-24 flex-shrink-0 inline-flex items-center truncate">
        {mode === 'cumulative' && <Sparkles className="w-3.5 h-3.5 text-purple-500 mr-1 flex-shrink-0" />}
        <span className="truncate">{programName}</span>
      </span>
      <div className="flex flex-1 gap-1 overflow-x-auto py-1 min-w-0">
        {rehearsals.length === 0 ? (
          <span className="text-xs text-gray-400">暂无排练</span>
        ) : (
          rehearsals.map((r) => (
            <div key={r.id} className="flex-shrink-0">
              <AttendanceCell status={attendance[String(r.id)]} rehearsal={r} />
            </div>
          ))
        )}
      </div>
      <span className="text-sm whitespace-nowrap flex-shrink-0">
        <span className="text-gray-500 mr-1">{summaryLabel(mode)}</span>
        <span className={sum.className}>{sum.node}</span>
      </span>
    </div>
  );
}
