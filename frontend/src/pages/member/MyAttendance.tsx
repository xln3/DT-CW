import { useState, useEffect } from 'react';
import { ClipboardCheck, AlertTriangle, Check, Clock, X } from 'lucide-react';
import { memberPortalApi, semestersApi } from '../../services/api';
import type { Semester } from '../../types';

interface ProgramAttendance {
  program_id: number;
  program_name: string;
  total_rehearsals: number;
  normal_count: number;
  late_count: number;
  absent_count: number;
  leave_count: number;
  attendance_rate: number;
}

interface AttendanceData {
  member: {
    id: number;
    name: string;
    student_id: string;
    department: string;
  } | null;
  programs: ProgramAttendance[];
  overall_stats: {
    total_rehearsals: number;
    normal_count: number;
    late_count: number;
    absent_count: number;
    leave_count: number;
    attendance_rate: number;
  };
}

export default function MyAttendance() {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const semesterList = await semestersApi.list();
        setSemesters(semesterList);
        const current = semesterList.find((s) => s.is_current);
        if (current) {
          setSelectedSemester(current.id);
        }
      } catch (err) {
        console.error('Failed to fetch semesters:', err);
      }
    };

    fetchSemesters();
  }, []);

  useEffect(() => {
    const fetchAttendance = async () => {
      setIsLoading(true);
      try {
        const result = await memberPortalApi.getMyAttendance(selectedSemester);
        setData(result);
      } catch (err) {
        console.error('Failed to fetch attendance:', err);
        const error = err as { response?: { data?: { error?: string } } };
        setError(error.response?.data?.error || '加载失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendance();
  }, [selectedSemester]);

  const getRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRateBg = (rate: number) => {
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
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const stats = data?.overall_stats;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">我的考勤</h1>
          <p className="mt-1 text-sm text-gray-500">查看您的考勤统计</p>
        </div>
        <div>
          <select
            className="form-input"
            value={selectedSemester || ''}
            onChange={(e) => setSelectedSemester(e.target.value ? Number(e.target.value) : undefined)}
          >
            {semesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.name}
                {semester.is_current && ' (当前)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Overall Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="card-body text-center">
              <div className={`text-3xl font-bold ${getRateColor(stats.attendance_rate)}`}>
                {stats.attendance_rate}%
              </div>
              <div className="text-sm text-gray-500 mt-1">总出勤率</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600 mr-1" />
                <span className="text-2xl font-bold text-gray-900">{stats.normal_count}</span>
              </div>
              <div className="text-sm text-gray-500 mt-1">正常出勤</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600 mr-1" />
                <span className="text-2xl font-bold text-gray-900">{stats.late_count}</span>
              </div>
              <div className="text-sm text-gray-500 mt-1">迟到/早退</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="flex items-center justify-center">
                <X className="w-5 h-5 text-red-600 mr-1" />
                <span className="text-2xl font-bold text-gray-900">{stats.absent_count}</span>
              </div>
              <div className="text-sm text-gray-500 mt-1">缺勤</div>
            </div>
          </div>
        </div>
      )}

      {/* Program Breakdown */}
      <div className="card">
        <div className="card-header flex items-center">
          <ClipboardCheck className="w-5 h-5 mr-2 text-gray-400" />
          <h2 className="text-lg font-medium text-gray-900">各节目考勤</h2>
        </div>
        <div className="card-body">
          {!data?.programs || data.programs.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardCheck className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">暂无考勤记录</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.programs.map((program) => (
                <div
                  key={program.program_id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">{program.program_name}</h3>
                    <span
                      className={`px-2 py-1 rounded text-sm font-medium ${getRateBg(
                        program.attendance_rate
                      )} ${getRateColor(program.attendance_rate)}`}
                    >
                      {program.attendance_rate}%
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2 text-sm">
                    <div className="text-center">
                      <div className="text-gray-500">总排练</div>
                      <div className="font-medium">{program.total_rehearsals}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-green-600">正常</div>
                      <div className="font-medium">{program.normal_count}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-yellow-600">迟到</div>
                      <div className="font-medium">{program.late_count}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-red-600">缺勤</div>
                      <div className="font-medium">{program.absent_count}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-blue-600">请假</div>
                      <div className="font-medium">{program.leave_count}</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        program.attendance_rate >= 90
                          ? 'bg-green-500'
                          : program.attendance_rate >= 70
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${program.attendance_rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tips */}
      {stats && stats.attendance_rate < 90 && (
        <div className="card bg-yellow-50 border-yellow-200">
          <div className="card-body flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800">出勤率提醒</h3>
              <p className="text-sm text-yellow-700 mt-1">
                您当前的出勤率为 {stats.attendance_rate}%，建议保持在 90% 以上。
                如有特殊情况请提前请假。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
