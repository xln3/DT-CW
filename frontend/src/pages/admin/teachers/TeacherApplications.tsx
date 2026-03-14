import { useState, useEffect } from 'react';
import {
  Plus,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { teacherApplicationsApi, teachersApi, rehearsalsApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { TeacherEntryApplication, Teacher, Rehearsal } from '../../../types';
import { APPLICATION_STATUS_DISPLAY, APPLICATION_PURPOSE_DISPLAY } from '../../../types';

export default function TeacherApplications() {
  const [applications, setApplications] = useState<TeacherEntryApplication[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    teacher_id: '',
    entry_date: '',
    entry_time: '',
    exit_time: '',
    purpose: 'class',
    rehearsal_id: '',
    notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Reject modal
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { hasRole } = useAuth();
  const canApprove = hasRole('admin', 'committee');

  const fetchApplications = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await teacherApplicationsApi.list({
        status: statusFilter || undefined,
        teacher_id: teacherFilter ? parseInt(teacherFilter) : undefined,
      });
      setApplications(data);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const data = await teachersApi.list({ status: 'active' });
      setTeachers(data);
    } catch (err) {
      console.error('Failed to load teachers', err);
    }
  };

  const fetchRehearsals = async () => {
    try {
      const data = await rehearsalsApi.list();
      setRehearsals(data);
    } catch (err) {
      console.error('Failed to load rehearsals', err);
    }
  };

  useEffect(() => {
    fetchApplications();
    fetchTeachers();
    fetchRehearsals();
  }, [statusFilter, teacherFilter]);

  const handleCreate = async () => {
    if (!createForm.teacher_id || !createForm.entry_date) {
      setError('请选择教师和入校日期');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await teacherApplicationsApi.create({
        teacher_id: parseInt(createForm.teacher_id),
        entry_date: createForm.entry_date,
        entry_time: createForm.entry_time || undefined,
        exit_time: createForm.exit_time || undefined,
        purpose: createForm.purpose || undefined,
        rehearsal_id: createForm.rehearsal_id ? parseInt(createForm.rehearsal_id) : undefined,
        notes: createForm.notes || undefined,
      });
      setShowCreateModal(false);
      setCreateForm({
        teacher_id: '',
        entry_date: '',
        entry_time: '',
        exit_time: '',
        purpose: 'class',
        rehearsal_id: '',
        notes: '',
      });
      fetchApplications();
    } catch (err: any) {
      setError(err.response?.data?.error || '创建失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await teacherApplicationsApi.approve(id);
      fetchApplications();
    } catch (err: any) {
      setError(err.response?.data?.error || '审批失败');
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;

    try {
      await teacherApplicationsApi.reject(rejectingId, rejectReason || undefined);
      setRejectingId(null);
      setRejectReason('');
      fetchApplications();
    } catch (err: any) {
      setError(err.response?.data?.error || '拒绝失败');
    }
  };

  const handleComplete = async (id: number) => {
    try {
      await teacherApplicationsApi.complete(id);
      fetchApplications();
    } catch (err: any) {
      setError(err.response?.data?.error || '标记失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此申请吗？')) return;

    try {
      await teacherApplicationsApi.delete(id);
      fetchApplications();
    } catch (err: any) {
      setError(err.response?.data?.error || '删除失败');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {APPLICATION_STATUS_DISPLAY[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">入校申请管理</h1>
          <p className="mt-1 text-sm text-gray-500">管理教师入校申请和审批</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          创建申请
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              className="form-input w-full sm:w-48"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">全部状态</option>
              <option value="pending">待审批</option>
              <option value="approved">已批准</option>
              <option value="rejected">已拒绝</option>
              <option value="completed">已完成</option>
            </select>
            <select
              className="form-input w-full sm:w-48"
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
            >
              <option value="">全部教师</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Applications Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>教师</th>
                <th>入校日期</th>
                <th>时间</th>
                <th>用途</th>
                <th>状态</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                      <span className="ml-3 text-gray-500">加载中...</span>
                    </div>
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    暂无申请记录
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="font-medium">{app.teacher_name}</td>
                    <td>
                      {new Date(app.entry_date).toLocaleDateString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </td>
                    <td>
                      {app.entry_time && app.exit_time
                        ? `${app.entry_time} - ${app.exit_time}`
                        : app.entry_time || app.exit_time || '-'}
                    </td>
                    <td>
                      {APPLICATION_PURPOSE_DISPLAY[app.purpose || ''] || app.purpose || '-'}
                    </td>
                    <td>{getStatusBadge(app.status)}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {app.status === 'pending' && canApprove && (
                          <>
                            <button
                              onClick={() => handleApprove(app.id)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              title="批准"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setRejectingId(app.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="拒绝"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {app.status === 'approved' && (
                          <button
                            onClick={() => handleComplete(app.id)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="标记完成"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {app.status === 'pending' && (
                          <button
                            onClick={() => handleDelete(app.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                            title="删除"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!isLoading && applications.length > 0 && (
        <div className="text-sm text-gray-500">共 {applications.length} 条申请</div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">创建入校申请</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="form-label">教师 *</label>
                <select
                  className="form-input"
                  value={createForm.teacher_id}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, teacher_id: e.target.value })
                  }
                  required
                >
                  <option value="">选择教师</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">入校日期 *</label>
                <input
                  type="date"
                  className="form-input"
                  value={createForm.entry_date}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, entry_date: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">入校时间</label>
                  <input
                    type="time"
                    className="form-input"
                    value={createForm.entry_time}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, entry_time: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="form-label">离校时间</label>
                  <input
                    type="time"
                    className="form-input"
                    value={createForm.exit_time}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, exit_time: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="form-label">用途</label>
                <select
                  className="form-input"
                  value={createForm.purpose}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, purpose: e.target.value })
                  }
                >
                  <option value="class">上课</option>
                  <option value="rehearsal">排练</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div>
                <label className="form-label">关联排练</label>
                <select
                  className="form-input"
                  value={createForm.rehearsal_id}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, rehearsal_id: e.target.value })
                  }
                >
                  <option value="">不关联</option>
                  {rehearsals.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.program_name} - {r.scheduled_date}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">备注</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={createForm.notes}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, notes: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 p-4 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                className="btn-primary"
                disabled={isSaving}
              >
                {isSaving ? '创建中...' : '创建申请'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">拒绝申请</h3>
              <button
                onClick={() => setRejectingId(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <label className="form-label">拒绝原因（可选）</label>
              <textarea
                className="form-input"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="请输入拒绝原因..."
              />
            </div>
            <div className="flex items-center justify-end space-x-3 p-4 border-t bg-gray-50 rounded-b-lg">
              <button onClick={() => setRejectingId(null)} className="btn-secondary">
                取消
              </button>
              <button onClick={handleReject} className="btn-primary bg-red-600 hover:bg-red-700">
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
