import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Users,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  Check,
  X,
  FileText,
} from 'lucide-react';
import { rehearsalsApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { Rehearsal, Attendance, AttendanceStatus } from '../../../types';
import { ATTENDANCE_STATUS_DISPLAY } from '../../../types';

export default function RehearsalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'committee', 'program_manager');

  const [rehearsal, setRehearsal] = useState<Rehearsal | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingAttendance, setEditingAttendance] = useState<number | null>(null);
  const [leaveForm, setLeaveForm] = useState({
    has_leave: false,
    leave_type: 'full' as 'full' | 'late' | 'early',
    leave_reason: '',
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [rehearsalData, attendanceData] = await Promise.all([
        rehearsalsApi.get(Number(id)),
        rehearsalsApi.getAttendance(Number(id)),
      ]);
      setRehearsal(rehearsalData);
      setAttendance(attendanceData);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateLeave = async (memberId: number) => {
    try {
      const updated = await rehearsalsApi.updateAttendance(Number(id), memberId, {
        has_leave: leaveForm.has_leave,
        leave_type: leaveForm.has_leave ? leaveForm.leave_type : undefined,
        leave_reason: leaveForm.has_leave ? leaveForm.leave_reason : undefined,
      });
      setAttendance(
        attendance.map((a) => (a.member_id === memberId ? updated : a))
      );
      setEditingAttendance(null);
    } catch (err: any) {
      setError(err.response?.data?.error || '更新失败');
    }
  };

  const startEditLeave = (att: Attendance) => {
    setEditingAttendance(att.member_id);
    setLeaveForm({
      has_leave: att.has_leave,
      leave_type: (att.leave_type as 'full' | 'late' | 'early') || 'full',
      leave_reason: att.leave_reason || '',
    });
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    const colors: Record<string, string> = {
      normal: 'bg-green-100 text-green-800',
      late: 'bg-yellow-100 text-yellow-800',
      early_leave: 'bg-yellow-100 text-yellow-800',
      absent: 'bg-red-100 text-red-800',
      leave_absent: 'bg-blue-100 text-blue-800',
      leave_late: 'bg-blue-100 text-blue-800',
      leave_early: 'bg-blue-100 text-blue-800',
    };
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}
      >
        {ATTENDANCE_STATUS_DISPLAY[status] || status}
      </span>
    );
  };

  const getDetectionIcon = (detected: boolean) => {
    return detected ? (
      <Check className="w-4 h-4 text-green-600" />
    ) : (
      <X className="w-4 h-4 text-red-600" />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!rehearsal) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">排练不存在或已被删除</p>
        <button
          onClick={() => navigate('/admin/rehearsals')}
          className="mt-4 btn-primary"
        >
          返回排练列表
        </button>
      </div>
    );
  }

  const stats = {
    total: attendance.length,
    normal: attendance.filter((a) => a.status === 'normal').length,
    late: attendance.filter((a) => ['late', 'leave_late'].includes(a.status)).length,
    absent: attendance.filter((a) =>
      ['absent', 'early_leave', 'leave_absent', 'leave_early'].includes(a.status)
    ).length,
    leave: attendance.filter((a) => a.has_leave).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/admin/rehearsals')}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {rehearsal.program_name} - 排练详情
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {rehearsal.scheduled_date}
              {rehearsal.scheduled_start_time &&
                ` ${rehearsal.scheduled_start_time}`}
              {rehearsal.scheduled_end_time &&
                ` - ${rehearsal.scheduled_end_time}`}
            </p>
          </div>
        </div>
        {canEdit && (
          <Link to={`/admin/rehearsals/${id}/edit`} className="btn-primary">
            <Edit2 className="w-4 h-4 mr-2" />
            编辑
          </Link>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">日期</p>
                <p className="text-lg font-semibold text-gray-900">
                  {rehearsal.scheduled_date}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">时间</p>
                <p className="text-lg font-semibold text-gray-900">
                  {rehearsal.scheduled_start_time || '-'} -{' '}
                  {rehearsal.scheduled_end_time || '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <MapPin className="w-8 h-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">地点</p>
                <p className="text-lg font-semibold text-gray-900">
                  {rehearsal.location || '未指定'}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">教师</p>
                <p className="text-lg font-semibold text-gray-900">
                  {rehearsal.teacher_name || '未指定'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Stats */}
      <div className="card">
        <div className="card-body">
          <h3 className="text-lg font-medium text-gray-900 mb-4">考勤统计</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">应到人数</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-600">{stats.normal}</p>
              <p className="text-sm text-gray-500">正常出勤</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-3xl font-bold text-yellow-600">{stats.late}</p>
              <p className="text-sm text-gray-500">迟到</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-3xl font-bold text-red-600">{stats.absent}</p>
              <p className="text-sm text-gray-500">缺勤/早退</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">{stats.leave}</p>
              <p className="text-sm text-gray-500">请假</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {rehearsal.notes && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-start">
              <FileText className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-gray-900">备注</h3>
                <p className="mt-1 text-gray-600 whitespace-pre-wrap">
                  {rehearsal.notes}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Table */}
      <div className="card">
        <div className="card-body">
          <h3 className="text-lg font-medium text-gray-900 mb-4">考勤详情</h3>

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
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      课前
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      课后
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      请假
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
                    <tr key={att.member_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">
                          {att.member_name}
                        </span>
                        {att.manual_override && (
                          <span className="ml-2 text-xs text-orange-600">
                            (已手动调整)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getDetectionIcon(att.detected_before)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getDetectionIcon(att.detected_after)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(att.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingAttendance === att.member_id ? (
                          <div className="flex items-center space-x-2">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={leaveForm.has_leave}
                                onChange={(e) =>
                                  setLeaveForm((prev) => ({
                                    ...prev,
                                    has_leave: e.target.checked,
                                  }))
                                }
                                className="mr-2"
                              />
                              请假
                            </label>
                            {leaveForm.has_leave && (
                              <>
                                <select
                                  value={leaveForm.leave_type}
                                  onChange={(e) =>
                                    setLeaveForm((prev) => ({
                                      ...prev,
                                      leave_type: e.target.value as 'full' | 'late' | 'early',
                                    }))
                                  }
                                  className="form-input py-1 text-sm w-20"
                                >
                                  <option value="full">全程</option>
                                  <option value="late">迟到</option>
                                  <option value="early">早退</option>
                                </select>
                                <input
                                  type="text"
                                  value={leaveForm.leave_reason}
                                  onChange={(e) =>
                                    setLeaveForm((prev) => ({
                                      ...prev,
                                      leave_reason: e.target.value,
                                    }))
                                  }
                                  placeholder="原因"
                                  className="form-input py-1 text-sm w-24"
                                />
                              </>
                            )}
                            <button
                              onClick={() => handleUpdateLeave(att.member_id)}
                              className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingAttendance(null)}
                              className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">
                            {att.has_leave ? (
                              <>
                                {att.leave_type === 'full'
                                  ? '全程请假'
                                  : att.leave_type === 'late'
                                    ? '迟到请假'
                                    : '早退请假'}
                                {att.leave_reason && ` (${att.leave_reason})`}
                              </>
                            ) : (
                              '-'
                            )}
                          </span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          {editingAttendance !== att.member_id && (
                            <button
                              onClick={() => startEditLeave(att)}
                              className="text-primary-600 hover:text-primary-700"
                            >
                              编辑请假
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
