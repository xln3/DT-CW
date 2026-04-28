import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Sparkles, LogIn } from 'lucide-react';
import { publicApi } from '../../services/api';
import { PROGRAM_CATEGORIES } from '../../types';
import type { OverviewMatrixData } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import AttendanceBar from './components/AttendanceBar';

export default function AttendanceOverview() {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<OverviewMatrixData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

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

  const hasData = data && data.programs.length > 0 && data.dates.length > 0;

  return (
    <div className="space-y-6" data-testid="attendance-overview">
      {/* Hero CTA — only when not logged in */}
      {!isAuthenticated && (
        <div className="rounded-lg border border-primary-200 bg-gradient-to-r from-primary-50 to-blue-50 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary-600 flex items-center justify-center">
                <LogIn className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                  艺术团成员？登录查看个人考勤详情
                </h2>
                <p className="mt-0.5 text-xs sm:text-sm text-gray-600">
                  节目经理 / 委员可登录管理节目与考勤
                </p>
              </div>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-md text-base font-semibold shadow-md hover:bg-primary-700 hover:shadow-lg transition-all whitespace-nowrap self-start sm:self-auto"
            >
              <LogIn className="w-5 h-5 mr-2" />
              登录
            </Link>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">考勤总览</h1>
        {data?.semester && (
          <p className="mt-2 text-gray-600">当前学期：{data.semester.name}</p>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
        <div className="flex items-center space-x-1.5">
          <div className="w-3.5 h-3.5 bg-green-500 rounded-sm" />
          <span>正常出勤</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-3.5 h-3.5 bg-amber-400 rounded-sm" />
          <span>迟到 / 早退</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-3.5 h-3.5 bg-orange-500 rounded-sm" />
          <span>缺勤 / 请假</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <div className="w-3.5 h-3.5 rounded-sm border border-dashed border-gray-300" />
          <span>未标记</span>
        </div>
        <span className="inline-flex items-center">
          <Sparkles className="w-3.5 h-3.5 text-purple-500 mr-1" />
          <span>鼓励模式（按出席总数计）</span>
        </span>
      </div>

      {/* Loading / error / matrix */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      ) : !hasData ? (
        <div className="card">
          <div className="card-body">
            <p className="text-center text-gray-500 py-8">暂无考勤数据</p>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden" data-testid="attendance-overview-loaded">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th
                    className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200"
                    style={{ minWidth: '180px' }}
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
                {data.programs.map((program) => {
                  const isCumulative = program.attendance_mode === 'cumulative';
                  return (
                    <tr key={program.id} className="hover:bg-gray-50">
                      <td
                        className={`sticky left-0 z-10 px-4 py-3 border-r border-gray-200 ${
                          isCumulative ? 'bg-purple-50' : 'bg-white'
                        }`}
                      >
                        <Link
                          to={`/attendance/programs/${program.id}`}
                          className="block hover:text-primary-600"
                        >
                          <div className="flex items-center font-medium text-gray-900">
                            {isCumulative && (
                              <Sparkles
                                className="w-3.5 h-3.5 text-purple-500 mr-1.5 flex-shrink-0"
                                aria-label="鼓励模式"
                              />
                            )}
                            <span className="truncate">{program.name}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {getCategoryLabel(program.category)}
                          </div>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
