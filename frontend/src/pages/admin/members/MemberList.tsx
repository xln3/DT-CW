import { useState, useEffect, useRef, useMemo } from 'react';
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

function formatBirthday(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  return `${month}月${day}日`;
}

export default function MemberList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [graduatingFilter, setGraduatingFilter] = useState('');
  const [sortBy, setSortBy] = useState('pinyin');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

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
  const isAdmin = hasRole('admin');
  const canEdit = isAdmin;
  const debouncedSearch = useDebouncedValue(search);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useMembers({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    graduating: graduatingFilter || undefined,
    sort: sortBy,
    page,
    per_page: perPage,
  });
  const members = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const deleteMutation = useDeleteMember();

  // Detect which optional columns have data
  const colVisibility = useMemo(() => {
    const has = (fn: (m: typeof members[0]) => unknown) => members.some((m) => !!fn(m));
    return {
      gender: has((m) => m.gender),
      student_id: has((m) => m.student_id),
      class_name: has((m) => m.class_name),
      phone: has((m) => m.phone),
      join_year: has((m) => m.join_year),
      team_level: has((m) => m.team_level),
      team_role: has((m) => m.team_role),
      graduating: has((m) => m.graduating_this_semester),
      birth_date: has((m) => m.birth_date),
    };
  }, [members]);

  const visibleColCount = useMemo(() => {
    let count = 2; // name + status (always visible)
    count += 1; // department (always visible)
    // Columns visible to all users
    if (colVisibility.birth_date) count++;
    if (colVisibility.join_year) count++;
    if (colVisibility.team_role) count++;
    if (colVisibility.graduating) count++;
    // Admin-only columns
    if (isAdmin) {
      if (colVisibility.student_id) count++;
      if (colVisibility.gender) count++;
      if (colVisibility.class_name) count++;
      if (colVisibility.phone) count++;
      if (colVisibility.team_level) count++;
    }
    if (canEdit) count++;
    return count;
  }, [isAdmin, canEdit, colVisibility]);

  // Reset to page 1 when debounced search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

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
              className="form-input w-full sm:w-32"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">全部状态</option>
              <option value="active">在队</option>
              <option value="inactive">离队</option>
            </select>
            <select
              className="form-input w-full sm:w-32"
              value={graduatingFilter}
              onChange={(e) => { setGraduatingFilter(e.target.value); setPage(1); }}
            >
              <option value="">全部队员</option>
              <option value="1">本学期毕业</option>
            </select>
            <select
              className="form-input w-full sm:w-36"
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            >
              <option value="pinyin">按姓名拼音</option>
              <option value="birthday">按生日(月日)</option>
              <option value="join_year">按入队年份</option>
            </select>
            <select
              className="form-input w-full sm:w-28"
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            >
              <option value={50}>50条/页</option>
              <option value={100}>100条/页</option>
              <option value={999}>全部</option>
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
                {isAdmin && colVisibility.gender && <th className="hidden md:table-cell">性别</th>}
                {isAdmin && colVisibility.student_id && <th className="hidden lg:table-cell">学号</th>}
                <th>院系</th>
                {isAdmin && colVisibility.class_name && <th className="hidden xl:table-cell">班级</th>}
                {isAdmin && colVisibility.phone && <th className="hidden xl:table-cell">手机号</th>}
                {colVisibility.birth_date && <th className="hidden md:table-cell">生日</th>}
                {colVisibility.join_year && <th className="hidden md:table-cell">入队</th>}
                {colVisibility.team_role && <th className="hidden lg:table-cell">职务</th>}
                {isAdmin && colVisibility.team_level && <th className="hidden xl:table-cell">梯队</th>}
                {colVisibility.graduating && <th className="hidden lg:table-cell">毕业</th>}
                <th>状态</th>
                {canEdit && <th className="text-right">操作</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={visibleColCount} className="p-6">
                    <TableSkeleton columns={6} rows={5} />
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={visibleColCount}>
                    <EmptyState icon={Users} title="暂无队员数据" />
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="font-medium whitespace-nowrap">{member.name}</td>
                    {isAdmin && colVisibility.gender && <td className="hidden md:table-cell">{member.gender || '-'}</td>}
                    {isAdmin && colVisibility.student_id && <td className="hidden lg:table-cell">{member.student_id || '-'}</td>}
                    <td className="max-w-32 truncate" title={member.department || ''}>{member.department || '-'}</td>
                    {isAdmin && colVisibility.class_name && <td className="hidden xl:table-cell">{member.class_name || '-'}</td>}
                    {isAdmin && colVisibility.phone && <td className="hidden xl:table-cell">{member.phone || '-'}</td>}
                    {colVisibility.birth_date && (
                      <td className="hidden md:table-cell whitespace-nowrap">
                        {member.birth_date ? formatBirthday(member.birth_date) : '-'}
                      </td>
                    )}
                    {colVisibility.join_year && <td className="hidden md:table-cell">{member.join_year || '-'}</td>}
                    {colVisibility.team_role && (
                      <td className="hidden lg:table-cell max-w-24 truncate" title={member.team_role || ''}>
                        {member.team_role && member.team_role !== '无' ? member.team_role : '-'}
                      </td>
                    )}
                    {isAdmin && colVisibility.team_level && <td className="hidden xl:table-cell">{member.team_level || '-'}</td>}
                    {colVisibility.graduating && (
                      <td className="hidden lg:table-cell">
                        {member.graduating_this_semester ? (
                          <span className="text-orange-600 font-medium">是</span>
                        ) : '-'}
                      </td>
                    )}
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
      {!isLoading && pages > 1 && (
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
