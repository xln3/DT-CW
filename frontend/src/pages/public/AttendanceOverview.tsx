import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { publicApi } from '../../services/api';
import { PROGRAM_CATEGORIES } from '../../types';
import type { OverviewMatrixData } from '../../types';
import AttendanceBar from './components/AttendanceBar';

export default function AttendanceOverview() {
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
        <h1 className="text-3xl font-bold text-gray-900">考勤总览</h1>
        {data?.semester && (
          <p className="mt-2 text-gray-600">当前学期：{data.semester.name}</p>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center space-x-6 text-sm">
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
                        <div className="font-medium text-gray-900">
                          {program.name}
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
