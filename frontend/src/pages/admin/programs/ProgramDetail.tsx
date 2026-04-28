import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Users,
  Calendar,
  Plus,
  X,
  UserPlus,
  AlertCircle,
  Star,
  StarOff,
  Download,
  ClipboardCopy,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { programsApi, membersApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { Program, Member } from '../../../types';
import { PROGRAM_CATEGORIES } from '../../../types';
import type { AttendanceSegmentData } from '../../../utils/attendance';
import MemberPicker from '../../../components/MemberPicker';
import { exportAttendanceCsv } from '../../../utils/exportCsv';
import {
  AttendanceCell,
  AttendanceLegend,
  countAttendanceFromCellMap,
  type RehearsalSlot,
  type AttendanceMode,
} from '../../../components/AttendanceTimeline';

type AttendanceData = AttendanceSegmentData;

interface ProgramMemberData {
  member: Member;
  is_leader?: boolean;
  role?: string;
  joined_at?: string;
}

interface LeftMemberData {
  member: Member;
  joined_at?: string;
  left_at?: string;
  change_reason?: string;
}


export default function ProgramDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'committee', 'program_manager');

  // Smart back: prefer browser history, fall back to the program list when the
  // user landed here from a direct URL (location.key === 'default').
  const handleBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate('/admin/programs');
  };

  const [program, setProgram] = useState<Program | null>(null);
  const [programMembers, setProgramMembers] = useState<ProgramMemberData[]>([]);
  const [leftMembers, setLeftMembers] = useState<LeftMemberData[]>([]);
  const [showLeftMembers, setShowLeftMembers] = useState(false);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Remove member dialog state
  const [removeTarget, setRemoveTarget] = useState<{ memberId: number; memberName: string } | null>(null);
  const [removeReason, setRemoveReason] = useState('');

  // Edit joined-date dialog state
  const [editJoinedTarget, setEditJoinedTarget] = useState<
    { memberId: number; memberName: string; currentJoinedAt: string } | null
  >(null);
  const [editJoinedDate, setEditJoinedDate] = useState('');
  const [editJoinedSubmitting, setEditJoinedSubmitting] = useState(false);
  const [editJoinedError, setEditJoinedError] = useState('');

  // Copy names feedback
  const [copied, setCopied] = useState(false);

  // Attendance matrix data
  const [rehearsals, setRehearsals] = useState<RehearsalSlot[]>([]);
  const [attendanceMatrix, setAttendanceMatrix] = useState<
    Record<number, Record<number, AttendanceData | null>>
  >({});
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>('rate');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [programData, membersData, matrixData] = await Promise.all([
        programsApi.get(Number(id), { include_members: true, include_rehearsals: true }),
        programsApi.getMembers(Number(id), { include_left: true }),
        programsApi.getAttendanceMatrix(Number(id)),
      ]);
      setProgram(programData);
      setProgramMembers(membersData.members);
      setLeftMembers(membersData.left_members || []);
      setRehearsals(matrixData.rehearsals);
      setAttendanceMatrix(matrixData.matrix);
      setAttendanceMode(matrixData.attendance_mode || 'rate');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllMembers = async () => {
    try {
      const members = await membersApi.list({ status: 'active' });
      const existingIds = new Set(programMembers.map((pm) => pm.member.id));
      setAllMembers(members.filter((m) => !existingIds.has(m.id)));
    } catch (err: unknown) {
      console.error('Failed to fetch members:', err);
    }
  };

  const handleOpenAddMember = async () => {
    await fetchAllMembers();
    setShowAddMember(true);
  };

  const handleAddMembers = async (memberIds: number[]) => {
    setIsAdding(true);
    try {
      await programsApi.batchAddMembers(Number(id), memberIds);
      await fetchData();
      setShowAddMember(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || '添加成员失败');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;

    try {
      await programsApi.removeMember(Number(id), removeTarget.memberId, removeReason.trim() || undefined);
      setProgramMembers(programMembers.filter((pm) => pm.member.id !== removeTarget.memberId));
      setRemoveTarget(null);
      setRemoveReason('');
      // Refresh to get updated left members list
      fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || '移除成员失败');
    }
  };

  const handleCopyNames = async () => {
    const names = programMembers.map((pm) => pm.member.name).join('，');
    try {
      await navigator.clipboard.writeText(names);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const textarea = document.createElement('textarea');
      textarea.value = names;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenEditJoined = (pm: ProgramMemberData) => {
    const isoDate = pm.joined_at
      ? pm.joined_at.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    setEditJoinedTarget({
      memberId: pm.member.id,
      memberName: pm.member.name,
      currentJoinedAt: isoDate,
    });
    setEditJoinedDate(isoDate);
    setEditJoinedError('');
  };

  const handleSubmitEditJoined = async () => {
    if (!editJoinedTarget) return;
    if (!editJoinedDate) {
      setEditJoinedError('请选择加入日期');
      return;
    }
    setEditJoinedSubmitting(true);
    setEditJoinedError('');
    try {
      await programsApi.updateMember(Number(id), editJoinedTarget.memberId, {
        joined_at: editJoinedDate,
      });
      setEditJoinedTarget(null);
      await fetchData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setEditJoinedError(e.response?.data?.error || '更新失败');
    } finally {
      setEditJoinedSubmitting(false);
    }
  };

  const handleToggleLeader = async (memberId: number, currentIsLeader: boolean) => {
    try {
      await programsApi.setMemberLeader(Number(id), memberId, !currentIsLeader);
      await fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || '设置负责人失败');
    }
  };

  const getCategoryLabel = (category?: string) => {
    const cat = PROGRAM_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category || '-';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
            进行中
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
            已完成
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
            已取消
          </span>
        );
      default:
        return null;
    }
  };

  // Format YYYY-MM-DD to MM/DD using string split (timezone-safe).
  const formatRehearsalDate = (iso: string) => {
    const [, m, d] = iso.split('-');
    return `${m}/${d}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">节目不存在或已被删除</p>
        <button
          onClick={() => navigate('/admin/programs')}
          className="mt-4 btn-primary"
        >
          返回节目列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBack}
            className="p-2 text-gray-400 hover:text-gray-600"
            title="返回"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center space-x-3 flex-wrap gap-y-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{program.name}</h1>
              {getStatusBadge(program.status)}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {getCategoryLabel(program.category)}
              {program.teacher_names && program.teacher_names.length > 0 && (
                <span className="ml-2">· 教师: {program.teacher_names.join('、')}</span>
              )}
            </p>
          </div>
        </div>
        {canEdit && (
          <Link to={`/admin/programs/${id}/edit`} className="btn-primary self-start sm:self-auto">
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

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">成员数量</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {programMembers.length}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">排练次数</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {program.rehearsal_count}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-center h-full">
              <Link
                to={`/admin/rehearsals/new?program_id=${id}`}
                className="btn-secondary"
              >
                <Plus className="w-4 h-4 mr-2" />
                安排排练
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {program.description && (
        <div className="card">
          <div className="card-body">
            <h3 className="text-lg font-medium text-gray-900 mb-2">节目描述</h3>
            <p className="text-gray-600 whitespace-pre-wrap">{program.description}</p>
          </div>
        </div>
      )}

      {/* Attendance Matrix */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="text-lg font-medium text-gray-900">成员考勤</h3>
            <div className="flex items-center space-x-2">
              {programMembers.length > 0 && (
                <button
                  onClick={handleCopyNames}
                  className="btn-secondary"
                  title="复制成员名单到剪贴板"
                >
                  <ClipboardCopy className="w-4 h-4 mr-2" />
                  {copied ? '已复制' : '复制名单'}
                </button>
              )}
              {rehearsals.length > 0 && programMembers.length > 0 && (
                <button
                  onClick={() =>
                    exportAttendanceCsv(
                      programMembers.map((pm) => pm.member),
                      rehearsals.map((r) => ({ id: r.id, scheduled_date: r.date })),
                      attendanceMatrix,
                      program?.name || '考勤'
                    )
                  }
                  className="btn-secondary"
                >
                  <Download className="w-4 h-4 mr-2" />
                  导出
                </button>
              )}
              {canEdit && (
                <button onClick={handleOpenAddMember} className="btn-primary">
                  <UserPlus className="w-4 h-4 mr-2" />
                  添加成员
                </button>
              )}
            </div>
          </div>

          {/* Legend (统一用三段式) */}
          <AttendanceLegend className="mb-4" />

          {programMembers.length === 0 ? (
            <p className="text-center text-gray-500 py-8">暂无成员</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                      姓名
                    </th>
                    {rehearsals.map((r) => (
                      <th
                        key={r.id}
                        className={`px-2 py-3 text-center text-xs font-medium uppercase tracking-wider ${
                          r.is_completed ? 'text-gray-500' : 'text-gray-300'
                        }`}
                      >
                        <Link
                          to={`/admin/rehearsals/${r.id}`}
                          className="hover:text-primary-600"
                        >
                          {formatRehearsalDate(r.date)}
                        </Link>
                      </th>
                    ))}
                    {attendanceMode === 'cumulative' ? (
                      <>
                        <th className="px-2 py-3 text-right text-xs font-medium text-purple-600 whitespace-nowrap">已参加</th>
                        <th className="px-2 py-3 text-right text-xs font-medium text-gray-400 whitespace-nowrap">共</th>
                      </>
                    ) : (
                      <>
                        <th className="px-2 py-3 text-right text-xs font-medium text-green-600 whitespace-nowrap">出席</th>
                        <th className="px-2 py-3 text-right text-xs font-medium text-orange-500 whitespace-nowrap">缺勤</th>
                        <th className="px-2 py-3 text-right text-xs font-medium text-blue-500 whitespace-nowrap">请假缺勤</th>
                        <th className="px-2 py-3 text-right text-xs font-medium text-blue-500 whitespace-nowrap">请假迟到</th>
                        <th className="px-2 py-3 text-right text-xs font-medium text-blue-500 whitespace-nowrap">请假早退</th>
                        <th className="px-2 py-3 text-right text-xs font-medium text-amber-600 whitespace-nowrap">迟到</th>
                        <th className="px-2 py-3 text-right text-xs font-medium text-orange-400 whitespace-nowrap">早退</th>
                        <th className="px-2 py-3 text-right text-xs font-medium text-gray-400 whitespace-nowrap">共</th>
                      </>
                    )}
                    {canEdit && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {programMembers.map((pm) => {
                    const { member, is_leader } = pm;
                    const counts = countAttendanceFromCellMap(attendanceMatrix[member.id], rehearsals);
                    return (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white z-10">
                        <div className="flex items-center space-x-2">
                          {is_leader && (
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          )}
                          <Link
                            to={`/admin/members/${member.id}/edit`}
                            className="text-primary-600 hover:text-primary-700 font-medium"
                          >
                            {member.name}
                          </Link>
                        </div>
                      </td>
                      {rehearsals.map((r) => (
                        <td key={r.id} className="px-2 py-3 text-center">
                          <AttendanceCell
                            cell={attendanceMatrix[member.id]?.[r.id]}
                            rehearsal={r}
                          />
                        </td>
                      ))}
                      {attendanceMode === 'cumulative' ? (
                        <>
                          <td className="px-2 py-3 text-right text-sm whitespace-nowrap font-semibold text-purple-700">{counts.attended}</td>
                          <td className="px-2 py-3 text-right text-sm whitespace-nowrap text-gray-400">{counts.total}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-3 text-right text-sm whitespace-nowrap font-semibold text-green-600">{counts.attended}</td>
                          <td className="px-2 py-3 text-right text-sm whitespace-nowrap font-semibold text-orange-500">{counts.absent}</td>
                          <td className="px-2 py-3 text-right text-xs whitespace-nowrap text-blue-500">{counts.leaveAbsent}</td>
                          <td className="px-2 py-3 text-right text-xs whitespace-nowrap text-blue-500">{counts.leaveLate}</td>
                          <td className="px-2 py-3 text-right text-xs whitespace-nowrap text-blue-500">{counts.leaveEarly}</td>
                          <td className="px-2 py-3 text-right text-xs whitespace-nowrap text-amber-600">{counts.late}</td>
                          <td className="px-2 py-3 text-right text-xs whitespace-nowrap text-orange-400">{counts.earlyLeave}</td>
                          <td className="px-2 py-3 text-right text-sm whitespace-nowrap text-gray-400">{counts.total}</td>
                        </>
                      )}
                      {canEdit && (
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleOpenEditJoined(pm)}
                              className="p-1 rounded text-gray-400 hover:text-primary-600"
                              title="修改加入日期"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleLeader(member.id, is_leader || false)}
                              className={`p-1 rounded ${
                                is_leader
                                  ? 'text-yellow-600 hover:text-yellow-800'
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                              title={is_leader ? '取消负责人' : '设为负责人'}
                            >
                              {is_leader ? (
                                <StarOff className="w-4 h-4" />
                              ) : (
                                <Star className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => setRemoveTarget({ memberId: member.id, memberName: member.name })}
                              className="text-red-600 hover:text-red-800"
                            >
                              移除
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {rehearsals.length === 0 && programMembers.length > 0 && (
            <p className="text-center text-gray-500 py-4 text-sm">暂无排练</p>
          )}
        </div>
      </div>

      {/* Left Members Section */}
      {leftMembers.length > 0 && (
        <div className="card">
          <div className="card-body">
            <button
              onClick={() => setShowLeftMembers(!showLeftMembers)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              {showLeftMembers ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">已离队成员 ({leftMembers.length})</span>
            </button>
            {showLeftMembers && (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">姓名</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">加入时间</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">离开时间</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">原因</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leftMembers.map((lm) => (
                      <tr key={lm.member.id} className="text-sm text-gray-600">
                        <td className="px-4 py-2">{lm.member.name}</td>
                        <td className="px-4 py-2">{lm.joined_at ? new Date(lm.joined_at).toLocaleDateString('zh-CN') : '-'}</td>
                        <td className="px-4 py-2">{lm.left_at ? new Date(lm.left_at).toLocaleDateString('zh-CN') : '-'}</td>
                        <td className="px-4 py-2">{lm.change_reason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Joined Date Dialog */}
      {editJoinedTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">修改加入日期</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium">{editJoinedTarget.memberName}</span> 的加入日期
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">加入日期</label>
                <input
                  type="date"
                  className="form-input"
                  value={editJoinedDate}
                  onChange={(e) => setEditJoinedDate(e.target.value)}
                />
                <p className="mt-2 text-xs text-gray-500">
                  改早后会为新进入考勤窗口的排练自动补"缺勤"记录，再到各排练详情页人工修正实际状态。
                </p>
              </div>
              {editJoinedError && (
                <p className="text-sm text-red-600">{editJoinedError}</p>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEditJoinedTarget(null)}
                disabled={editJoinedSubmitting}
              >
                取消
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmitEditJoined}
                disabled={editJoinedSubmitting}
              >
                {editJoinedSubmitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Dialog */}
      {removeTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">移除成员</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                确定要将 <span className="font-medium">{removeTarget.memberName}</span> 从节目中移除吗？
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">原因（可选）</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="例如: 个人原因退出"
                  value={removeReason}
                  onChange={(e) => setRemoveReason(e.target.value)}
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setRemoveTarget(null); setRemoveReason(''); }}
              >
                取消
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                onClick={handleRemoveMember}
              >
                确认移除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">添加成员</h3>
              <button
                onClick={() => setShowAddMember(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <MemberPicker
                members={allMembers}
                onAdd={handleAddMembers}
                isAdding={isAdding}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
