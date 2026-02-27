import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Search, User } from 'lucide-react';
import { publicApi } from '../../services/api';
import { PROGRAM_CATEGORIES } from '../../types';
import type { OverviewMatrixData } from '../../types';
import AttendanceBar from './components/AttendanceBar';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

interface MemberResult {
  member: {
    id: number;
    name: string;
    student_id: string;
    department: string;
  };
  programs: {
    program_id: number;
    program_name: string;
    total_rehearsals: number;
    normal_count: number;
    late_count: number;
    early_leave_count: number;
    absent_count: number;
    leave_count: number;
    attendance_rate: number;
  }[];
  overall_stats: {
    total_rehearsals: number;
    normal_count: number;
    late_count: number;
    early_leave_count: number;
    absent_count: number;
    leave_count: number;
    attendance_rate: number;
  };
}

export default function AttendanceOverview() {
  const [data, setData] = useState<OverviewMatrixData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 400);
  const [searchResults, setSearchResults] = useState<MemberResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  // Search when debounced term changes
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSearchResults([]);
      setSearchError('');
      return;
    }

    const doSearch = async () => {
      setIsSearching(true);
      setSearchError('');
      try {
        const result = await publicApi.searchMemberAttendance(debouncedSearch.trim());
        setSearchResults(result.results || []);
      } catch (err: any) {
        setSearchError(err.response?.data?.error || '查询失败');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };
    doSearch();
  }, [debouncedSearch]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await publicApi.getOverviewMatrix();
      setData(result);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    const cat = PROGRAM_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category || '其他';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAttendanceBadge = (rate: number) => {
    if (rate >= 90)
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">优秀</span>;
    if (rate >= 70)
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">良好</span>;
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">需改进</span>;
  };

  const isSearchActive = searchTerm.trim().length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
        <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
        <span className="text-sm text-red-700">{error}</span>
      </div>
    );
  }

  const hasData = data && data.programs.length > 0 && data.dates.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">考勤总览</h1>
        {data?.semester && (
          <p className="mt-2 text-gray-600">当前学期：{data.semester.name}</p>
        )}
      </div>

      {/* Search box */}
      <div className="max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="输入姓名或学号查询个人考勤..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input pl-10 w-full"
          />
        </div>
      </div>

      {/* Search results (when searching) */}
      {isSearchActive && (
        <div className="space-y-6">
          {searchError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
              <span className="text-sm text-red-700">{searchError}</span>
            </div>
          )}

          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-3 text-gray-500">查询中...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">未找到匹配的成员</p>
              <p className="text-sm text-gray-400 mt-1">请检查输入的姓名或学号是否正确</p>
            </div>
          ) : (
            searchResults.map((result) => (
              <div key={result.member.id} className="card">
                <div className="card-body space-y-6">
                  {/* Member Info */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-6 h-6 text-primary-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{result.member.name}</h2>
                        {result.member.student_id && (
                          <p className="text-gray-500">学号：{result.member.student_id}</p>
                        )}
                        {result.member.department && (
                          <p className="text-gray-500">{result.member.department}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className={`text-3xl font-bold ${getAttendanceColor(result.overall_stats.attendance_rate)}`}>
                        {result.overall_stats.attendance_rate.toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-500">总体出勤率</p>
                    </div>
                  </div>

                  {/* Overall Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{result.overall_stats.total_rehearsals}</p>
                      <p className="text-xs text-gray-500">总排练次数</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{result.overall_stats.normal_count}</p>
                      <p className="text-xs text-gray-500">正常出勤</p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-600">
                        {result.overall_stats.late_count + (result.overall_stats.early_leave_count || 0)}
                      </p>
                      <p className="text-xs text-gray-500">迟到/早退</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{result.overall_stats.absent_count}</p>
                      <p className="text-xs text-gray-500">缺勤</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{result.overall_stats.leave_count}</p>
                      <p className="text-xs text-gray-500">请假</p>
                    </div>
                  </div>

                  {/* Program Details */}
                  {result.programs.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-3">参与节目</h3>
                      <div className="space-y-3">
                        {result.programs.map((program) => (
                          <div key={program.program_id} className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gray-900">{program.program_name}</h4>
                              <div className="flex items-center space-x-2">
                                <span className={`font-semibold ${getAttendanceColor(program.attendance_rate)}`}>
                                  {program.attendance_rate.toFixed(1)}%
                                </span>
                                {getAttendanceBadge(program.attendance_rate)}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                              <span>排练 {program.total_rehearsals} 次</span>
                              <span className="text-green-600">正常 {program.normal_count}</span>
                              <span className="text-yellow-600">
                                迟到/早退 {program.late_count + (program.early_leave_count || 0)}
                              </span>
                              <span className="text-red-600">缺勤 {program.absent_count}</span>
                              <span className="text-blue-600">请假 {program.leave_count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Overview Matrix (when not searching) */}
      {!isSearchActive && (
        <>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-500 rounded" />
              <span className="text-gray-600">正常出勤</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-yellow-500 rounded" />
              <span className="text-gray-600">迟到/早退</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gray-400 rounded" />
              <span className="text-gray-600">缺勤/请假</span>
            </div>
          </div>

          {/* Matrix Table */}
          {!hasData ? (
            <div className="card">
              <div className="card-body">
                <p className="text-center text-gray-500 py-8">暂无考勤数据</p>
              </div>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th
                        className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200"
                        style={{ minWidth: '160px' }}
                      >
                        节目
                      </th>
                      {data.dates.map((date) => (
                        <th
                          key={date}
                          className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                          style={{ minWidth: '60px' }}
                        >
                          {formatDate(date)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.programs.map((program) => (
                      <tr key={program.id} className="hover:bg-gray-50">
                        <td className="sticky left-0 z-10 bg-white px-4 py-3 border-r border-gray-200">
                          <Link
                            to={`/attendance/programs/${program.id}`}
                            className="block hover:text-primary-600"
                          >
                            <div className="font-medium text-gray-900">{program.name}</div>
                            <div className="text-xs text-gray-500">{getCategoryLabel(program.category)}</div>
                          </Link>
                        </td>
                        {data.dates.map((date) => {
                          const cell = data.matrix[program.id]?.[date];
                          return (
                            <td key={date} className="px-2 py-3">
                              {cell ? (
                                <AttendanceBar cell={cell} />
                              ) : (
                                <div className="w-full h-4 flex items-center justify-center">
                                  <span className="text-gray-300">-</span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
