import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Calendar, Clock, MapPin, Users, Edit2, Trash2, AlertCircle, ChevronLeft, ChevronRight, XCircle, Upload, Download } from 'lucide-react';
import EmptyState from '../../../components/EmptyState';
import { rehearsalsApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { Rehearsal } from '../../../types';
import { useRehearsals, useDeleteRehearsal, usePrograms, rehearsalKeys } from '../../../hooks';
import { useQueryClient } from '@tanstack/react-query';

export default function RehearsalList() {
  const [programFilter, setProgramFilter] = useState<number | ''>('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    created?: number;
    errors?: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Date range filter (empty = show all)
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { hasRole } = useAuth();
  const canCreate = hasRole('admin', 'committee', 'program_manager');
  const canEdit = hasRole('admin', 'committee', 'program_manager');
  const queryClient = useQueryClient();

  const { data: programs = [] } = usePrograms({ status: 'active' });
  const { data: rehearsals = [], isLoading, error } = useRehearsals({
    program_id: programFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });
  const deleteMutation = useDeleteRehearsal();

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteConfirm(null);
    } catch {
      // error available via deleteMutation.error
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await rehearsalsApi.update(id, { status: 'cancelled' });
      await queryClient.invalidateQueries({ queryKey: rehearsalKeys.lists() });
      setCancelConfirm(null);
    } catch (err: any) {
      setActionError(err.response?.data?.error || '取消失败');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);
    setActionError('');

    try {
      const result = await rehearsalsApi.importCsv(file);
      setImportResult({
        success: true,
        created: result.created_count,
        errors: result.errors,
      });
      await queryClient.invalidateQueries({ queryKey: rehearsalKeys.lists() });
    } catch (err: any) {
      setImportResult({
        success: false,
        errors: [err.response?.data?.error || '导入失败'],
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = () => {
    window.open(rehearsalsApi.downloadTemplate(), '_blank');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'cancelled':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">已取消</span>;
      case 'completed':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">已完成</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">已安排</span>;
    }
  };

  const setThisWeek = () => {
    const d = new Date();
    const dayOfWeek = d.getDay();
    const daysToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - daysToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    setDateFrom(monday.toISOString().split('T')[0]);
    setDateTo(sunday.toISOString().split('T')[0]);
  };

  const clearDateFilter = () => {
    setDateFrom('');
    setDateTo('');
  };

  const navigateWeek = (direction: number) => {
    if (!dateFrom || !dateTo) {
      setThisWeek();
      return;
    }
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    from.setDate(from.getDate() + direction * 7);
    to.setDate(to.getDate() + direction * 7);
    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(to.toISOString().split('T')[0]);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
  };

  // Group rehearsals by date
  const groupedRehearsals = rehearsals.reduce((groups, rehearsal) => {
    const date = rehearsal.scheduled_date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(rehearsal);
    return groups;
  }, {} as Record<string, Rehearsal[]>);

  const sortedDates = Object.keys(groupedRehearsals).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">排练管理</h1>
          <p className="mt-1 text-sm text-gray-500">管理排练安排和考勤</p>
        </div>
        {canCreate && (
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
            <Link to="/admin/rehearsals/new" className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              创建排练
            </Link>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Week navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateWeek(-1)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded flex-shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 min-w-0">
                <input
                  type="date"
                  className="form-input w-full sm:w-auto"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <span className="text-gray-500 hidden sm:inline">至</span>
                <input
                  type="date"
                  className="form-input w-full sm:w-auto"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <button
                onClick={() => navigateWeek(1)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded flex-shrink-0"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Quick filters */}
            <div className="flex items-center space-x-2">
              <button
                onClick={setThisWeek}
                className={`px-3 py-2 text-sm rounded-md ${
                  dateFrom && dateTo ? 'btn-secondary' : 'btn-secondary'
                }`}
              >
                本周
              </button>
              {(dateFrom || dateTo) && (
                <button
                  onClick={clearDateFilter}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  全部
                </button>
              )}
            </div>

            {/* Program filter */}
            <select
              className="form-input w-full lg:w-48"
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">全部节目</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {(error || deleteMutation.error || actionError) && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">
            {actionError || (error as any)?.response?.data?.error || (deleteMutation.error as any)?.response?.data?.error || '加载失败'}
          </span>
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div className={`border rounded-md p-4 ${importResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {importResult.success ? (
                <p className="text-sm text-green-700">
                  成功导入 {importResult.created} 条排练记录
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
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Rehearsals List */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : rehearsals.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <EmptyState
              icon={Calendar}
              title="该时间段内暂无排练安排"
              action={canCreate ? (
                <Link to="/admin/rehearsals/new" className="btn-primary">
                  创建排练
                </Link>
              ) : undefined}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-primary-600" />
                {formatDate(date)}
              </h3>
              <div className="space-y-3">
                {groupedRehearsals[date].map((rehearsal) => (
                  <div key={rehearsal.id} className={`card hover:shadow-md transition-shadow ${rehearsal.status === 'cancelled' ? 'opacity-60' : ''}`}>
                    <div className="card-body">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 flex-wrap gap-2">
                            <h4 className="text-lg font-medium text-gray-900">
                              {rehearsal.program_name}
                            </h4>
                            {getStatusBadge(rehearsal.status)}
                            {rehearsal.teacher_name && (
                              <span className="text-sm text-gray-500">
                                教师: {rehearsal.teacher_name}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                            {(rehearsal.scheduled_start_time || rehearsal.scheduled_end_time) && (
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-1" />
                                {formatTime(rehearsal.scheduled_start_time)}
                                {rehearsal.scheduled_end_time && ` - ${formatTime(rehearsal.scheduled_end_time)}`}
                              </div>
                            )}
                            {rehearsal.location && (
                              <div className="flex items-center">
                                <MapPin className="w-4 h-4 mr-1" />
                                {rehearsal.location}
                              </div>
                            )}
                            <div className="flex items-center">
                              <Users className="w-4 h-4 mr-1" />
                              {rehearsal.attendance_count} 人
                            </div>
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex flex-wrap items-center gap-1 sm:space-x-2 sm:ml-4 sm:flex-nowrap">
                            <Link
                              to={`/admin/rehearsals/${rehearsal.id}`}
                              className="btn-secondary text-sm py-1"
                            >
                              查看详情
                            </Link>
                            {rehearsal.status !== 'cancelled' && (
                              <Link
                                to={`/admin/rehearsals/${rehearsal.id}/edit`}
                                className="p-2 text-gray-400 hover:text-primary-600"
                                title="编辑"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Link>
                            )}
                            {rehearsal.status !== 'cancelled' && (
                              cancelConfirm === rehearsal.id ? (
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => handleCancel(rehearsal.id)}
                                    className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
                                  >
                                    确认取消
                                  </button>
                                  <button
                                    onClick={() => setCancelConfirm(null)}
                                    className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                  >
                                    返回
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setCancelConfirm(rehearsal.id)}
                                  className="p-2 text-gray-400 hover:text-yellow-600"
                                  title="取消排练"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )
                            )}
                            {deleteConfirm === rehearsal.id ? (
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => handleDelete(rehearsal.id)}
                                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  确认删除
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                >
                                  返回
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(rehearsal.id)}
                                className="p-2 text-gray-400 hover:text-red-600"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && rehearsals.length > 0 && (
        <div className="text-sm text-gray-500">共 {rehearsals.length} 场排练</div>
      )}
    </div>
  );
}
