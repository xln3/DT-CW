import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, TrendingUp, AlertCircle, ChevronRight } from 'lucide-react';
import { publicApi } from '../../services/api';
import { PROGRAM_CATEGORIES } from '../../types';

interface ProgramStats {
  id: number;
  name: string;
  category: string;
  member_count: number;
  rehearsal_count: number;
  attendance_rate: number;
}

interface OverviewData {
  semester: {
    id: number;
    name: string;
  } | null;
  programs: ProgramStats[];
  overall_stats: {
    total_members: number;
    total_programs: number;
    total_rehearsals: number;
    average_attendance_rate: number;
  };
}

export default function AttendanceOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await publicApi.getAttendanceOverview();
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    const cat = PROGRAM_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category || '其他';
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAttendanceBg = (rate: number) => {
    if (rate >= 90) return 'bg-green-100';
    if (rate >= 70) return 'bg-yellow-100';
    return 'bg-red-100';
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">考勤总览</h1>
        {data?.semester && (
          <p className="mt-2 text-gray-600">当前学期：{data.semester.name}</p>
        )}
      </div>

      {/* Overall Stats */}
      {data?.overall_stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="card-body text-center">
              <p className="text-3xl font-bold text-primary-600">
                {data.overall_stats.total_programs}
              </p>
              <p className="text-sm text-gray-500 mt-1">节目数量</p>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <p className="text-3xl font-bold text-primary-600">
                {data.overall_stats.total_members}
              </p>
              <p className="text-sm text-gray-500 mt-1">参与人数</p>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <p className="text-3xl font-bold text-primary-600">
                {data.overall_stats.total_rehearsals}
              </p>
              <p className="text-sm text-gray-500 mt-1">排练次数</p>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <p
                className={`text-3xl font-bold ${getAttendanceColor(data.overall_stats.average_attendance_rate)}`}
              >
                {data.overall_stats.average_attendance_rate.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-500 mt-1">平均出勤率</p>
            </div>
          </div>
        </div>
      )}

      {/* Programs List */}
      <div className="card">
        <div className="card-body">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            各节目考勤情况
          </h2>

          {!data?.programs || data.programs.length === 0 ? (
            <p className="text-center text-gray-500 py-8">暂无节目数据</p>
          ) : (
            <div className="space-y-3">
              {data.programs.map((program) => (
                <Link
                  key={program.id}
                  to={`/attendance/programs/${program.id}`}
                  className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-medium text-gray-900">
                          {program.name}
                        </h3>
                        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded">
                          {getCategoryLabel(program.category)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {program.member_count} 人
                        </span>
                        <span>排练 {program.rehearsal_count} 次</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div
                        className={`px-3 py-2 rounded-lg ${getAttendanceBg(program.attendance_rate)}`}
                      >
                        <div className="flex items-center">
                          <TrendingUp
                            className={`w-4 h-4 mr-1 ${getAttendanceColor(program.attendance_rate)}`}
                          />
                          <span
                            className={`font-semibold ${getAttendanceColor(program.attendance_rate)}`}
                          >
                            {program.attendance_rate.toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">出勤率</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
