import { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  Settings,
} from 'lucide-react';
import { teacherPaymentsApi, paymentSourcesApi, teachersApi, semestersApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { TeacherPayment, PaymentSource, Teacher } from '../../../types';
import { PAYMENT_STATUS_DISPLAY } from '../../../types';

interface SemesterOption {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
}

export default function TeacherPayments() {
  const [payments, setPayments] = useState<TeacherPayment[]>([]);
  const [sources, setSources] = useState<PaymentSource[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');

  // Create/Edit modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<TeacherPayment | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    teacher_id: '',
    semester_id: '',
    description: '',
    total_amount: '',
    status: 'pending',
    scheduled_date: '',
    actual_date: '',
    reference_number: '',
    notes: '',
    sources: [] as { source_id: number; amount: string; notes: string }[],
  });
  const [isSaving, setIsSaving] = useState(false);

  // Sources modal
  const [showSourcesModal, setShowSourcesModal] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceDesc, setNewSourceDesc] = useState('');

  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'committee');

  const fetchPayments = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await teacherPaymentsApi.list({
        status: statusFilter || undefined,
        teacher_id: teacherFilter ? parseInt(teacherFilter) : undefined,
      });
      setPayments(data);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSources = async () => {
    try {
      const data = await paymentSourcesApi.list();
      setSources(data);
    } catch (err) {
      console.error('Failed to load sources', err);
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

  const fetchSemesters = async () => {
    try {
      const data = await semestersApi.list();
      setSemesters(data);
    } catch (err) {
      console.error('Failed to load semesters', err);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchSources();
    fetchTeachers();
    fetchSemesters();
  }, [statusFilter, teacherFilter]);

  const openCreateModal = () => {
    setEditingPayment(null);
    setPaymentForm({
      teacher_id: '',
      semester_id: '',
      description: '',
      total_amount: '',
      status: 'pending',
      scheduled_date: '',
      actual_date: '',
      reference_number: '',
      notes: '',
      sources: sources.map((s) => ({ source_id: s.id, amount: '', notes: '' })),
    });
    setShowPaymentModal(true);
  };

  const openEditModal = (payment: TeacherPayment) => {
    setEditingPayment(payment);
    setPaymentForm({
      teacher_id: payment.teacher_id.toString(),
      semester_id: payment.semester_id?.toString() || '',
      description: payment.description,
      total_amount: payment.total_amount.toString(),
      status: payment.status,
      scheduled_date: payment.scheduled_date || '',
      actual_date: payment.actual_date || '',
      reference_number: payment.reference_number || '',
      notes: payment.notes || '',
      sources: sources.map((s) => {
        const detail = payment.sources?.find((d) => d.source_id === s.id);
        return {
          source_id: s.id,
          amount: detail?.amount.toString() || '',
          notes: detail?.notes || '',
        };
      }),
    });
    setShowPaymentModal(true);
  };

  const handleSavePayment = async () => {
    if (!paymentForm.teacher_id || !paymentForm.description || !paymentForm.total_amount) {
      setError('请填写必填项');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const data = {
        teacher_id: parseInt(paymentForm.teacher_id),
        semester_id: paymentForm.semester_id ? parseInt(paymentForm.semester_id) : undefined,
        description: paymentForm.description,
        total_amount: parseFloat(paymentForm.total_amount),
        status: paymentForm.status,
        scheduled_date: paymentForm.scheduled_date || undefined,
        actual_date: paymentForm.actual_date || undefined,
        reference_number: paymentForm.reference_number || undefined,
        notes: paymentForm.notes || undefined,
        sources: paymentForm.sources
          .filter((s) => s.amount && parseFloat(s.amount) > 0)
          .map((s) => ({
            source_id: s.source_id,
            amount: parseFloat(s.amount),
            notes: s.notes || undefined,
          })),
      };

      if (editingPayment) {
        await teacherPaymentsApi.update(editingPayment.id, data);
      } else {
        await teacherPaymentsApi.create(data);
      }

      setShowPaymentModal(false);
      fetchPayments();
    } catch (err: any) {
      setError(err.response?.data?.error || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此劳务记录吗？')) return;

    try {
      await teacherPaymentsApi.delete(id);
      fetchPayments();
    } catch (err: any) {
      setError(err.response?.data?.error || '删除失败');
    }
  };

  const handleCreateSource = async () => {
    if (!newSourceName.trim()) return;

    try {
      await paymentSourcesApi.create({
        name: newSourceName.trim(),
        description: newSourceDesc.trim() || undefined,
      });
      setNewSourceName('');
      setNewSourceDesc('');
      fetchSources();
    } catch (err: any) {
      setError(err.response?.data?.error || '创建失败');
    }
  };

  const updateSourceAmount = (sourceId: number, amount: string) => {
    setPaymentForm({
      ...paymentForm,
      sources: paymentForm.sources.map((s) =>
        s.source_id === sourceId ? { ...s, amount } : s
      ),
    });
  };

  const calculateSourcesTotal = () => {
    return paymentForm.sources.reduce((sum, s) => {
      const amount = parseFloat(s.amount) || 0;
      return sum + amount;
    }, 0);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
    };
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {PAYMENT_STATUS_DISPLAY[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">劳务发放管理</h1>
          <p className="mt-1 text-sm text-gray-500">管理教师劳务费发放记录</p>
        </div>
        <div className="flex items-center space-x-3">
          {canEdit && (
            <>
              <button onClick={() => setShowSourcesModal(true)} className="btn-secondary">
                <Settings className="w-4 h-4 mr-2" />
                来源管理
              </button>
              <button onClick={openCreateModal} className="btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                添加劳务
              </button>
            </>
          )}
        </div>
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
              <option value="pending">待发放</option>
              <option value="processing">处理中</option>
              <option value="paid">已发放</option>
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

      {/* Payments Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>教师</th>
                <th>说明</th>
                <th>总金额</th>
                <th>来源</th>
                <th>状态</th>
                <th>计划日期</th>
                {canEdit && <th className="text-right">操作</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                      <span className="ml-3 text-gray-500">加载中...</span>
                    </div>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="text-center py-8 text-gray-500">
                    暂无劳务记录
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="font-medium">{payment.teacher_name}</td>
                    <td>{payment.description}</td>
                    <td className="font-medium text-green-600">
                      ¥{payment.total_amount.toFixed(2)}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {payment.sources?.map((s) => (
                          <span
                            key={s.source_id}
                            className="inline-flex px-2 py-0.5 text-xs bg-gray-100 rounded"
                          >
                            {s.source_name}: ¥{s.amount.toFixed(2)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{getStatusBadge(payment.status)}</td>
                    <td>
                      {payment.scheduled_date
                        ? new Date(payment.scheduled_date).toLocaleDateString('zh-CN')
                        : '-'}
                    </td>
                    {canEdit && (
                      <td className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openEditModal(payment)}
                            className="p-2 text-gray-400 hover:text-primary-600"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {payment.status === 'pending' && (
                            <button
                              onClick={() => handleDelete(payment.id)}
                              className="p-2 text-gray-400 hover:text-red-600"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!isLoading && payments.length > 0 && (
        <div className="text-sm text-gray-500">
          共 {payments.length} 条记录，总金额 ¥
          {payments.reduce((sum, p) => sum + p.total_amount, 0).toFixed(2)}
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto py-8">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">
                {editingPayment ? '编辑劳务记录' : '添加劳务记录'}
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">教师 *</label>
                  <select
                    className="form-input"
                    value={paymentForm.teacher_id}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, teacher_id: e.target.value })
                    }
                    disabled={!!editingPayment}
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
                  <label className="form-label">学期</label>
                  <select
                    className="form-input"
                    value={paymentForm.semester_id}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, semester_id: e.target.value })
                    }
                  >
                    <option value="">不关联学期</option>
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">劳务说明 *</label>
                <input
                  type="text"
                  className="form-input"
                  value={paymentForm.description}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, description: e.target.value })
                  }
                  placeholder="如：3月份课时费"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">总金额 *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      ¥
                    </span>
                    <input
                      type="number"
                      className="form-input pl-8"
                      value={paymentForm.total_amount}
                      onChange={(e) =>
                        setPaymentForm({ ...paymentForm, total_amount: e.target.value })
                      }
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label">状态</label>
                  <select
                    className="form-input"
                    value={paymentForm.status}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, status: e.target.value })
                    }
                  >
                    <option value="pending">待发放</option>
                    <option value="processing">处理中</option>
                    <option value="paid">已发放</option>
                  </select>
                </div>
              </div>

              {/* Source breakdown */}
              <div>
                <label className="form-label">来源明细</label>
                <div className="space-y-2 bg-gray-50 p-3 rounded">
                  {sources.map((source) => {
                    const sourceForm = paymentForm.sources.find(
                      (s) => s.source_id === source.id
                    );
                    return (
                      <div key={source.id} className="flex items-center gap-3">
                        <span className="w-20 text-sm text-gray-600">{source.name}</span>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                            ¥
                          </span>
                          <input
                            type="number"
                            className="form-input pl-8 py-1 text-sm"
                            value={sourceForm?.amount || ''}
                            onChange={(e) => updateSourceAmount(source.id, e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <span className="text-sm text-gray-600">来源合计</span>
                    <span
                      className={`font-medium ${
                        Math.abs(
                          calculateSourcesTotal() - parseFloat(paymentForm.total_amount || '0')
                        ) < 0.01
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      ¥{calculateSourcesTotal().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">计划发放日期</label>
                  <input
                    type="date"
                    className="form-input"
                    value={paymentForm.scheduled_date}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, scheduled_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="form-label">实际发放日期</label>
                  <input
                    type="date"
                    className="form-input"
                    value={paymentForm.actual_date}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, actual_date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="form-label">转账凭证号</label>
                <input
                  type="text"
                  className="form-input"
                  value={paymentForm.reference_number}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, reference_number: e.target.value })
                  }
                  placeholder="可选"
                />
              </div>

              <div>
                <label className="form-label">备注</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={paymentForm.notes}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, notes: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 p-4 border-t bg-gray-50 rounded-b-lg">
              <button onClick={() => setShowPaymentModal(false)} className="btn-secondary">
                取消
              </button>
              <button onClick={handleSavePayment} className="btn-primary" disabled={isSaving}>
                {isSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sources Modal */}
      {showSourcesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">劳务来源管理</h3>
              <button
                onClick={() => setShowSourcesModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="form-label">现有来源</label>
                <div className="space-y-2">
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <div>
                        <span className="font-medium">{source.name}</span>
                        {source.description && (
                          <p className="text-xs text-gray-500">{source.description}</p>
                        )}
                      </div>
                      <span
                        className={`text-xs ${
                          source.is_active ? 'text-green-600' : 'text-gray-400'
                        }`}
                      >
                        {source.is_active ? '启用' : '停用'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4">
                <label className="form-label">添加新来源</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    className="form-input"
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    placeholder="来源名称，如：艺教"
                  />
                  <input
                    type="text"
                    className="form-input"
                    value={newSourceDesc}
                    onChange={(e) => setNewSourceDesc(e.target.value)}
                    placeholder="描述（可选）"
                  />
                  <button
                    onClick={handleCreateSource}
                    className="btn-primary w-full"
                    disabled={!newSourceName.trim()}
                  >
                    添加来源
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
