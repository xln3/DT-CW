import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, Users, Calendar, AlertCircle, Upload, CheckCircle } from 'lucide-react';
import { programsApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { Program } from '../../../types';

interface ImportStats {
  programs_created: number;
  members_created: number;
  users_created: number;
  assignments_created: number;
}

export default function ProgramList() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { hasRole } = useAuth();
  const canCreate = hasRole('admin', 'committee');
  const canEdit = hasRole('admin', 'committee', 'program_manager');

  const fetchPrograms = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await programsApi.list({
        status: statusFilter || undefined,
      });
      setPrograms(data);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, [statusFilter]);

  const handleDelete = async (id: number) => {
    try {
      await programsApi.delete(id);
      setPrograms(programs.filter((p) => p.id !== id));
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.response?.data?.error || '删除失败');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError('');
    setImportStats(null);

    try {
      const result = await programsApi.importCsv(file, '202601');
      setImportStats(result.stats);
      fetchPrograms();
    } catch (err: any) {
      setError(err.response?.data?.error || '导入失败');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">进行中</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">已完成</span>;
      case 'cancelled':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">已取消</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">节目管理</h1>
          <p className="mt-1 text-sm text-gray-500">管理舞蹈队所有节目</p>
        </div>
        {canCreate && (
          <div className="flex items-center space-x-3">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="btn-secondary"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isImporting ? '导入中...' : '导入CSV'}
            </button>
            <Link to="/admin/programs/new" className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              创建节目
            </Link>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              className="form-input w-full sm:w-40"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">全部状态</option>
              <option value="active">进行中</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {importStats && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">导入成功</p>
              <ul className="mt-2 text-sm text-green-700 space-y-1">
                <li>新建节目: {importStats.programs_created} 个</li>
                <li>新建成员: {importStats.members_created} 人</li>
                <li>新建用户: {importStats.users_created} 个</li>
                <li>分配关系: {importStats.assignments_created} 条</li>
              </ul>
              <button
                onClick={() => setImportStats(null)}
                className="mt-2 text-xs text-green-600 hover:text-green-800"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Programs Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : programs.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <p className="text-gray-500">暂无节目数据</p>
            {canCreate && (
              <Link to="/admin/programs/new" className="mt-4 inline-block btn-primary">
                创建第一个节目
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <div key={program.id} className="card hover:shadow-md transition-shadow">
              <div className="card-body">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: program.display_color || '#3498DB' }}
                    />
                    <h3 className="text-lg font-semibold text-gray-900">{program.name}</h3>
                  </div>
                  {getStatusBadge(program.status)}
                </div>

                {program.description && (
                  <p className="mt-3 text-sm text-gray-600 line-clamp-2">{program.description}</p>
                )}

                <div className="mt-4 flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    <span>{program.member_count} 人</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    <span>{program.completed_rehearsal_count}/{program.rehearsal_count} 次排练</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <Link
                    to={`/admin/programs/${program.id}`}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    查看详情
                  </Link>
                  {canEdit && (
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/admin/programs/${program.id}/edit`}
                        className="p-2 text-gray-400 hover:text-primary-600"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      {canCreate && (
                        deleteConfirm === program.id ? (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleDelete(program.id)}
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
                            onClick={() => setDeleteConfirm(program.id)}
                            className="p-2 text-gray-400 hover:text-red-600"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && programs.length > 0 && (
        <div className="text-sm text-gray-500">共 {programs.length} 个节目</div>
      )}
    </div>
  );
}
