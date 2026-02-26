import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, AlertCircle, Upload, Download, X, Users } from 'lucide-react';
import EmptyState from '../../../components/EmptyState';
import TableSkeleton from '../../../components/TableSkeleton';
import { membersApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import Pagination from '../../../components/Pagination';
import { useMembers, useDeleteMember, memberKeys } from '../../../hooks';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useQueryClient } from '@tanstack/react-query';

export default function MemberList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    created?: number;
    updated?: number;
    errors?: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'committee');
  const debouncedSearch = useDebouncedValue(search);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useMembers({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    page,
    per_page: perPage,
  });
  const members = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const deleteMutation = useDeleteMember();

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteConfirm(null);
    } catch {
      // error available via deleteMutation.error
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await membersApi.importCsv(file);
      setImportResult({
        success: true,
        created: result.created_count,
        updated: result.updated_count,
        errors: result.errors,
      });
      await queryClient.invalidateQueries({ queryKey: memberKeys.lists() });
    } catch (err: any) {
      setImportResult({
        success: false,
        errors: [err.response?.data?.error || '导入失败'],
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = () => {
    window.open(membersApi.downloadTemplate(), '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">队员管理</h1>
          <p className="mt-1 text-sm text-gray-500">管理艺术团所有队员信息</p>
        </div>
        {canEdit && (
          <div className="flex items-center space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImport}
              accept=".csv"
              className="hidden"
            />
            <button
              onClick={handleDownloadTemplate}
              className="btn-secondary"
              title="下载导入模板"
            >
              <Download className="w-4 h-4 mr-2" />
              模板
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary"
              disabled={isImporting}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isImporting ? '导入中...' : '导入'}
            </button>
            <Link to="/admin/members/new" className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              添加队员
            </Link>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索姓名、学号或院系..."
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
              <option value="active">在队</option>
              <option value="inactive">离队</option>
            </select>
          </div>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`border rounded-md p-4 ${importResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {importResult.success ? (
                <p className="text-sm text-green-700">
                  导入完成：创建 {importResult.created} 名队员，更新 {importResult.updated} 名队员
                  {importResult.errors && importResult.errors.length > 0 && (
                    <span className="text-yellow-700">（部分行有错误）</span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-red-700">导入失败</p>
              )}
              {importResult.errors && importResult.errors.length > 0 && (
                <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
                  {importResult.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={() => setImportResult(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Error message */}
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
          <table className="table text-sm">
            <thead>
              <tr>
                <th>姓名</th>
                <th className="hidden md:table-cell">性别</th>
                <th>学号</th>
                <th>院系</th>
                <th className="hidden lg:table-cell">班级</th>
                <th className="hidden lg:table-cell">手机号</th>
                <th className="hidden md:table-cell">入队年份</th>
                <th className="hidden lg:table-cell">梯队</th>
                <th className="hidden lg:table-cell">职务</th>
                <th className="hidden xl:table-cell">毕业</th>
                <th>状态</th>
                {canEdit && <th className="text-right">操作</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={canEdit ? 12 : 11} className="p-6">
                    <TableSkeleton columns={6} rows={5} />
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 12 : 11}>
                    <EmptyState icon={Users} title="暂无队员数据" />
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="font-medium whitespace-nowrap">{member.name}</td>
                    <td className="hidden md:table-cell">{member.gender || '-'}</td>
                    <td>{member.student_id || '-'}</td>
                    <td className="max-w-32 truncate" title={member.department || ''}>{member.department || '-'}</td>
                    <td className="hidden lg:table-cell">{member.class_name || '-'}</td>
                    <td className="hidden lg:table-cell">{member.phone || '-'}</td>
                    <td className="hidden md:table-cell">{member.join_year || '-'}</td>
                    <td className="hidden lg:table-cell">{member.team_level || '-'}</td>
                    <td className="hidden lg:table-cell">{member.team_role || '-'}</td>
                    <td className="hidden xl:table-cell">
                      {member.graduating_this_semester ? (
                        <span className="text-orange-600">是</span>
                      ) : '-'}
                    </td>
                    <td>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          member.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {member.status === 'active' ? '在队' : '离队'}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            to={`/admin/members/${member.id}/edit`}
                            className="p-2 text-gray-400 hover:text-primary-600"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          {deleteConfirm === member.id ? (
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleDelete(member.id)}
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
                              onClick={() => setDeleteConfirm(member.id)}
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
    </div>
  );
}
