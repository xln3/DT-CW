import { useState, useEffect } from 'react';
import { ClipboardCheck, Sparkles } from 'lucide-react';
import { memberPortalApi } from '../../services/api';
import type { RehearsalSlotDTO } from '../../services/api';
import type { Semester } from '../../types';
import {
  AttendanceCell,
  AttendanceLegend,
  SummaryInline,
  countAttendanceFromStatusMap,
  type AttendanceMode,
} from '../../components/AttendanceTimeline';

interface ProgramAttendance {
  program_id: number;
  program_name: string;
  attendance_mode: AttendanceMode;
  rehearsals: RehearsalSlotDTO[];
  completed_total: number;
  attendance: Record<string, string>;
  attended_count: number;
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
          setSelectedSemester(semesterList[0].id);
        } else {
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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
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

      {programs.length > 0 && <AttendanceLegend />}

      {programs.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <ClipboardCheck className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">本学期暂无考勤记录</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {programs.map((program) => (
            <ProgramTimelineCard key={program.program_id} program={program} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProgramTimelineCard({ program }: { program: ProgramAttendance }) {
  const isCumulative = program.attendance_mode === 'cumulative';
  const counts = countAttendanceFromStatusMap(program.attendance, program.rehearsals);

  return (
    <div className={`p-4 rounded-lg border ${isCumulative ? 'border-purple-200 bg-purple-50/40' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="font-medium text-gray-900 flex items-center min-w-0 truncate">
          {isCumulative && <Sparkles className="w-4 h-4 text-purple-500 mr-1.5 flex-shrink-0" />}
          <span className="truncate">{program.program_name}</span>
        </h3>
        <SummaryInline mode={program.attendance_mode} counts={counts} />
      </div>

      {program.rehearsals.length === 0 ? (
        <p className="text-sm text-gray-500">本学期暂无排练</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="inline-flex flex-col gap-1 min-w-full">
            <div className="flex gap-1">
              {program.rehearsals.map((r) => {
                const [, m, d] = r.date.split('-');
                return (
                  <div
                    key={r.id}
                    className={`w-6 text-[10px] text-center ${
                      r.is_completed ? 'text-gray-500' : 'text-gray-300'
                    }`}
                    title={`${r.date}${r.start_time ? ' ' + r.start_time : ''}`}
                  >
                    {parseInt(m, 10)}/{parseInt(d, 10)}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1">
              {program.rehearsals.map((r) => (
                <AttendanceCell
                  key={r.id}
                  cell={program.attendance[String(r.id)]}
                  rehearsal={r}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {isCumulative && (
        <p className="mt-3 text-xs text-gray-600">
          {counts.attended > 0 ? '坚持得很好，继续加油！' : '欢迎随时来参加'}
        </p>
      )}
    </div>
  );
}
