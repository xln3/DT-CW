import { Crown, Sparkles } from 'lucide-react';
import {
  getAttendanceStyles,
  type AttendanceSegmentData,
  type SegmentStyle,
} from '../utils/attendance';

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

/**
 * Cell value the front-end receives. `null` means the member was NOT in the
 * program at this rehearsal's time (rendered as "—"); `undefined`/missing key
 * means in-window but no record yet.
 */
export type AttendanceCellValue = AttendanceSegmentData | null;

/**
 * Statuses where the member physically appeared (in part or in full).
 * Includes leave_late / leave_early — the member did show up, just with an
 * excuse covering the missed segment.
 */
export const PHYSICALLY_PRESENT_STATUSES = new Set([
  'normal',
  'late',
  'early_leave',
  'leave_late',
  'leave_early',
]);

/**
 * Statuses where the member was completely absent — never showed up at all,
 * regardless of whether the absence was excused.
 */
export const NO_SHOW_STATUSES = new Set(['absent', 'leave_absent']);

export interface AttendanceCounts {
  attended: number;
  absent: number;
  total: number;
}

/** Compute counts from a {rehearsal_id: status string} map (dashboard / member-portal shape). */
export function countAttendanceFromStatusMap(
  attendance: Record<string, string>,
  rehearsals: RehearsalSlot[],
): AttendanceCounts {
  let attended = 0;
  let absent = 0;
  let total = 0;
  for (const r of rehearsals) {
    if (!r.is_completed || !r.counts_for_attendance) continue;
    total++;
    const s = attendance[String(r.id)];
    if (!s) continue;
    if (PHYSICALLY_PRESENT_STATUSES.has(s)) attended++;
    else if (NO_SHOW_STATUSES.has(s)) absent++;
  }
  return { attended, absent, total };
}

/**
 * Compute counts from a {rehearsal_id: cell|null} map (attendance-matrix shape).
 * cell === null skips both numerator and denominator (member not in program at
 * that time, so the rehearsal doesn't apply to them).
 */
export function countAttendanceFromCellMap(
  cells: Record<number, AttendanceCellValue> | undefined,
  rehearsals: RehearsalSlot[],
): AttendanceCounts {
  let attended = 0;
  let absent = 0;
  let total = 0;
  if (!cells) return { attended, absent, total };
  for (const r of rehearsals) {
    if (!r.is_completed || !r.counts_for_attendance) continue;
    const cell = cells[r.id];
    if (cell === null) continue; // not in program window — not their rehearsal
    total++;
    if (cell === undefined) continue;
    const s = cell.status;
    if (PHYSICALLY_PRESENT_STATUSES.has(s)) attended++;
    else if (NO_SHOW_STATUSES.has(s)) absent++;
  }
  return { attended, absent, total };
}

