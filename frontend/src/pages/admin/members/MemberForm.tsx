import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { membersApi } from '../../../services/api';
import type { MemberForm as MemberFormType } from '../../../types';

export default function MemberForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<MemberFormType>({
    name: '',
    student_id: '',
    phone: '',
    gender: '',
    department: '',
    grade: '',
    notes: '',
    status: 'active',
    // Extended fields
    class_name: '',
    email: '',
    dormitory: '',
    birth_date: '',
    ethnicity: '',
    hometown: '',
    political_status: '',
    party_branch: '',
    is_talented: false,
    is_concentrated_class: false,
    team_role: '',
    join_year: undefined,
    team_level: '',
    graduating_this_semester: false,
  });

  useEffect(() => {
    if (isEdit) {
      fetchMember();
    }
  }, [id]);

  const fetchMember = async () => {
    setIsLoading(true);
    try {
      const member = await membersApi.get(Number(id));
      setForm({
        name: member.name,
        student_id: member.student_id || '',
        phone: member.phone || '',
        gender: member.gender || '',
        department: member.department || '',
        grade: member.grade || '',
        notes: member.notes || '',
        status: member.status,
        // Extended fields
        class_name: member.class_name || '',
        email: member.email || '',
        dormitory: member.dormitory || '',
        birth_date: member.birth_date || '',
        ethnicity: member.ethnicity || '',
        hometown: member.hometown || '',
        political_status: member.political_status || '',
        party_branch: member.party_branch || '',
        is_talented: member.is_talented || false,
        is_concentrated_class: member.is_concentrated_class || false,
        team_role: member.team_role || '',
        join_year: member.join_year,
        team_level: member.team_level || '',
        graduating_this_semester: member.graduating_this_semester || false,
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
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setForm((prev) => ({ ...prev, [name]: checked }));
    } else if (name === 'join_year') {
      setForm((prev) => ({ ...prev, [name]: value ? Number(value) : undefined }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
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
        await membersApi.update(Number(id), form);
      } else {
        await membersApi.create(form);
      }
      navigate('/admin/members');
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
          onClick={() => navigate('/admin/members')}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? '编辑队员' : '添加队员'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isEdit ? '修改队员信息' : '添加新的队员到艺术团'}
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
        <div className="card-body space-y-8">
          {/* 基本信息 */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b">基本信息</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                <label htmlFor="gender" className="form-label">
                  性别
                </label>
                <select
                  id="gender"
                  name="gender"
                  className="form-input"
                  value={form.gender}
                  onChange={handleChange}
                >
                  <option value="">请选择</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </div>

              <div>
                <label htmlFor="student_id" className="form-label">
                  学号
                </label>
                <input
                  type="text"
                  id="student_id"
                  name="student_id"
                  className="form-input"
                  value={form.student_id}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="department" className="form-label">
                  院系
                </label>
                <input
                  type="text"
                  id="department"
                  name="department"
                  className="form-input"
                  value={form.department}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="class_name" className="form-label">
                  班级
                </label>
                <input
                  type="text"
                  id="class_name"
                  name="class_name"
                  className="form-input"
                  value={form.class_name}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="grade" className="form-label">
                  年级
                </label>
                <input
                  type="text"
                  id="grade"
                  name="grade"
                  className="form-input"
                  placeholder="例如: 大三"
                  value={form.grade}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* 联系方式 */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b">联系方式</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="phone" className="form-label">
                  手机号
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
                <label htmlFor="email" className="form-label">
                  邮箱
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="form-input"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="dormitory" className="form-label">
                  宿舍
                </label>
                <input
                  type="text"
                  id="dormitory"
                  name="dormitory"
                  className="form-input"
                  placeholder="例如: 北区3号楼101"
                  value={form.dormitory}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* 个人信息 */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b">个人信息</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="birth_date" className="form-label">
                  出生日期
                </label>
                <input
                  type="date"
                  id="birth_date"
                  name="birth_date"
                  className="form-input"
                  value={form.birth_date}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="ethnicity" className="form-label">
                  民族
                </label>
                <input
                  type="text"
                  id="ethnicity"
                  name="ethnicity"
                  className="form-input"
                  placeholder="例如: 汉族"
                  value={form.ethnicity}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="hometown" className="form-label">
                  籍贯
                </label>
                <input
                  type="text"
                  id="hometown"
                  name="hometown"
                  className="form-input"
                  placeholder="例如: 北京市"
                  value={form.hometown}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="political_status" className="form-label">
                  政治面貌
                </label>
                <select
                  id="political_status"
                  name="political_status"
                  className="form-input"
                  value={form.political_status}
                  onChange={handleChange}
                >
                  <option value="">请选择</option>
                  <option value="群众">群众</option>
                  <option value="共青团员">共青团员</option>
                  <option value="预备党员">预备党员</option>
                  <option value="中共党员">中共党员</option>
                </select>
              </div>

              <div>
                <label htmlFor="party_branch" className="form-label">
                  党团关系所在
                </label>
                <input
                  type="text"
                  id="party_branch"
                  name="party_branch"
                  className="form-input"
                  value={form.party_branch}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* 艺术团信息 */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b">艺术团信息</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="join_year" className="form-label">
                  入队年份
                </label>
                <input
                  type="number"
                  id="join_year"
                  name="join_year"
                  className="form-input"
                  placeholder="例如: 2023"
                  value={form.join_year || ''}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="team_level" className="form-label">
                  所在梯队
                </label>
                <select
                  id="team_level"
                  name="team_level"
                  className="form-input"
                  value={form.team_level}
                  onChange={handleChange}
                >
                  <option value="">请选择</option>
                  <option value="一梯队">一梯队</option>
                  <option value="二梯队">二梯队</option>
                  <option value="三梯队">三梯队</option>
                </select>
              </div>

              <div>
                <label htmlFor="team_role" className="form-label">
                  队内职务
                </label>
                <input
                  type="text"
                  id="team_role"
                  name="team_role"
                  className="form-input"
                  placeholder="例如: 队长、副队长"
                  value={form.team_role}
                  onChange={handleChange}
                />
              </div>

              <div className="flex items-center space-x-6 sm:col-span-2 lg:col-span-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="is_talented"
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    checked={form.is_talented}
                    onChange={handleChange}
                  />
                  <span className="text-sm text-gray-700">特长生</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="is_concentrated_class"
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    checked={form.is_concentrated_class}
                    onChange={handleChange}
                  />
                  <span className="text-sm text-gray-700">集中班</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="graduating_this_semester"
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    checked={form.graduating_this_semester}
                    onChange={handleChange}
                  />
                  <span className="text-sm text-gray-700">本学期毕业</span>
                </label>
              </div>
            </div>
          </div>

          {/* 其他信息 */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b">其他信息</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
                    <option value="active">在队</option>
                    <option value="inactive">离队</option>
                  </select>
                </div>
              )}

              <div className={isEdit ? '' : 'sm:col-span-2'}>
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
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end space-x-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/admin/members')}
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
