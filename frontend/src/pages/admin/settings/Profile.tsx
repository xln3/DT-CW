import { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle, User, Lock, Edit2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { authApi } from '../../../services/api';
import type { Member } from '../../../types';

interface UserWithMember {
  id: number;
  username: string;
  display_name: string;
  email?: string;
  phone?: string;
  role: string;
  status: string;
  member?: Member;
}

export default function Profile() {
  const { user, refreshUser } = useAuth();

  // Profile form state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: '',
    display_name: '',
    email: '',
    phone: '',
    gender: '',
    department: '',
    grade: '',
    student_id: '',
    member_phone: '',
    // Extended member fields
    class_name: '',
    member_email: '',
    dormitory: '',
    birth_date: '',
    ethnicity: '',
    hometown: '',
    political_status: '',
    party_branch: '',
    is_talented: false,
    is_concentrated_class: false,
    team_role: '',
    join_year: undefined as number | undefined,
    team_level: '',
    graduating_this_semester: false,
  });

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load user data into form
  useEffect(() => {
    if (user) {
      const u = user as UserWithMember;
      setProfileForm({
        username: u.username || '',
        display_name: u.display_name || '',
        email: u.email || '',
        phone: u.phone || '',
        gender: u.member?.gender || '',
        department: u.member?.department || '',
        grade: u.member?.grade || '',
        student_id: u.member?.student_id || '',
        member_phone: u.member?.phone || '',
        // Extended member fields
        class_name: u.member?.class_name || '',
        member_email: u.member?.email || '',
        dormitory: u.member?.dormitory || '',
        birth_date: u.member?.birth_date || '',
        ethnicity: u.member?.ethnicity || '',
        hometown: u.member?.hometown || '',
        political_status: u.member?.political_status || '',
        party_branch: u.member?.party_branch || '',
        is_talented: u.member?.is_talented || false,
        is_concentrated_class: u.member?.is_concentrated_class || false,
        team_role: u.member?.team_role || '',
        join_year: u.member?.join_year,
        team_level: u.member?.team_level || '',
        graduating_this_semester: u.member?.graduating_this_semester || false,
      });
    }
  }, [user]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setProfileForm(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'join_year') {
      setProfileForm(prev => ({ ...prev, [name]: value ? Number(value) : undefined }));
    } else {
      setProfileForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSaveProfile = async () => {
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      await authApi.updateProfile(profileForm);
      setSuccess('个人资料保存成功');
      setIsEditing(false);
      // Refresh user data in context
      if (refreshUser) {
        await refreshUser();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword) {
      setError('请填写当前密码和新密码');
      return;
    }

    if (newPassword.length < 6) {
      setError('新密码长度至少6位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccess('密码修改成功');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || '密码修改失败');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin':
        return '系统管理员';
      case 'committee':
        return '队委';
      case 'program_manager':
        return '节目负责人';
      case 'member':
        return '队员';
      default:
        return role || '-';
    }
  };

  const u = user as UserWithMember | null;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-start">
          <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-green-700">{success}</span>
        </div>
      )}

      {/* Profile Info */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center">
            <User className="w-5 h-5 mr-2 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900">个人信息</h2>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="btn-secondary text-sm"
            >
              <Edit2 className="w-4 h-4 mr-1" />
              编辑
            </button>
          )}
        </div>
        <div className="card-body">
          {isEditing ? (
            <div className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">用户名</label>
                  <input
                    type="text"
                    name="username"
                    className="form-input"
                    value={profileForm.username}
                    onChange={handleProfileChange}
                    placeholder="登录用户名（至少3位）"
                  />
                </div>
                <div>
                  <label className="form-label">显示名称</label>
                  <input
                    type="text"
                    name="display_name"
                    className="form-input"
                    value={profileForm.display_name}
                    onChange={handleProfileChange}
                  />
                </div>
                <div>
                  <label className="form-label">邮箱</label>
                  <input
                    type="email"
                    name="email"
                    className="form-input"
                    value={profileForm.email}
                    onChange={handleProfileChange}
                    placeholder="example@email.com"
                  />
                </div>
                <div>
                  <label className="form-label">手机号</label>
                  <input
                    type="text"
                    name="phone"
                    className="form-input"
                    value={profileForm.phone}
                    onChange={handleProfileChange}
                    placeholder="13800138000"
                  />
                </div>
              </div>

              {u?.member && (
                <>
                  <hr className="my-4" />
                  <h3 className="text-sm font-medium text-gray-700 mb-3">基本信息</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="form-label">性别</label>
                      <select
                        name="gender"
                        className="form-input"
                        value={profileForm.gender}
                        onChange={handleProfileChange}
                      >
                        <option value="">请选择</option>
                        <option value="男">男</option>
                        <option value="女">女</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">学号</label>
                      <input
                        type="text"
                        name="student_id"
                        className="form-input"
                        value={profileForm.student_id}
                        onChange={handleProfileChange}
                      />
                    </div>
                    <div>
                      <label className="form-label">院系</label>
                      <input
                        type="text"
                        name="department"
                        className="form-input"
                        value={profileForm.department}
                        onChange={handleProfileChange}
                      />
                    </div>
                    <div>
                      <label className="form-label">班级</label>
                      <input
                        type="text"
                        name="class_name"
                        className="form-input"
                        value={profileForm.class_name}
                        onChange={handleProfileChange}
                      />
                    </div>
                    <div>
                      <label className="form-label">年级</label>
                      <input
                        type="text"
                        name="grade"
                        className="form-input"
                        value={profileForm.grade}
                        onChange={handleProfileChange}
                        placeholder="如：大三"
                      />
                    </div>
                  </div>

                  <h3 className="text-sm font-medium text-gray-700 mb-3 mt-4">联系方式</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="form-label">手机号</label>
                      <input
                        type="text"
                        name="member_phone"
                        className="form-input"
                        value={profileForm.member_phone}
                        onChange={handleProfileChange}
                      />
                    </div>
                    <div>
                      <label className="form-label">邮箱</label>
                      <input
                        type="email"
                        name="member_email"
                        className="form-input"
                        value={profileForm.member_email}
                        onChange={handleProfileChange}
                      />
                    </div>
                    <div>
                      <label className="form-label">宿舍</label>
                      <input
                        type="text"
                        name="dormitory"
                        className="form-input"
                        value={profileForm.dormitory}
                        onChange={handleProfileChange}
                        placeholder="如：北区3号楼101"
                      />
                    </div>
                  </div>

                  <h3 className="text-sm font-medium text-gray-700 mb-3 mt-4">个人信息</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="form-label">出生日期</label>
                      <input
                        type="date"
                        name="birth_date"
                        className="form-input"
                        value={profileForm.birth_date}
                        onChange={handleProfileChange}
                      />
                    </div>
                    <div>
                      <label className="form-label">民族</label>
                      <input
                        type="text"
                        name="ethnicity"
                        className="form-input"
                        value={profileForm.ethnicity}
                        onChange={handleProfileChange}
                        placeholder="如：汉族"
                      />
                    </div>
                    <div>
                      <label className="form-label">籍贯</label>
                      <input
                        type="text"
                        name="hometown"
                        className="form-input"
                        value={profileForm.hometown}
                        onChange={handleProfileChange}
                        placeholder="如：北京市"
                      />
                    </div>
                    <div>
                      <label className="form-label">政治面貌</label>
                      <select
                        name="political_status"
                        className="form-input"
                        value={profileForm.political_status}
                        onChange={handleProfileChange}
                      >
                        <option value="">请选择</option>
                        <option value="群众">群众</option>
                        <option value="共青团员">共青团员</option>
                        <option value="预备党员">预备党员</option>
                        <option value="中共党员">中共党员</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">党团关系所在</label>
                      <input
                        type="text"
                        name="party_branch"
                        className="form-input"
                        value={profileForm.party_branch}
                        onChange={handleProfileChange}
                      />
                    </div>
                  </div>

                  <h3 className="text-sm font-medium text-gray-700 mb-3 mt-4">艺术团信息</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="form-label">入队年份</label>
                      <input
                        type="number"
                        name="join_year"
                        className="form-input"
                        value={profileForm.join_year || ''}
                        onChange={handleProfileChange}
                        placeholder="如：2023"
                      />
                    </div>
                    <div>
                      <label className="form-label">所在梯队</label>
                      <select
                        name="team_level"
                        className="form-input"
                        value={profileForm.team_level}
                        onChange={handleProfileChange}
                      >
                        <option value="">请选择</option>
                        <option value="一梯队">一梯队</option>
                        <option value="二梯队">二梯队</option>
                        <option value="三梯队">三梯队</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">队内职务</label>
                      <input
                        type="text"
                        name="team_role"
                        className="form-input"
                        value={profileForm.team_role}
                        onChange={handleProfileChange}
                        placeholder="如：队长"
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3 flex items-center space-x-6">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          name="is_talented"
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          checked={profileForm.is_talented}
                          onChange={handleProfileChange}
                        />
                        <span className="text-sm text-gray-700">特长生</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          name="is_concentrated_class"
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          checked={profileForm.is_concentrated_class}
                          onChange={handleProfileChange}
                        />
                        <span className="text-sm text-gray-700">集中班</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          name="graduating_this_semester"
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          checked={profileForm.graduating_this_semester}
                          onChange={handleProfileChange}
                        />
                        <span className="text-sm text-gray-700">本学期毕业</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center space-x-3 pt-4">
                <button
                  onClick={handleSaveProfile}
                  className="btn-primary"
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="btn-secondary"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">用户名</dt>
                <dd className="mt-1 text-sm text-gray-900">{u?.username}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">显示名称</dt>
                <dd className="mt-1 text-sm text-gray-900">{u?.display_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">角色</dt>
                <dd className="mt-1">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-800">
                    {getRoleLabel(u?.role)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">邮箱</dt>
                <dd className="mt-1 text-sm text-gray-900">{u?.email || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">手机号</dt>
                <dd className="mt-1 text-sm text-gray-900">{u?.phone || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">状态</dt>
                <dd className="mt-1">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    {u?.status === 'active' ? '正常' : '已禁用'}
                  </span>
                </dd>
              </div>

              {u?.member && (
                <>
                  <div className="col-span-full">
                    <hr className="my-2" />
                    <h3 className="text-sm font-medium text-gray-700 mt-2">基本信息</h3>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">性别</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.gender || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">学号</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.student_id || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">院系</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.department || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">班级</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.class_name || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">年级</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.grade || '-'}</dd>
                  </div>

                  <div className="col-span-full">
                    <hr className="my-2" />
                    <h3 className="text-sm font-medium text-gray-700 mt-2">联系方式</h3>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">手机号</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.phone || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">邮箱</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.email || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">宿舍</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.dormitory || '-'}</dd>
                  </div>

                  <div className="col-span-full">
                    <hr className="my-2" />
                    <h3 className="text-sm font-medium text-gray-700 mt-2">个人信息</h3>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">出生日期</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.birth_date || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">民族</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.ethnicity || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">籍贯</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.hometown || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">政治面貌</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.political_status || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">党团关系所在</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.party_branch || '-'}</dd>
                  </div>

                  <div className="col-span-full">
                    <hr className="my-2" />
                    <h3 className="text-sm font-medium text-gray-700 mt-2">艺术团信息</h3>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">入队年份</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.join_year || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">所在梯队</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.team_level || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">队内职务</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.team_role || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">特长生</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.is_talented ? '是' : '否'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">集中班</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.is_concentrated_class ? '是' : '否'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">本学期毕业</dt>
                    <dd className="mt-1 text-sm text-gray-900">{u.member.graduating_this_semester ? '是' : '否'}</dd>
                  </div>
                </>
              )}
            </dl>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center">
            <Lock className="w-5 h-5 mr-2 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900">修改密码</h2>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label htmlFor="currentPassword" className="form-label">
                当前密码
              </label>
              <input
                type="password"
                id="currentPassword"
                className="form-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="输入当前密码"
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="form-label">
                新密码
              </label>
              <input
                type="password"
                id="newPassword"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="输入新密码（至少6位）"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="form-label">
                确认新密码
              </label>
              <input
                type="password"
                id="confirmPassword"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                className="btn-primary"
                disabled={isChangingPassword}
              >
                <Save className="w-4 h-4 mr-2" />
                {isChangingPassword ? '保存中...' : '修改密码'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