const STATUS_LABELS: Record<string, string> = {
  normal: '正常',
  late: '迟到',
  early_leave: '早退',
  absent: '缺勤',
  leave_absent: '请假',
  leave_late: '迟到(请假)',
  leave_early: '早退(请假)',
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

function inferSegmentData(status: string): AttendanceSegmentData {
  const has_leave = status.startsWith('leave_');
  let leave_type: string | null = null;
  if (status === 'leave_absent') leave_type = 'full';
  else if (status === 'leave_late') leave_type = 'late';
  else if (status === 'leave_early') leave_type = 'early';
  return {
    status,
    detected_before: false,
    detected_after: false,
    has_leave,
    leave_type,
    manual_override: false,
  };
}

function normalizeCell(
  cell: string | AttendanceCellValue | undefined,
): AttendanceSegmentData | null | undefined {
  if (cell === null || cell === undefined) return cell;
  if (typeof cell === 'string') return inferSegmentData(cell);
  return cell;
}

interface ThreeSegmentSquareProps {
  styles: { before: SegmentStyle; middle: SegmentStyle; after: SegmentStyle };
  height?: string; // tailwind h-* class
  middleWidth?: string; // tailwind w-* class
  edgeWidth?: string; // tailwind w-* class
}

/**
 * Three-segment colored bar: before | middle | after.
 * Reused by AttendanceCell (h-4) and AttendanceLegend (h-3 sample).
 */
export function ThreeSegmentSquare({
  styles,
  height = 'h-4',
  middleWidth = 'w-4',
  edgeWidth = 'w-1.5',
}: ThreeSegmentSquareProps) {
  return (
    <span className="inline-flex items-center align-middle">
      <span className={`${edgeWidth} ${height} rounded-l-sm ${styles.before.colorClass}`} />
      <span className={`${middleWidth} ${height} ${styles.middle.colorClass}`} />
      <span className={`${edgeWidth} ${height} rounded-r-sm ${styles.after.colorClass}`} />
    </span>
  );
}

export function AttendanceCell({
  cell,
  rehearsal,
}: {
  cell: string | AttendanceCellValue | undefined;
  rehearsal: RehearsalSlot;
}) {
  const tip = rehearsalTooltip(rehearsal);
  const data = normalizeCell(cell);

  // 1. Member was not in program at this time → "—"
  if (data === null) {
    return (
      <span
        className="inline-flex items-center justify-center w-7 h-4 align-middle text-gray-300 text-xs"
        title={`${tip} — 不在节目`}
      >
        —
      </span>
    );
  }

  // 2. Future / not-yet-happened rehearsal → dashed slot.
  // (We deliberately ignore any pre-populated absent record that may exist for
  // future rehearsals — see the rehearsal-create flow.)
  if (!rehearsal.is_completed) {
    return (
      <span
        className="inline-flex items-center justify-center w-7 h-4 align-middle rounded-sm border border-dashed border-gray-300 bg-gray-50 text-[10px] text-gray-300"
        title={`${tip} — 未发生`}
      >
        ·
      </span>
    );
  }

  // 3. In window but no attendance record yet → "?"
  if (data === undefined) {
    return (
      <span
        className="inline-flex items-center justify-center w-7 h-4 align-middle rounded-sm bg-gray-200 text-[10px] text-gray-400"
        title={`${tip} — 未标记`}
      >
        ?
      </span>
    );
  }

  // 4. Actual record → three-segment colored bar.
  const styles = getAttendanceStyles(data);
  const label = STATUS_LABELS[data.status] || data.status;
  const opacity = rehearsal.counts_for_attendance ? '' : 'opacity-50';
  return (
    <span
      className={`inline-flex items-center align-middle ${opacity}`}
      title={`${tip} — ${label} | 签到:${styles.before.tooltip.replace('签到', '')} 排练:${styles.middle.tooltip.replace('排练', '')} 签退:${styles.after.tooltip.replace('签退', '')}`}
    >
      <ThreeSegmentSquare styles={styles} />
    </span>
  );
}

export function AttendanceLegend({ className = '' }: { className?: string }) {
  const statuses: Array<{ status: string; label: string }> = [
    { status: 'normal',       label: '正常' },
    { status: 'late',         label: '迟到' },
    { status: 'early_leave',  label: '早退' },
    { status: 'absent',       label: '缺勤' },
    { status: 'leave_absent', label: '请假' },
    { status: 'leave_late',   label: '迟到(请假)' },
    { status: 'leave_early',  label: '早退(请假)' },
  ];
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 ${className}`}>
      {statuses.map((it) => {
        const styles = getAttendanceStyles(inferSegmentData(it.status));
        return (
          <span key={it.status} className="inline-flex items-center">
            <ThreeSegmentSquare styles={styles} height="h-3" middleWidth="w-3" edgeWidth="w-1" />
            <span className="ml-1">{it.label}</span>
          </span>
        );
      })}
      <span className="inline-flex items-center">
        <span className="text-gray-300 text-sm mx-0.5">—</span>
        <span className="ml-1">不在节目</span>
      </span>
      <span className="inline-flex items-center">
        <span className="w-3 h-3 rounded-sm border border-dashed border-gray-300" />
        <span className="ml-1">未发生</span>
      </span>
    </div>
  );
}

/**
 * Inline summary phrasing:
 * - rate (default programs): 出席 X · 缺勤 Y · 共 N
 * - cumulative (encourage-mode programs, e.g. 芭蕾基训): 已参加 X / 共 N
 */
export function SummaryInline({
  mode,
  counts,
}: {
  mode: AttendanceMode;
  counts: AttendanceCounts;
}) {
  if (mode === 'cumulative') {
    return (
      <span className="inline-flex items-baseline gap-1 whitespace-nowrap text-sm">
        <span className="text-gray-500">已参加</span>
        <span className="font-semibold text-purple-700">{counts.attended}</span>
        <span className="text-gray-400">/ 共 {counts.total}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap text-sm">
      <span className="text-gray-500">出席</span>
      <span className="font-semibold text-green-600">{counts.attended}</span>
      <span className="text-gray-300">·</span>
      <span className="text-gray-500">缺勤</span>
      <span className="font-semibold text-orange-500">{counts.absent}</span>
      <span className="text-gray-400 ml-0.5">/ 共 {counts.total}</span>
    </span>
  );
}

export interface AttendanceTimelineProps {
  rehearsals: RehearsalSlot[];
  members: MemberRow[];
  mode: AttendanceMode;
}

/**
 * Per-member attendance grid: row per member, cell per rehearsal.
 * Used by the admin Dashboard's "我负责的剧目" section.
 *
 * Summary columns differ by mode:
 *  - rate     → 出席 | 缺勤 | 共
 *  - cumulative → 已参加 | 共
 */
export function AttendanceTimeline({
  rehearsals,
  members,
  mode,
}: AttendanceTimelineProps) {
  if (rehearsals.length === 0) {
    return <p className="text-gray-500 text-center py-6 text-sm">本节目暂无排练</p>;
  }
  if (members.length === 0) {
    return <p className="text-gray-500 text-center py-6 text-sm">暂无成员</p>;
  }
  const isCumulative = mode === 'cumulative';
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
                className={`px-0 py-1 text-center text-[10px] font-normal ${
                  r.is_completed ? 'text-gray-500' : 'text-gray-300'
                }`}
                title={rehearsalTooltip(r)}
              >
                {shortDate(r.date)}
              </th>
            ))}
            {isCumulative ? (
              <>
                <th className="text-right px-2 py-1 text-xs font-medium text-purple-600 whitespace-nowrap">已参加</th>
                <th className="text-right px-2 py-1 text-xs font-medium text-gray-400 whitespace-nowrap">共</th>
              </>
            ) : (
              <>
                <th className="text-right px-2 py-1 text-xs font-medium text-green-600 whitespace-nowrap">出席</th>
                <th className="text-right px-2 py-1 text-xs font-medium text-orange-500 whitespace-nowrap">缺勤</th>
                <th className="text-right px-2 py-1 text-xs font-medium text-gray-400 whitespace-nowrap">共</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const counts = countAttendanceFromStatusMap(m.attendance, rehearsals);
            return (
              <tr key={m.member_id}>
                <td className="px-2 text-sm text-gray-900 sticky left-0 bg-white z-10 whitespace-nowrap">
                  <span className="inline-flex items-center">
                    {m.is_leader && <Crown className="w-3.5 h-3.5 text-amber-500 mr-1" />}
                    {m.member_name}
                  </span>
                </td>
                {rehearsals.map((r) => (
                  <td key={r.id} className="p-0 align-middle text-center">
                    <AttendanceCell cell={m.attendance[String(r.id)]} rehearsal={r} />
                  </td>
                ))}
                {isCumulative ? (
                  <>
                    <td className="px-2 text-right text-sm whitespace-nowrap font-semibold text-purple-700">{counts.attended}</td>
                    <td className="px-2 text-right text-sm whitespace-nowrap text-gray-400">{counts.total}</td>
                  </>
                ) : (
                  <>
                    <td className="px-2 text-right text-sm whitespace-nowrap font-semibold text-green-600">{counts.attended}</td>
                    <td className="px-2 text-right text-sm whitespace-nowrap font-semibold text-orange-500">{counts.absent}</td>
                    <td className="px-2 text-right text-sm whitespace-nowrap text-gray-400">{counts.total}</td>
                  </>
                )}
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
}: {
  programName: string;
  mode: AttendanceMode;
  rehearsals: RehearsalSlot[];
  attendance: Record<string, string>;
}) {
  const counts = countAttendanceFromStatusMap(attendance, rehearsals);
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
              <AttendanceCell cell={attendance[String(r.id)]} rehearsal={r} />
            </div>
          ))
        )}
      </div>
      <span className="flex-shrink-0">
        <SummaryInline mode={mode} counts={counts} />
      </span>
    </div>
  );
}
