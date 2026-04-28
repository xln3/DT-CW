import React, { useState } from 'react';
import { Edit2 } from 'lucide-react';
import type { Attendance, AttendanceStatus } from '../../../../types';
import { getAttendanceStyles } from '../../../../utils/attendance';
import { parseAttendanceSegments } from '../../../../utils/attendance';
import {
  PHYSICALLY_PRESENT_STATUSES,
  NO_SHOW_STATUSES,
} from '../../../../components/AttendanceTimeline';

const SEGMENT_LABELS = { before: '课前' as const, middle: '中间' as const, after: '课后' as const };

interface EditForm {
  before_present: boolean;
  middle_present: boolean;
  after_present: boolean;
  leave_before: boolean;
  leave_middle: boolean;
  leave_after: boolean;
  reason: string;
}

interface AttendanceTableProps {
  attendance: Attendance[];
  canEdit: boolean;
  onUpdate: (
    memberId: number,
    data: {
      has_leave?: boolean;
      leave_type?: string;
      leave_reason?: string;
      manual_override?: boolean;
      override_reason?: string;
      status?: string;
    }
  ) => Promise<void>;
}

function SegmentToggle({
  label,
  checked,
  onChange,
  activeColor,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  activeColor: 'green' | 'blue';
}) {
  const activeClass = activeColor === 'green'
    ? 'bg-green-500 text-white'
    : 'bg-blue-500 text-white';
  const inactiveClass = activeColor === 'green'
    ? 'bg-orange-500 text-white'
    : 'bg-gray-100 text-gray-600 hover:bg-gray-200';

  return (
    <label className={`w-6 py-1 text-xs cursor-pointer text-center ${checked ? activeClass : inactiveClass}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {label}
    </label>
  );
}

function renderAttendanceSquares(att: Attendance) {
  const styles = getAttendanceStyles(att, SEGMENT_LABELS);

  return (
    <div
      className="inline-flex items-center"
      title={`${styles.before.tooltip} | ${styles.middle.tooltip} | ${styles.after.tooltip}`}
    >
      <div className={`w-2.5 h-5 rounded-l-sm ${styles.before.colorClass}`} />
      <div className={`w-5 h-5 ${styles.middle.colorClass}`} />
      <div className={`w-2.5 h-5 rounded-r-sm ${styles.after.colorClass}`} />
    </div>
  );
}

function getNotesDisplay(att: Attendance): string {
  const notes: string[] = [];
  if (att.has_leave) {
    const reason = att.leave_reason ? `(${att.leave_reason})` : '';
    if (att.leave_type === 'full') {
      notes.push(`请假${reason}`);
    } else if (att.leave_type === 'late') {
      notes.push(`迟到假${reason}`);
    } else if (att.leave_type === 'early') {
      notes.push(`早退假${reason}`);
    }
  }
  if (att.manual_override) {
    const reason = att.override_reason ? `(${att.override_reason})` : '';
    const overrideBefore = ['normal', 'early_leave'].includes(att.status);
    const overrideAfter = ['normal', 'late'].includes(att.status);
    if (!att.detected_before && overrideBefore) {
      notes.push(`未迟到${reason}`);
    }
    if (!att.detected_after && overrideAfter) {
      notes.push(`未早退${reason}`);
    }
    if (att.detected_before && !overrideBefore) {
      notes.push(`迟到${reason}`);
    }
    if (att.detected_after && !overrideAfter) {
      notes.push(`早退${reason}`);
    }
  }
  return notes.length > 0 ? notes.join(', ') : '-';
}

function initEditForm(att: Attendance): EditForm {
  // Initialize presence from current state
  const segments = parseAttendanceSegments(att);

  // Initialize leave from current state
  let leaveBefore = false;
  let leaveMiddle = false;
  let leaveAfter = false;
  if (att.has_leave) {
    if (att.leave_type === 'full') {
      leaveBefore = true;
      leaveMiddle = true;
      leaveAfter = true;
    } else if (att.leave_type === 'late') {
      leaveBefore = true;
    } else if (att.leave_type === 'early') {
      leaveAfter = true;
    }
  }

  // Use existing reason (leave or override)
  const reason = att.override_reason || att.leave_reason || '';

  return {
    before_present: segments.before,
    middle_present: segments.middle,
    after_present: segments.after,
    leave_before: leaveBefore,
    leave_middle: leaveMiddle,
    leave_after: leaveAfter,
    reason,
  };
}

function computeSubmitData(form: EditForm, att: Attendance) {
  // Determine if presence differs from auto-detected
  const autoSegments = {
    before: att.detected_before,
    after: att.detected_after,
    middle: att.detected_before || att.detected_after,
  };

  const presenceChanged =
    form.before_present !== autoSegments.before ||
    form.after_present !== autoSegments.after;

  // Compute status from presence toggles
  let status: AttendanceStatus;
  if (form.before_present && form.after_present) {
    status = 'normal';
  } else if (!form.before_present && form.after_present) {
    status = 'late';
  } else if (form.before_present && !form.after_present) {
    status = 'early_leave';
  } else {
    status = form.middle_present ? 'late' : 'absent';
  }

  // Compute leave type
  const hasLeave = form.leave_before || form.leave_middle || form.leave_after;
  let leaveType: 'full' | 'late' | 'early' | undefined;
  if (form.leave_before && form.leave_middle && form.leave_after) {
    leaveType = 'full';
  } else if (form.leave_before && form.leave_middle) {
    leaveType = 'late';
  } else if (form.leave_middle && form.leave_after) {
    leaveType = 'early';
  } else if (form.leave_before) {
    leaveType = 'late';
  } else if (form.leave_after) {
    leaveType = 'early';
  } else if (form.leave_middle) {
    leaveType = 'full';
  }

  const data: Record<string, unknown> = {};

  // Always send leave state
  data.has_leave = hasLeave;
  if (hasLeave) {
    data.leave_type = leaveType;
    data.leave_reason = form.reason || undefined;
  }

  // Only set manual override if presence was changed
  if (presenceChanged) {
    data.manual_override = true;
    data.status = status;
    data.override_reason = form.reason || undefined;
  } else if (att.manual_override && !presenceChanged) {
    // Reset override if user reverted to auto-detected state
    data.manual_override = false;
    data.override_reason = '';
  }

  return data;
}

export default function AttendanceTable({
  attendance,
  canEdit,
  onUpdate,
}: AttendanceTableProps) {
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    before_present: true,
    middle_present: true,
    after_present: true,
    leave_before: false,
    leave_middle: false,
    leave_after: false,
    reason: '',
  });
  const [error, setError] = useState('');

  const startEdit = (att: Attendance) => {
    setEditingMemberId(att.member_id);
    setEditForm(initEditForm(att));
    setError('');
  };

  const cancelEdit = () => {
    setEditingMemberId(null);
    setError('');
  };

  const handleSave = async (att: Attendance) => {
    const hasLeave = editForm.leave_before || editForm.leave_middle || editForm.leave_after;
    const autoSegments = {
      before: att.detected_before,
      after: att.detected_after,
    };
    const presenceChanged =
      editForm.before_present !== autoSegments.before ||
      editForm.after_present !== autoSegments.after;

    // Require reason if there's a leave or override change
    if ((hasLeave || presenceChanged) && !editForm.reason.trim()) {
      setError('请填写原因');
      return;
    }

    try {
      const data = computeSubmitData(editForm, att);
      await onUpdate(att.member_id, data);
      setEditingMemberId(null);
      setError('');
    } catch {
      setError('保存失败');
    }
  };

  const handleResetOverride = async (att: Attendance) => {
    try {
      await onUpdate(att.member_id, {
        manual_override: false,
        override_reason: '',
      });
    } catch {
      setError('重置失败');
    }
  };

  // Stats grouped by physical presence (matches dashboard / program-detail).
  // 出席 + 缺勤 = 应到. 请假 is a cross-cut tally (a present member with a
  // partial leave is counted in both 出席 and 请假).
  const stats = {
    total: attendance.length,
    attended: attendance.filter((a) => PHYSICALLY_PRESENT_STATUSES.has(a.status)).length,
    absent: attendance.filter((a) => NO_SHOW_STATUSES.has(a.status)).length,
    leave: attendance.filter((a) => a.has_leave).length,
    // Sub-breakdowns under each card.
    normal: attendance.filter((a) => a.status === 'normal').length,
    late: attendance.filter((a) => a.status === 'late').length,
    earlyLeave: attendance.filter((a) => a.status === 'early_leave').length,
    presentWithPartialLeave: attendance.filter(
      (a) => a.status === 'leave_late' || a.status === 'leave_early',
    ).length,
    noShowPlain: attendance.filter((a) => a.status === 'absent').length,
    noShowOnLeave: attendance.filter((a) => a.status === 'leave_absent').length,
  };

  return (
    <>
      {/* Attendance Stats — 4 cards with sub-breakdown. */}
      <div className="card">
        <div className="card-body">
          <h3 className="text-lg font-medium text-gray-900 mb-4">考勤统计</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500 mt-1">应到人数</p>
              <p className="text-xs text-gray-400 mt-2 invisible">·</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-3xl font-bold text-green-600">{stats.attended}</p>
              <p className="text-sm text-gray-500 mt-1">出席</p>
              <p className="text-xs text-gray-500 mt-2 leading-snug">
                正常 {stats.normal} · 迟到 {stats.late} · 早退 {stats.earlyLeave}
                {stats.presentWithPartialLeave > 0 && (
                  <> · 含请假补全 {stats.presentWithPartialLeave}</>
                )}
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg text-center">
              <p className="text-3xl font-bold text-orange-600">{stats.absent}</p>
              <p className="text-sm text-gray-500 mt-1">缺勤</p>
              <p className="text-xs text-gray-500 mt-2 leading-snug">
                未到 {stats.noShowPlain} · 全请假 {stats.noShowOnLeave}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-3xl font-bold text-blue-600">{stats.leave}</p>
              <p className="text-sm text-gray-500 mt-1">请假</p>
              <p className="text-xs text-gray-400 mt-2 leading-snug">跨"出席/缺勤"汇总</p>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="card">
        <div className="card-body">
          <h3 className="text-lg font-medium text-gray-900 mb-4">考勤详情</h3>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </div>
          )}

          {attendance.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              暂无考勤数据。请先为节目添加成员，考勤记录将自动创建。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      姓名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      考勤
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      备注
                    </th>
                    {canEdit && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendance.map((att) => (
                    <React.Fragment key={att.member_id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-medium text-gray-900">
                            {att.member_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {renderAttendanceSquares(att)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-700">
                            {getNotesDisplay(att)}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            {editingMemberId !== att.member_id && (
                              <div className="space-x-2">
                                <button
                                  onClick={() => startEdit(att)}
                                  className="text-primary-600 hover:text-primary-700 inline-flex items-center"
                                >
                                  <Edit2 className="w-3.5 h-3.5 mr-1" />
                                  编辑
                                </button>
                                {att.manual_override && (
                                  <button
                                    onClick={() => handleResetOverride(att)}
                                    className="text-gray-500 hover:text-gray-700"
                                    title="恢复自动计算"
                                  >
                                    重置
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>

                      {/* Inline edit panel */}
                      {editingMemberId === att.member_id && (
                        <tr key={`edit-${att.member_id}`} className="bg-gray-50">
                          <td colSpan={canEdit ? 4 : 3} className="px-6 py-4">
                            <div className="flex flex-wrap items-center gap-4">
                              {/* Presence toggles */}
                              <div>
                                <span className="text-xs text-gray-500 block mb-1">出勤状态</span>
                                <div className="inline-flex border rounded overflow-hidden">
                                  <SegmentToggle
                                    label="前"
                                    checked={editForm.before_present}
                                    onChange={(v) =>
                                      setEditForm((prev) => ({ ...prev, before_present: v }))
                                    }
                                    activeColor="green"
                                  />
                                  <SegmentToggle
                                    label="中"
                                    checked={editForm.middle_present}
                                    onChange={(v) =>
                                      setEditForm((prev) => ({ ...prev, middle_present: v }))
                                    }
                                    activeColor="green"
                                  />
                                  <SegmentToggle
                                    label="后"
                                    checked={editForm.after_present}
                                    onChange={(v) =>
                                      setEditForm((prev) => ({ ...prev, after_present: v }))
                                    }
                                    activeColor="green"
                                  />
                                </div>
                              </div>

                              {/* Leave toggles */}
                              <div>
                                <span className="text-xs text-gray-500 block mb-1">请假标记</span>
                                <div className="inline-flex border rounded overflow-hidden">
                                  <SegmentToggle
                                    label="前"
                                    checked={editForm.leave_before}
                                    onChange={(v) =>
                                      setEditForm((prev) => ({ ...prev, leave_before: v }))
                                    }
                                    activeColor="blue"
                                  />
                                  <SegmentToggle
                                    label="中"
                                    checked={editForm.leave_middle}
                                    onChange={(v) =>
                                      setEditForm((prev) => ({ ...prev, leave_middle: v }))
                                    }
                                    activeColor="blue"
                                  />
                                  <SegmentToggle
                                    label="后"
                                    checked={editForm.leave_after}
                                    onChange={(v) =>
                                      setEditForm((prev) => ({ ...prev, leave_after: v }))
                                    }
                                    activeColor="blue"
                                  />
                                </div>
                              </div>

                              {/* Reason */}
                              <div className="flex-1 min-w-[120px]">
                                <span className="text-xs text-gray-500 block mb-1">原因</span>
                                <input
                                  type="text"
                                  value={editForm.reason}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({ ...prev, reason: e.target.value }))
                                  }
                                  placeholder="请填写原因"
                                  className="form-input py-1 text-sm w-full"
                                />
                              </div>

                              {/* Actions */}
                              <div className="flex items-end space-x-2 pb-0.5">
                                <button
                                  onClick={() => handleSave(att)}
                                  className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                                >
                                  保存
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
