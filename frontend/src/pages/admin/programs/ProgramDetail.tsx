import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
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
} from 'lucide-react';
import { programsApi, membersApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { Program, Member } from '../../../types';
import { PROGRAM_CATEGORIES } from '../../../types';

interface AttendanceData {
  status: string;
  has_leave: boolean;
  leave_type: string | null;
  detected_before: boolean;
  detected_after: boolean;
}

interface ProgramMemberData {
  member: Member;
  is_leader?: boolean;
  role?: string;
}

interface RehearsalData {
  id: number;
  scheduled_date: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
}

export default function ProgramDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'committee', 'program_manager');

  const [program, setProgram] = useState<Program | null>(null);
  const [programMembers, setProgramMembers] = useState<ProgramMemberData[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Attendance matrix data
  const [rehearsals, setRehearsals] = useState<RehearsalData[]>([]);
  const [attendanceMatrix, setAttendanceMatrix] = useState<
    Record<number, Record<number, AttendanceData | null>>
  >({});

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [programData, membersData, matrixData] = await Promise.all([
        programsApi.get(Number(id), { include_members: true, include_rehearsals: true }),
        programsApi.getMembers(Number(id)),
        programsApi.getAttendanceMatrix(Number(id)),
      ]);
      setProgram(programData);
      setProgramMembers(membersData);
      setRehearsals(matrixData.rehearsals);
      setAttendanceMatrix(matrixData.matrix);
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
    setSelectedMemberId(null);
  };

  const handleAddMember = async () => {
    if (!selectedMemberId) return;

    setIsAdding(true);
    try {
      await programsApi.addMember(Number(id), selectedMemberId);
      await fetchData();
      setShowAddMember(false);
      setSelectedMemberId(null);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || '添加成员失败');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm('确定要移除该成员吗？')) return;

    try {
      await programsApi.removeMember(Number(id), memberId);
      setProgramMembers(programMembers.filter((pm) => pm.member.id !== memberId));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || '移除成员失败');
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

  // 根据考勤数据获取每个段的样式
  const getSegmentStyle = (
    isPresent: boolean,
    hasLeave: boolean,
    leaveType: string | null,
    segment: 'before' | 'middle' | 'after'
  ) => {
    const label = segment === 'before' ? '签到' : segment === 'after' ? '签退' : '中间';

    if (isPresent) {
      return { colorClass: 'bg-green-500', tooltip: `${label}出勤` };
    }
    if (hasLeave && leaveType) {
      return { colorClass: 'bg-blue-500', tooltip: `${label}请假` };
    }
    return { colorClass: 'bg-orange-500', tooltip: `${label}缺勤` };
  };

  // 渲染三段式考勤状态
  const renderAttendanceSquares = (att: AttendanceData | null) => {
    if (att === null) {
      // 成员当时不在节目中
      return (
        <div className="inline-flex items-center justify-center w-10" title="不在节目中">
          <span className="text-gray-300">—</span>
        </div>
      );
    }

    let beforePresent = att.detected_before;
    let afterPresent = att.detected_after;
    let middlePresent = beforePresent || afterPresent;

    // 根据状态推断
    if (att.status === 'normal') {
      beforePresent = true;
      afterPresent = true;
      middlePresent = true;
    } else if (att.status === 'late') {
      beforePresent = false;
      afterPresent = true;
      middlePresent = true;
    } else if (att.status === 'early_leave') {
      beforePresent = true;
      afterPresent = false;
      middlePresent = true;
    } else if (att.status === 'absent') {
      beforePresent = false;
      afterPresent = false;
      middlePresent = false;
    }

    const beforeStyle = getSegmentStyle(beforePresent, att.has_leave, att.leave_type, 'before');
    const middleStyle = getSegmentStyle(middlePresent, att.has_leave, att.leave_type, 'middle');
    const afterStyle = getSegmentStyle(afterPresent, att.has_leave, att.leave_type, 'after');

    return (
      <div
        className="inline-flex items-center"
        title={`${beforeStyle.tooltip} | ${middleStyle.tooltip} | ${afterStyle.tooltip}`}
      >
        <div className={`w-1.5 h-4 rounded-l-sm ${beforeStyle.colorClass}`} />
        <div className={`w-4 h-4 ${middleStyle.colorClass}`} />
        <div className={`w-1.5 h-4 rounded-r-sm ${afterStyle.colorClass}`} />
      </div>
    );
  };

  // 格式化排练日期显示
  const formatRehearsalDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/admin/programs')}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">{program.name}</h1>
              {getStatusBadge(program.status)}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {getCategoryLabel(program.category)}
            </p>
          </div>
        </div>
        {canEdit && (
          <Link to={`/admin/programs/${id}/edit`} className="btn-primary">
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">成员考勤</h3>
            {canEdit && (
              <button onClick={handleOpenAddMember} className="btn-primary">
                <UserPlus className="w-4 h-4 mr-2" />
                添加成员
              </button>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center space-x-4 mb-4 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
              <span>出勤</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-orange-500 rounded-sm"></div>
              <span>缺勤</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
              <span>请假</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-gray-300">—</span>
              <span>不在节目</span>
            </div>
          </div>

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
                        className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        <Link
                          to={`/admin/rehearsals/${r.id}`}
                          className="hover:text-primary-600"
                        >
                          {formatRehearsalDate(r.scheduled_date)}
                        </Link>
                      </th>
                    ))}
                    {canEdit && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {programMembers.map(({ member, is_leader }) => (
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
                          {renderAttendanceSquares(
                            attendanceMatrix[member.id]?.[r.id] ?? null
                          )}
                        </td>
                      ))}
                      {canEdit && (
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end space-x-2">
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
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              移除
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rehearsals.length === 0 && programMembers.length > 0 && (
            <p className="text-center text-gray-500 py-4 text-sm">暂无已完成的排练</p>
          )}
        </div>
      </div>

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
            <div className="px-6 py-4 space-y-4">
              <div>
                <label htmlFor="member" className="form-label">
                  选择成员 <span className="text-red-500">*</span>
                </label>
                <select
                  id="member"
                  className="form-input"
                  value={selectedMemberId || ''}
                  onChange={(e) => setSelectedMemberId(Number(e.target.value) || null)}
                >
                  <option value="">请选择成员</option>
                  {allMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                      {member.student_id ? ` (${member.student_id})` : ''}
                    </option>
                  ))}
                </select>
                {allMembers.length === 0 && (
                  <p className="mt-1 text-sm text-gray-500">
                    暂无可添加的成员，所有成员已在节目中
                  </p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowAddMember(false)}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleAddMember}
                disabled={!selectedMemberId || isAdding}
              >
                {isAdding ? '添加中...' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
