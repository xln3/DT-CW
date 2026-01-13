import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { teachersApi } from '../../../services/api';
import type { TeacherForm as TeacherFormType } from '../../../types';

export default function TeacherForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<TeacherFormType>({
    name: '',
    phone: '',
    specialty: '',
    notes: '',
    status: 'active',
  });

  useEffect(() => {
    if (isEdit) {
      fetchTeacher();
    }
  }, [id]);

  const fetchTeacher = async () => {
    setIsLoading(true);
    try {
      const teacher = await teachersApi.get(Number(id));
      setForm({
        name: teacher.name,
        phone: teacher.phone || '',
        specialty: teacher.specialty || '',
        notes: teacher.notes || '',
        status: teacher.status,
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
      setError('姓名不能为空');
      return;
    }

    setIsSaving(true);
    try {
      if (isEdit) {
        await teachersApi.update(Number(id), form);
      } else {
        await teachersApi.create(form);
      }
      navigate('/admin/teachers');
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
          onClick={() => navigate('/admin/teachers')}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? '编辑教师' : '添加教师'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isEdit ? '修改教师信息' : '添加新的教师'}
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
                姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="form-input"
                value={form.name}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="phone" className="form-label">
                电话
              </label>
              <input
                type="text"
                id="phone"
                name="phone"
                className="form-input"
                value={form.phone}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="specialty" className="form-label">
                专业特长
              </label>
              <input
                type="text"
                id="specialty"
                name="specialty"
                className="form-input"
                placeholder="例如: 舞蹈、声乐、器乐"
                value={form.specialty}
                onChange={handleChange}
              />
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
                  <option value="active">在职</option>
                  <option value="inactive">离职</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="notes" className="form-label">
              备注
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="form-input"
              value={form.notes}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/admin/teachers')}
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
