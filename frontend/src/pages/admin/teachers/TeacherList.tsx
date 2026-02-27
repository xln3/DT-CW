import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, AlertCircle, Users } from 'lucide-react';
import EmptyState from '../../../components/EmptyState';
import TableSkeleton from '../../../components/TableSkeleton';
import { useAuth } from '../../../contexts/AuthContext';
import { useTeachers, useDeleteTeacher } from '../../../hooks';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

export default function TeacherList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'committee');
  const debouncedSearch = useDebouncedValue(search);

  const { data: teachers = [], isLoading, error } = useTeachers({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
  });
  const deleteMutation = useDeleteTeacher();

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteConfirm(null);
    } catch {
      // error handled by React Query
    }
  };

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <Link to="/admin/teachers/new" className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            添加教师
          </Link>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4">
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
          </div>
        </div>
      </div>

      {(error || deleteMutation.error) && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">
            {(error as any)?.response?.data?.error || (deleteMutation.error as any)?.response?.data?.error || '加载失败'}
          </span>
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
                <th className="hidden sm:table-cell">电话</th>
                <th>状态</th>
                {canEdit && <th className="text-right">操作</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="p-6">
                    <TableSkeleton columns={canEdit ? 5 : 4} rows={4} />
                  </td>
                </tr>
              ) : teachers.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4}>
                    <EmptyState icon={Users} title="暂无教师数据" />
                  </td>
                </tr>
              ) : (
                teachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-gray-50">
                    <td className="font-medium">{teacher.name}</td>
                    <td>{teacher.specialty || '-'}</td>
                    <td className="hidden sm:table-cell">{teacher.phone || '-'}</td>
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
