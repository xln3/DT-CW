import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  Clock,
  X,
  ClipboardCheck,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { memberPortalApi, publicApi, rehearsalsApi, semestersApi } from '../../services/api';
import type { Semester, Rehearsal } from '../../types';
import { DAY_NAMES } from '../../types';

// --- Helpers ---

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayStr(): string {
  return toDateStr(new Date());
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function getMondayStr(date: Date): string {
  return toDateStr(getMonday(date));
}

function dateFromStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getWeeksInRange(startDate: string, endDate: string): string[][] {
  const weeks: string[][] = [];
  const [ey, em, ed] = endDate.split('-').map(Number);
  const end = new Date(ey, em - 1, ed);
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const monday = getMonday(new Date(sy, sm - 1, sd));

  while (monday <= end) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(monday);
      dt.setDate(dt.getDate() + i);
      week.push(toDateStr(dt));
    }
    weeks.push(week);
    monday.setDate(monday.getDate() + 7);
  }
  return weeks;
}

function shortTime(time: string): string {
  return time.slice(0, 5);
}

// --- Attendance Overview Component ---

interface ProgramAttendance {
  program_id: number;
  program_name: string;
  total_rehearsals: number;
  normal_count: number;
  late_count: number;
  early_leave_count: number;
  absent_count: number;
  leave_count: number;
  attendance_rate: number;
}

