import { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  AlertCircle,
  Calendar,
  Star,
} from 'lucide-react';
import { semestersApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { Semester, SemesterType } from '../../../types';
import { SEMESTER_TYPES } from '../../../types';

export default function SemesterList() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [form, setForm] = useState({
    name: '',
    semester_type: 'fall' as SemesterType,
    start_date: '',
    end_date: '',
    is_current: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSemesters();
  }, []);

  const fetchSemesters = async () => {
    setIsLoading(true);
    try {
      const data = await semestersApi.list();
      setSemesters(data);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenForm = (semester?: Semester) => {
    if (semester) {
      setEditingSemester(semester);
      setForm({
        name: semester.name,
        semester_type: semester.semester_type || 'fall',
        start_date: semester.start_date || '',
        end_date: semester.end_date || '',
        is_current: semester.is_current,
      });
    } else {
      setEditingSemester(null);
      setForm({
        name: '',
        semester_type: 'fall',
        start_date: '',
        end_date: '',
        is_current: false,
      });
    }
    setShowForm(true);
  };

  const getSemesterTypeLabel = (type: string) => {
    return SEMESTER_TYPES.find(t => t.value === type)?.label || type;
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingSemester(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('学期名称不能为空');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      if (editingSemester) {
        await semestersApi.update(editingSemester.id, {
          name: form.name,
          semester_type: form.semester_type,
          start_date: form.start_date || undefined,
          end_date: form.end_date || undefined,
          is_current: form.is_current,
        });
      } else {
        await semestersApi.create({
          name: form.name,
          semester_type: form.semester_type,
          start_date: form.start_date || undefined,
          end_date: form.end_date || undefined,
          is_current: form.is_current,
        });
      }
      await fetchSemesters();
      handleCloseForm();
    } catch (err: any) {
      setError(err.response?.data?.error || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该学期吗？')) return;

    try {
      await semestersApi.delete(id);
      setSemesters(semesters.filter((s) => s.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || '删除失败');
    }
  };

  const handleSetCurrent = async (id: number) => {
    try {
      await semestersApi.setCurrent(id);
      setSemesters(
        semesters.map((s) => ({
          ...s,
          is_current: s.id === id,
        }))
      );
    } catch (err: any) {
      setError(err.response?.data?.error || '设置失败');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex justify-end">
          <button onClick={() => handleOpenForm()} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            新建学期
          </button>
        </div>
      )}

      {error && !showForm && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          {semesters.length === 0 ? (
            <p className="text-center text-gray-500 py-8">暂无学期数据</p>
          ) : (
            <div className="space-y-3">
              {semesters.map((semester) => (
                <div
                  key={semester.id}
                  className={`p-4 rounded-lg border ${
                    semester.is_current
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">
                            {semester.name}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                            {getSemesterTypeLabel(semester.semester_type)}
                          </span>
                          {semester.is_current && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-100 text-primary-700">
                              当前学期
                            </span>
                          )}
                        </div>
                        {(semester.start_date || semester.end_date) && (
                          <p className="text-sm text-gray-500">
                            {semester.start_date || '?'} 至 {semester.end_date || '?'}
                          </p>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center space-x-2">
                        {!semester.is_current && (
                          <button
                            onClick={() => handleSetCurrent(semester.id)}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                            title="设为当前学期"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenForm(semester)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="编辑"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(semester.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                {editingSemester ? '编辑学期' : '新建学期'}
              </h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start">
                    <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="name" className="form-label">
                    学期名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    className="form-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="例如: 2024年秋季学期"
                  />
                </div>

                <div>
                  <label htmlFor="semester_type" className="form-label">
                    学期类型 <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="semester_type"
                    className="form-input"
                    value={form.semester_type}
                    onChange={(e) => setForm({ ...form, semester_type: e.target.value as SemesterType })}
                  >
                    {SEMESTER_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    寒训/暑训使用周视图，秋季/春季使用月历视图
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="start_date" className="form-label">
                      开始日期
                    </label>
                    <input
                      type="date"
                      id="start_date"
                      className="form-input"
                      value={form.start_date}
                      onChange={(e) =>
                        setForm({ ...form, start_date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="end_date" className="form-label">
                      结束日期
                    </label>
                    <input
                      type="date"
                      id="end_date"
                      className="form-input"
                      value={form.end_date}
                      onChange={(e) =>
                        setForm({ ...form, end_date: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_current"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    checked={form.is_current}
                    onChange={(e) =>
                      setForm({ ...form, is_current: e.target.checked })
                    }
                  />
                  <label htmlFor="is_current" className="ml-2 text-sm text-gray-700">
                    设为当前学期
                  </label>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseForm}
                >
                  取消
                </button>
                <button type="submit" className="btn-primary" disabled={isSaving}>
                  <Check className="w-4 h-4 mr-2" />
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
