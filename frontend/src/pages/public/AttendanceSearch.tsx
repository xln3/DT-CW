import { useState } from 'react';
import { Search, AlertCircle, User } from 'lucide-react';
import { publicApi } from '../../services/api';

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

export default function AttendanceSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<MemberResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    setError('');
    setHasSearched(true);

    try {
      const data = await publicApi.searchMemberAttendance(searchTerm.trim());
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.response?.data?.error || '查询失败');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAttendanceBadge = (rate: number) => {
    if (rate >= 90)
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
          优秀
        </span>
      );
    if (rate >= 70)
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
          良好
        </span>
      );
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
        需改进
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">考勤查询</h1>
        <p className="mt-2 text-gray-600">输入姓名或学号查询个人考勤记录</p>
      </div>

      {/* Search Form */}
      <div className="max-w-xl mx-auto">
        <form onSubmit={handleSearch} className="flex space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="输入姓名或学号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10 w-full"
            />
          </div>
          <button
            type="submit"
            className="btn-primary px-8"
            disabled={isLoading || !searchTerm.trim()}
          >
            {isLoading ? '查询中...' : '查询'}
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-xl mx-auto bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Results */}
      {hasSearched && !isLoading && (
        <div className="space-y-6">
          {results.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">未找到匹配的成员</p>
              <p className="text-sm text-gray-400 mt-1">
                请检查输入的姓名或学号是否正确
              </p>
            </div>
          ) : (
            results.map((result) => (
              <div key={result.member.id} className="card">
                <div className="card-body space-y-6">
                  {/* Member Info */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                        <User className="w-8 h-8 text-primary-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">
                          {result.member.name}
                        </h2>
                        {result.member.student_id && (
                          <p className="text-gray-500">
                            学号：{result.member.student_id}
                          </p>
                        )}
                        {result.member.department && (
                          <p className="text-gray-500">{result.member.department}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-3xl font-bold ${getAttendanceColor(result.overall_stats.attendance_rate)}`}
                      >
                        {result.overall_stats.attendance_rate.toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-500">总体出勤率</p>
                    </div>
                  </div>

                  {/* Overall Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">
                        {result.overall_stats.total_rehearsals}
                      </p>
                      <p className="text-xs text-gray-500">总排练次数</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {result.overall_stats.normal_count}
                      </p>
                      <p className="text-xs text-gray-500">正常出勤</p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-600">
                        {result.overall_stats.late_count + (result.overall_stats.early_leave_count || 0)}
                      </p>
                      <p className="text-xs text-gray-500">迟到/早退</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">
                        {result.overall_stats.absent_count}
                      </p>
                      <p className="text-xs text-gray-500">缺勤</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">
                        {result.overall_stats.leave_count}
                      </p>
                      <p className="text-xs text-gray-500">请假</p>
                    </div>
                  </div>

                  {/* Program Details */}
                  {result.programs.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-3">
                        参与节目
                      </h3>
                      <div className="space-y-3">
                        {result.programs.map((program) => (
                          <div
                            key={program.program_id}
                            className="p-4 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gray-900">
                                {program.program_name}
                              </h4>
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`font-semibold ${getAttendanceColor(program.attendance_rate)}`}
                                >
                                  {program.attendance_rate.toFixed(1)}%
                                </span>
                                {getAttendanceBadge(program.attendance_rate)}
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span>排练 {program.total_rehearsals} 次</span>
                              <span className="text-green-600">
                                正常 {program.normal_count}
                              </span>
                              <span className="text-yellow-600">
                                迟到/早退 {program.late_count + (program.early_leave_count || 0)}
                              </span>
                              <span className="text-red-600">
                                缺勤 {program.absent_count}
                              </span>
                              <span className="text-blue-600">
                                请假 {program.leave_count}
                              </span>
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

      {/* Help Text */}
      {!hasSearched && (
        <div className="text-center py-12 bg-gray-50 rounded-lg max-w-xl mx-auto">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">输入姓名或学号开始查询</p>
          <p className="text-sm text-gray-400 mt-2">
            支持模糊搜索，可以输入部分姓名
          </p>
        </div>
      )}
    </div>
  );
}
