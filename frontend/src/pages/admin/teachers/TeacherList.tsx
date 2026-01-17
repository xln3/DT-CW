import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, AlertCircle, FileText, DollarSign } from 'lucide-react';
import { teachersApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { Teacher } from '../../../types';

export default function TeacherList() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'committee');

  const fetchTeachers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await teachersApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setTeachers(data);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTeachers();
  };

  const handleDelete = async (id: number) => {
    try {
      await teachersApi.delete(id);
      setTeachers(teachers.filter((t) => t.id !== id));
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.response?.data?.error || '删除失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">教师管理</h1>
          <p className="mt-1 text-sm text-gray-500">管理艺术团所有教师信息</p>
        </div>
        <div className="flex items-center space-x-3">
          <Link to="/admin/teachers/applications" className="btn-secondary">
            <FileText className="w-4 h-4 mr-2" />
            入校申请
          </Link>
          <Link to="/admin/teachers/payments" className="btn-secondary">
            <DollarSign className="w-4 h-4 mr-2" />
            劳务发放
          </Link>
          {canEdit && (
            <Link to="/admin/teachers/new" className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              添加教师
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索姓名或专业特长..."
                  className="form-input pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <select
              className="form-input w-full sm:w-40"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">全部状态</option>
              <option value="active">在职</option>
              <option value="inactive">离职</option>
            </select>
            <button type="submit" className="btn-primary">
              搜索
            </button>
          </form>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>专业特长</th>
                <th>电话</th>
                <th>状态</th>
                {canEdit && <th className="text-right">操作</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                      <span className="ml-3 text-gray-500">加载中...</span>
                    </div>
                  </td>
                </tr>
              ) : teachers.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="text-center py-8 text-gray-500">
                    暂无教师数据
                  </td>
                </tr>
              ) : (
                teachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-gray-50">
                    <td className="font-medium">{teacher.name}</td>
                    <td>{teacher.specialty || '-'}</td>
                    <td>{teacher.phone || '-'}</td>
                    <td>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          teacher.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {teacher.status === 'active' ? '在职' : '离职'}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            to={`/admin/teachers/${teacher.id}/edit`}
                            className="p-2 text-gray-400 hover:text-primary-600"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          {deleteConfirm === teacher.id ? (
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleDelete(teacher.id)}
                                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                确认
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(teacher.id)}
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

      {!isLoading && teachers.length > 0 && (
        <div className="text-sm text-gray-500">共 {teachers.length} 名教师</div>
      )}
    </div>
  );
}
