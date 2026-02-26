import type { Member } from '../types';
import type { AttendanceSegmentData } from './attendance';

interface RehearsalColumn {
  id: number;
  scheduled_date: string;
}

const STATUS_LABELS: Record<string, string> = {
  normal: '正常',
  late: '迟到',
  early_leave: '早退',
  absent: '缺勤',
  leave_absent: '请假',
  leave_late: '迟到(假)',
  leave_early: '早退(假)',
};

function statusLabel(data: AttendanceSegmentData | null): string {
  if (!data) return '-';
  return STATUS_LABELS[data.status] || data.status;
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadCsv(content: string, filename: string) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Export attendance matrix as CSV */
export function exportAttendanceCsv(
  members: Member[],
  rehearsals: RehearsalColumn[],
  matrix: Record<number, Record<number, AttendanceSegmentData | null>>,
  programName: string
) {
  const headers = [
    '姓名',
    ...rehearsals.map((r) => r.scheduled_date),
    '出勤次数',
    '缺勤次数',
    '出勤率',
  ];

  const rows = members.map((member) => {
    const memberMatrix = matrix[member.id] || {};
    let attended = 0;
    let absent = 0;
    let total = 0;

    const cells = rehearsals.map((r) => {
      const cell = memberMatrix[r.id] ?? null;
      if (cell === null) return '-';

      total++;
      if (cell.status === 'normal') {
        attended++;
      } else if (['absent', 'leave_absent'].includes(cell.status)) {
        absent++;
      } else {
        // late, early_leave, leave_late, leave_early all count as partial attendance
        attended++;
      }
      return statusLabel(cell);
    });

    const rate = total > 0 ? `${Math.round((attended / total) * 100)}%` : '-';

    return [
      escapeCsvField(member.name),
      ...cells.map(escapeCsvField),
      String(attended),
      String(absent),
      rate,
    ];
  });

  const csv = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  const date = new Date().toISOString().slice(0, 10);
  downloadCsv(csv, `${programName}_考勤_${date}.csv`);
}
