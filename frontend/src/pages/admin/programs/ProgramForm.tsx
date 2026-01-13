import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { programsApi } from '../../../services/api';
import type { ProgramForm as ProgramFormType } from '../../../types';
import { PROGRAM_CATEGORIES } from '../../../types';

export default function ProgramForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<ProgramFormType>({
    name: '',
    category: '',
    description: '',
    status: 'active',
  });

  useEffect(() => {
    if (isEdit) {
      fetchProgram();
    }
  }, [id]);

  const fetchProgram = async () => {
    setIsLoading(true);
    try {
      const program = await programsApi.get(Number(id));
      setForm({
        name: program.name,
        category: program.category || '',
        description: program.description || '',
        status: program.status,
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
              <label htmlFor="category" className="form-label">
                节目类型
              </label>
              <select
                id="category"
                name="category"
                className="form-input"
                value={form.category}
                onChange={handleChange}
              >
                <option value="">请选择类型</option>
                {PROGRAM_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
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
