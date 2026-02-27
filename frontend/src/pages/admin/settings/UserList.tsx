import { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  AlertCircle,
  User,
  Shield,
  X,
  Users,
} from 'lucide-react';
import EmptyState from '../../../components/EmptyState';
import { usersApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { User as UserType } from '../../../types';
import Pagination from '../../../components/Pagination';
import { useUsers, useDeleteUser, userKeys } from '../../../hooks';
import { useQueryClient } from '@tanstack/react-query';

const ROLE_LABELS: Record<string, string> = {
  admin: '系统管理员',
  committee: '队委',
  program_manager: '节目负责人',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  committee: 'bg-blue-100 text-blue-800',
  program_manager: 'bg-green-100 text-green-800',
};

export default function UserList() {
  const { user: currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [page, setPage] = useState(1);
  const perPage = 20;
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [form, setForm] = useState({
    username: '',
    password: '',
    display_name: '',
    role: 'committee',
    email: '',
    phone: '',
    status: 'active',
  });
  const [isSaving, setIsSaving] = useState(false);

  const queryClient = useQueryClient();
  const { data, isLoading } = useUsers({ page, per_page: perPage });
  const users = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const deleteMutation = useDeleteUser();

  const handleOpenForm = (user?: UserType) => {
    if (user) {
      setEditingUser(user);
      setForm({
        username: user.username,
        password: '',
        display_name: user.display_name,
        role: user.role,
        email: user.email || '',
        phone: user.phone || '',
        status: user.status,
      });
    } else {
      setEditingUser(null);
      setForm({
        username: '',
        password: '',
        display_name: '',
        role: 'committee',
        email: '',
        phone: '',
        status: 'active',
      });
    }
    setShowForm(true);
    setError('');
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingUser(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.display_name.trim()) {
      setError('显示名称不能为空');
      return;
    }

    if (!editingUser) {
      if (!form.username.trim()) {
        setError('用户名不能为空');
        return;
      }
      if (!form.password || form.password.length < 6) {
        setError('密码长度至少6位');
        return;
      }
    }

    setIsSaving(true);
    setError('');

    try {
      if (editingUser) {
        const updateData: Record<string, string> = {
          display_name: form.display_name,
          role: form.role,
          email: form.email,
          phone: form.phone,
          status: form.status,
        };
        if (form.password) {
          updateData.password = form.password;
        }
        await usersApi.update(editingUser.id, updateData);
      } else {
        await usersApi.create({
          username: form.username,
          password: form.password,
          display_name: form.display_name,
          role: form.role,
          email: form.email || undefined,
          phone: form.phone || undefined,
        });
      }
      await queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      handleCloseForm();
    } catch (err: any) {
      setError(err.response?.data?.error || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该用户吗？')) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch {
      // error available via deleteMutation.error
    }
  };

  const handleToggleStatus = async (user: UserType) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await usersApi.update(user.id, { status: newStatus });
      await queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    } catch (err: any) {
      setError(err.response?.data?.error || '更新失败');
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
      <div className="flex justify-end">
        <button onClick={() => handleOpenForm()} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          新建用户
        </button>
      </div>

      {(error || deleteMutation.error) && !showForm && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">
            {error || (deleteMutation.error as any)?.response?.data?.error || '操作失败'}
          </span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          {users.length === 0 ? (
            <EmptyState icon={Users} title="暂无用户数据" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      用户
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      角色
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      联系方式
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            {user.role === 'admin' ? (
                              <Shield className="w-5 h-5 text-gray-600" />
                            ) : (
                              <User className="w-5 h-5 text-gray-600" />
                            )}
                          </div>
                          <div className="ml-4">
                            <p className="font-medium text-gray-900">
                              {user.display_name}
                            </p>
                            <p className="text-sm text-gray-500">@{user.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-800'}`}
                        >
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email || user.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.status === 'active' ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            正常
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            已禁用
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenForm(user)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {user.id !== currentUser?.id && (
                            <>
                              <button
                                onClick={() => handleToggleStatus(user)}
                                className={`p-2 rounded ${
                                  user.status === 'active'
                                    ? 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'
                                    : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                                }`}
                                title={user.status === 'active' ? '禁用' : '启用'}
                              >
                                {user.status === 'active' ? (
                                  <X className="w-4 h-4" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDelete(user.id)}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                  title="删除"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {!isLoading && (
        <Pagination
          page={page}
          pages={pages}
          total={total}
          perPage={perPage}
          onChange={setPage}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                {editingUser ? '编辑用户' : '新建用户'}
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

                {!editingUser && (
                  <div>
                    <label htmlFor="username" className="form-label">
                      用户名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="username"
                      className="form-input"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder="用于登录的用户名"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="display_name" className="form-label">
                    显示名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="display_name"
                    className="form-input"
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    placeholder="在系统中显示的名称"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="form-label">
                    {editingUser ? '新密码 (留空不修改)' : '密码'}{' '}
                    {!editingUser && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="password"
                    id="password"
                    className="form-input"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editingUser ? '留空不修改密码' : '至少6位密码'}
                  />
                </div>

                <div>
                  <label htmlFor="role" className="form-label">
                    角色 <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="role"
                    className="form-input"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    {isAdmin && <option value="admin">系统管理员</option>}
                    <option value="committee">队委</option>
                    <option value="program_manager">节目负责人</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="email" className="form-label">
                    邮箱
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="form-input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="可选"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="form-label">
                    电话
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    className="form-input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="可选"
                  />
                </div>

                {editingUser && (
                  <div>
                    <label htmlFor="status" className="form-label">
                      状态
                    </label>
                    <select
                      id="status"
                      className="form-input"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      disabled={editingUser.id === currentUser?.id}
                    >
                      <option value="active">正常</option>
                      <option value="inactive">禁用</option>
                    </select>
                  </div>
                )}
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
