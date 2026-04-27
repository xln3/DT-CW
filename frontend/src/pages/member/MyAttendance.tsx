import { useState, useEffect } from 'react';
import { ClipboardCheck, Sparkles } from 'lucide-react';
import { memberPortalApi } from '../../services/api';
import type { Semester } from '../../types';

interface ProgramAttendance {
  program_id: number;
  program_name: string;
  attendance_mode: 'rate' | 'cumulative';
  total_rehearsals: number;
  normal_count: number;
  late_count: number;
  early_leave_count: number;
  absent_count: number;
  leave_count: number;
  attended_count: number;
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
        const semesterList = await memberPortalApi.listSemesters();
        setSemesters(semesterList);
        const current = semesterList.find((s) => s.is_current);
        if (current) {
          setSelectedSemester(current.id);
        } else if (semesterList.length > 0) {
          // No current semester flagged — fall back to the most recent.
          setSelectedSemester(semesterList[0].id);
        } else {
          // Empty list: nothing to query, end loading.
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch semesters:', err);
        setIsLoading(false);
      }
    };

    fetchSemesters();
  }, []);

  useEffect(() => {
    // Wait until we know which semester to query so we don't fire two
    // fetches (one with undefined, then one when the current semester is
    // resolved). The double-fetch caused the page to flash a spinner mid-load
    // and screenshot tooling kept catching the spinner state.
    if (selectedSemester === undefined) return;

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

  const programs = data?.programs ?? [];

  return (
    <div className="space-y-6" data-testid="my-attendance-loaded">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">我的考勤</h1>
          <p className="mt-1 text-sm text-gray-500">按节目分别统计</p>
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

      {programs.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <ClipboardCheck className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">本学期暂无考勤记录</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {programs.map((program) =>
            program.attendance_mode === 'cumulative' ? (
              <CumulativeCard key={program.program_id} program={program} />
            ) : (
              <RateCard
                key={program.program_id}
                program={program}
                rateColor={getRateColor(program.attendance_rate)}
                rateBg={getRateBg(program.attendance_rate)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function CumulativeCard({ program }: { program: ProgramAttendance }) {
  return (
    <div className="p-4 border border-purple-200 bg-purple-50 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900 flex items-center">
          <Sparkles className="w-4 h-4 text-purple-500 mr-1.5" />
          {program.program_name}
        </h3>
        <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">
          累计参加
        </span>
      </div>
      <div className="flex items-baseline">
        <span className="text-4xl font-bold text-purple-700">{program.attended_count}</span>
        <span className="ml-2 text-sm text-gray-600">次（共 {program.total_rehearsals} 次）</span>
      </div>
      <p className="mt-2 text-xs text-gray-600">
        {program.attended_count > 0
          ? '坚持得很好，继续加油！'
          : '欢迎随时来参加'}
      </p>
    </div>
  );
}

function RateCard({
  program,
  rateColor,
  rateBg,
}: {
  program: ProgramAttendance;
  rateColor: string;
  rateBg: string;
}) {
  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">{program.program_name}</h3>
        <span className={`px-2 py-1 rounded text-sm font-medium ${rateBg} ${rateColor}`}>
          {program.attendance_rate}%
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-sm">
        <div className="text-center">
          <div className="text-gray-500">总排练</div>
          <div className="font-medium">{program.total_rehearsals}</div>
        </div>
        <div className="text-center">
          <div className="text-green-600">正常</div>
          <div className="font-medium">{program.normal_count}</div>
        </div>
        <div className="text-center">
          <div className="text-yellow-600">迟到/早退</div>
          <div className="font-medium">{program.late_count + (program.early_leave_count || 0)}</div>
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
  );
}
