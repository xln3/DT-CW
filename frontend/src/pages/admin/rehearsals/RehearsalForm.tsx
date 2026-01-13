import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { rehearsalsApi, programsApi, teachersApi } from '../../../services/api';
import type { Program, Teacher, RehearsalForm as RehearsalFormType } from '../../../types';

export default function RehearsalForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const [form, setForm] = useState<RehearsalFormType>({
    program_id: 0,
    teacher_id: undefined,
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_start_time: '',
    scheduled_end_time: '',
    location: '',
    notes: '',
  });

  useEffect(() => {
    fetchOptions();
    if (isEdit) {
      fetchRehearsal();
    }
  }, [id]);

  const fetchOptions = async () => {
    try {
      const [programsData, teachersData] = await Promise.all([
        programsApi.list({ status: 'active' }),
        teachersApi.list({ status: 'active' }),
      ]);
      setPrograms(programsData);
      setTeachers(teachersData);
    } catch (err) {
      console.error('Failed to fetch options:', err);
    }
  };

  const fetchRehearsal = async () => {
    setIsLoading(true);
    try {
      const rehearsal = await rehearsalsApi.get(Number(id));
      setForm({
        program_id: rehearsal.program_id,
        teacher_id: rehearsal.teacher_id || undefined,
        scheduled_date: rehearsal.scheduled_date,
        scheduled_start_time: rehearsal.scheduled_start_time?.slice(0, 5) || '',
        scheduled_end_time: rehearsal.scheduled_end_time?.slice(0, 5) || '',
        location: rehearsal.location || '',
        notes: rehearsal.notes || '',
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
    setForm((prev) => ({
      ...prev,
      [name]: name === 'program_id' || name === 'teacher_id' ? (value ? Number(value) : undefined) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.program_id) {
      setError('请选择节目');
      return;
    }

    if (!form.scheduled_date) {
      setError('请选择排练日期');
      return;
    }

    setIsSaving(true);
    try {
      if (isEdit) {
        await rehearsalsApi.update(Number(id), form);
      } else {
        await rehearsalsApi.create(form);
      }
      navigate('/admin/rehearsals');
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
          onClick={() => navigate('/admin/rehearsals')}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? '编辑排练' : '创建排练'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isEdit ? '修改排练安排' : '安排新的排练'}
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
              <label htmlFor="program_id" className="form-label">
                节目 <span className="text-red-500">*</span>
              </label>
              <select
                id="program_id"
                name="program_id"
                required
                className="form-input"
                value={form.program_id || ''}
                onChange={handleChange}
              >
                <option value="">请选择节目</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="teacher_id" className="form-label">
                教师
              </label>
              <select
                id="teacher_id"
                name="teacher_id"
                className="form-input"
                value={form.teacher_id || ''}
                onChange={handleChange}
              >
                <option value="">请选择教师（可选）</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name} {teacher.specialty && `(${teacher.specialty})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="scheduled_date" className="form-label">
                排练日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="scheduled_date"
                name="scheduled_date"
                required
                className="form-input"
                value={form.scheduled_date}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="location" className="form-label">
                地点
              </label>
              <input
                type="text"
                id="location"
                name="location"
                className="form-input"
                placeholder="例如: 舞蹈排练厅A"
                value={form.location}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="scheduled_start_time" className="form-label">
                开始时间
              </label>
              <input
                type="time"
                id="scheduled_start_time"
                name="scheduled_start_time"
                className="form-input"
                value={form.scheduled_start_time}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="scheduled_end_time" className="form-label">
                结束时间
              </label>
              <input
                type="time"
                id="scheduled_end_time"
                name="scheduled_end_time"
                className="form-input"
                value={form.scheduled_end_time}
                onChange={handleChange}
              />
            </div>
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
            onClick={() => navigate('/admin/rehearsals')}
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
