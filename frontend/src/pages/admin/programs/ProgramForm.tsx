import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { programsApi, teachersApi } from '../../../services/api';
import type { ProgramForm as ProgramFormType, Teacher } from '../../../types';

const PRESET_COLORS = [
  { value: '#3498DB', label: '蓝色' },
  { value: '#E74C3C', label: '红色' },
  { value: '#2ECC71', label: '绿色' },
  { value: '#F39C12', label: '橙色' },
  { value: '#9B59B6', label: '紫色' },
  { value: '#1ABC9C', label: '青色' },
  { value: '#E91E63', label: '粉色' },
  { value: '#607D8B', label: '灰色' },
];

export default function ProgramForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [form, setForm] = useState<ProgramFormType>({
    name: '',
    category: 'dance',  // Default to dance, only type needed
    description: '',
    display_color: '#3498DB',
    status: 'active',
    teacher_ids: [],
  });

  useEffect(() => {
    fetchTeachers();
    if (isEdit) {
      fetchProgram();
    }
  }, [id]);

  const fetchTeachers = async () => {
    try {
      const data = await teachersApi.list({ status: 'active' });
      setTeachers(data);
    } catch {
      // Non-critical
    }
  };

  const fetchProgram = async () => {
    setIsLoading(true);
    try {
      const program = await programsApi.get(Number(id));
      setForm({
        name: program.name,
        category: program.category || '',
        description: program.description || '',
        display_color: program.display_color || '#3498DB',
        status: program.status,
        teacher_ids: program.teacher_ids || [],
      });
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('节目名称不能为空');
      return;
    }

    setIsSaving(true);
    try {
      if (isEdit) {
        await programsApi.update(Number(id), form);
      } else {
        await programsApi.create(form);
      }
      navigate('/admin/programs');
    } catch (err: any) {
      setError(err.response?.data?.error || '保存失败');
    } finally {
      setIsSaving(false);
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
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/admin/programs')}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? '编辑节目' : '创建节目'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isEdit ? '修改节目信息' : '创建一个新的节目'}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <div className="card-body space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="form-label">
                节目名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="form-input"
                value={form.name}
                onChange={handleChange}
                placeholder="例如: 春天的故事"
              />
            </div>

            <div>
              <label className="form-label">
                展示颜色
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setForm({ ...form, display_color: color.value })}
                      className={`w-8 h-8 rounded-md transition-all ${
                        form.display_color === color.value
                          ? 'ring-2 ring-offset-2 ring-primary-500 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.display_color}
                    onChange={(e) => setForm({ ...form, display_color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                    title="自定义颜色"
                  />
                  <span className="text-sm text-gray-500">{form.display_color}</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                用于时间表中区分不同节目
              </p>
            </div>

            {isEdit && (
              <div>
                <label htmlFor="status" className="form-label">
                  状态
                </label>
                <select
                  id="status"
                  name="status"
                  className="form-input"
                  value={form.status}
                  onChange={handleChange}
                >
                  <option value="active">进行中</option>
                  <option value="completed">已完成</option>
                  <option value="cancelled">已取消</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="description" className="form-label">
              节目描述
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              className="form-input"
              value={form.description}
              onChange={handleChange}
              placeholder="输入节目描述..."
            />
          </div>

          {/* Teacher binding */}
          {teachers.length > 0 && (
            <div>
              <label className="form-label">绑定教师</label>
              <div className="flex flex-wrap gap-3">
                {teachers.map((teacher) => (
                  <label key={teacher.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.teacher_ids?.includes(teacher.id) || false}
                      onChange={(e) => {
                        const ids = form.teacher_ids || [];
                        setForm({
                          ...form,
                          teacher_ids: e.target.checked
                            ? [...ids, teacher.id]
                            : ids.filter((tid) => tid !== teacher.id),
                        });
                      }}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">
                      {teacher.name}{teacher.specialty ? ` (${teacher.specialty})` : ''}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">选择负责该节目的教师，排练时会优先显示</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/admin/programs')}
          >
            取消
          </button>
          <button type="submit" className="btn-primary" disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
