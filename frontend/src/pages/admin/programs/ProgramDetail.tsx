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
} from 'lucide-react';
import { programsApi, membersApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { Program, Member } from '../../../types';
import { PROGRAM_CATEGORIES } from '../../../types';

export default function ProgramDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'committee', 'program_manager');

  const [program, setProgram] = useState<Program | null>(null);
  const [programMembers, setProgramMembers] = useState<
    { member: Member; role?: string }[]
  >([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [memberRole, setMemberRole] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [programData, membersData] = await Promise.all([
        programsApi.get(Number(id), { include_members: true, include_rehearsals: true }),
        programsApi.getMembers(Number(id)),
      ]);
      setProgram(programData);
      setProgramMembers(membersData);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllMembers = async () => {
    try {
      const members = await membersApi.list({ status: 'active' });
      // Filter out members already in the program
      const existingIds = new Set(programMembers.map((pm) => pm.member.id));
      setAllMembers(members.filter((m) => !existingIds.has(m.id)));
    } catch (err: any) {
      console.error('Failed to fetch members:', err);
    }
  };

  const handleOpenAddMember = async () => {
    await fetchAllMembers();
    setShowAddMember(true);
    setSelectedMemberId(null);
    setMemberRole('');
  };

  const handleAddMember = async () => {
    if (!selectedMemberId) return;

    setIsAdding(true);
    try {
      await programsApi.addMember(Number(id), selectedMemberId, memberRole || undefined);
      await fetchData();
      setShowAddMember(false);
      setSelectedMemberId(null);
      setMemberRole('');
    } catch (err: any) {
      setError(err.response?.data?.error || '添加成员失败');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm('确定要移除该成员吗？')) return;

    try {
      await programsApi.removeMember(Number(id), memberId);
      setProgramMembers(programMembers.filter((pm) => pm.member.id !== memberId));
    } catch (err: any) {
      setError(err.response?.data?.error || '移除成员失败');
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

      {/* Members */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">节目成员</h3>
            {canEdit && (
              <button onClick={handleOpenAddMember} className="btn-primary">
                <UserPlus className="w-4 h-4 mr-2" />
                添加成员
              </button>
            )}
          </div>

          {programMembers.length === 0 ? (
            <p className="text-center text-gray-500 py-8">暂无成员</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      姓名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      学号
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      角色
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      院系
                    </th>
                    {canEdit && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {programMembers.map(({ member, role }) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/admin/members/${member.id}/edit`}
                          className="text-primary-600 hover:text-primary-700 font-medium"
                        >
                          {member.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {member.student_id || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {role || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {member.department || '-'}
                      </td>
                      {canEdit && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            移除
                          </button>
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
              <div>
                <label htmlFor="role" className="form-label">
                  角色 (可选)
                </label>
                <input
                  type="text"
                  id="role"
                  className="form-input"
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  placeholder="例如: 领舞、主唱"
                />
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