interface PersonalAttendanceData {
  programs: ProgramAttendance[];
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

function getRateColor(rate: number) {
  if (rate >= 90) return 'text-green-600';
  if (rate >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

function PersonalAttendanceCard({ data }: { data: PersonalAttendanceData }) {
  const stats = data.overall_stats;

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card">
          <div className="card-body py-3 text-center">
            <div className={`text-2xl font-bold ${getRateColor(stats.attendance_rate)}`}>
              {stats.attendance_rate}%
            </div>
            <div className="text-xs text-gray-500 mt-1">总出勤率</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body py-3 text-center">
            <div className="flex items-center justify-center">
              <Check className="w-4 h-4 text-green-600 mr-1" />
              <span className="text-xl font-bold text-gray-900">{stats.normal_count}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">正常</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body py-3 text-center">
            <div className="flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-600 mr-1" />
              <span className="text-xl font-bold text-gray-900">{stats.late_count + (stats.early_leave_count || 0)}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">迟到/早退</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body py-3 text-center">
            <div className="flex items-center justify-center">
              <X className="w-4 h-4 text-red-600 mr-1" />
              <span className="text-xl font-bold text-gray-900">{stats.absent_count}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">缺勤</div>
          </div>
        </div>
      </div>

      {/* Program breakdown */}
      {data.programs.length > 0 && (
        <div className="space-y-2">
          {data.programs.map((prog) => (
            <div key={prog.program_id} className="flex items-center gap-3">
              <span className="text-sm text-gray-700 w-24 truncate flex-shrink-0">{prog.program_name}</span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    prog.attendance_rate >= 90 ? 'bg-green-500' : prog.attendance_rate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${prog.attendance_rate}%` }}
                />
              </div>
              <span className={`text-sm font-medium w-12 text-right ${getRateColor(prog.attendance_rate)}`}>
                {prog.attendance_rate}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Team Overview Component ---

interface TeamProgramOverview {
  id: number;
  name: string;
  member_count: number;
  rehearsal_count: number;
  counted_rehearsal_count: number;
  attendance_rate: number;
}

function TeamAttendanceCard({ programs }: { programs: TeamProgramOverview[] }) {
  if (programs.length === 0) {
    return <p className="text-gray-500 text-center py-4">暂无节目数据</p>;
  }

  return (
    <div className="space-y-2">
      {programs.map((prog) => (
        <div key={prog.id} className="flex items-center gap-3">
          <span className="text-sm text-gray-700 w-24 truncate flex-shrink-0">{prog.name}</span>
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                prog.attendance_rate >= 90 ? 'bg-green-500' : prog.attendance_rate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${prog.attendance_rate}%` }}
            />
          </div>
          <span className={`text-sm font-medium w-12 text-right ${getRateColor(prog.attendance_rate)}`}>
            {prog.attendance_rate}%
          </span>
          <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">
            {prog.counted_rehearsal_count}次排练
          </span>
        </div>
      ))}
    </div>
  );
}

// --- Semester Schedule Grid ---

interface SemesterScheduleProps {
  semester: Semester;
  rehearsals: Rehearsal[];
}

function SemesterScheduleGrid({ semester, rehearsals }: SemesterScheduleProps) {
  const today = todayStr();
  const weeks = useMemo(
    () => getWeeksInRange(semester.start_date, semester.end_date),
    [semester.start_date, semester.end_date],
  );

  const rehearsalsByDate = useMemo(() => {
    const map: Record<string, Rehearsal[]> = {};
    for (const r of rehearsals) {
      if (r.status === 'cancelled') continue;
      const d = r.scheduled_date;
      if (!map[d]) map[d] = [];
      map[d].push(r);
    }
    return map;
  }, [rehearsals]);

  const semStart = semester.start_date;
  const semEnd = semester.end_date;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="p-1.5 text-center border-b w-8 text-gray-400 font-medium">周</th>
            {DAY_NAMES.map((name) => (
              <th key={name} className="p-1.5 text-center border-b text-gray-700 font-medium">{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi} className="border-b last:border-b-0">
              <td className="p-1 text-center text-gray-400 border-r text-[10px]">{wi + 1}</td>
              {week.map((dateStr) => {
                const isToday = dateStr === today;
                const inSemester = dateStr >= semStart && dateStr <= semEnd;
                const d = dateFromStr(dateStr);
                const dayRehearsals = rehearsalsByDate[dateStr] || [];

                return (
                  <td
                    key={dateStr}
                    className={`p-1 border-r last:border-r-0 align-top ${
                      !inSemester ? 'bg-gray-50/80' : ''
                    } ${isToday ? 'bg-primary-50' : ''}`}
                    style={{ minWidth: '70px' }}
                  >
                    <div className={`text-[10px] font-medium ${
                      !inSemester ? 'text-gray-300' : isToday ? 'text-primary-600' : 'text-gray-600'
                    }`}>
                      {d.getMonth() + 1}/{d.getDate()}
                    </div>
                    {inSemester && dayRehearsals.map((r) => (
                      <div
                        key={r.id}
                        className="mt-0.5 text-[9px] rounded px-0.5 truncate text-white"
                        style={{ backgroundColor: r.program_color || '#6B7280' }}
                        title={`${r.program_name} ${r.scheduled_start_time ? shortTime(r.scheduled_start_time) : ''}`}
                      >
                        {r.program_name!.slice(0, 4)}
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Main Dashboard ---

export default function Dashboard() {
  const { user } = useAuth();

  const [semester, setSemester] = useState<Semester | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Attendance data
  const [personalData, setPersonalData] = useState<PersonalAttendanceData | null>(null);
  const [teamPrograms, setTeamPrograms] = useState<TeamProgramOverview[]>([]);
  const hasMemberId = !!user?.member_id;

  // Semester schedule data
  const [semRehearsals, setSemRehearsals] = useState<Rehearsal[]>([]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const sem = await semestersApi.getCurrent();
        setSemester(sem);

        // Fetch attendance data
        if (hasMemberId) {
          const data = await memberPortalApi.getMyAttendance(sem?.id);
          setPersonalData(data);
        } else {
          const data = await publicApi.getAttendanceOverview(sem?.id);
          setTeamPrograms(data.programs || []);
        }

        // Fetch semester rehearsals for the grid
        if (sem) {
          const startDate = getMondayStr(dateFromStr(sem.start_date));
          const semEnd = dateFromStr(sem.end_date);
          const lastMonday = getMonday(semEnd);
          lastMonday.setDate(lastMonday.getDate() + 6);
          const endDate = toDateStr(lastMonday);

          const rehs = await rehearsalsApi.list({
            date_from: startDate,
            date_to: endDate,
          });
          setSemRehearsals(rehs);
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [hasMemberId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
          <p className="mt-1 text-sm text-gray-500">欢迎回来，{user?.display_name}！</p>
        </div>
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
        <p className="mt-1 text-sm text-gray-500">欢迎回来，{user?.display_name}！</p>
      </div>

      {/* Attendance Overview */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center">
            <ClipboardCheck className="w-5 h-5 mr-2 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900">
              {hasMemberId ? '我的考勤' : '全队考勤概览'}
            </h2>
          </div>
          <Link
            to="/attendance"
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
          >
            详情
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
        <div className="card-body">
          {hasMemberId && personalData ? (
            <PersonalAttendanceCard data={personalData} />
          ) : (
            <TeamAttendanceCard programs={teamPrograms} />
          )}
        </div>
      </div>

      {/* Semester Schedule Grid */}
      {semester && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              {semester.name} 排练总览
            </h2>
            <Link
              to="/admin/schedule"
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
            >
              查看详情
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="card-body p-0">
            <SemesterScheduleGrid
              semester={semester}
              rehearsals={semRehearsals}
            />
          </div>
        </div>
      )}
    </div>
  );
}
