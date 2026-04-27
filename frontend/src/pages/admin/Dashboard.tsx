import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, ArrowRight, Crown, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi, memberPortalApi, publicApi } from '../../services/api';
import type { ManagedProgramAttendance } from '../../services/api';

// --- Personal Attendance (compact, top of dashboard) ---

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

interface PersonalAttendanceData {
  programs: ProgramAttendance[];
}

function getRateColor(rate: number) {
  if (rate >= 90) return 'text-green-600';
  if (rate >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

function getRateBarColor(rate: number) {
  if (rate >= 90) return 'bg-green-500';
  if (rate >= 70) return 'bg-yellow-500';
  return 'bg-red-500';
}

function PersonalAttendanceCard({ data }: { data: PersonalAttendanceData }) {
  if (data.programs.length === 0) {
    return <p className="text-gray-500 text-center py-4">本学期暂无考勤数据</p>;
  }
  return (
    <div className="space-y-2">
      {data.programs.map((prog) => (
        <div key={prog.program_id} className="flex items-center gap-3">
          <span className="text-sm text-gray-700 w-24 truncate flex-shrink-0">{prog.program_name}</span>
          {prog.attendance_mode === 'cumulative' ? (
            <span className="flex-1 text-sm text-purple-700">
              已累计参加 <span className="font-semibold">{prog.attended_count}</span> 次
              <span className="text-gray-400"> / 共 {prog.total_rehearsals} 次</span>
            </span>
          ) : (
            <>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full ${getRateBarColor(prog.attendance_rate)}`} style={{ width: `${prog.attendance_rate}%` }} />
              </div>
              <span className={`text-sm font-medium w-12 text-right ${getRateColor(prog.attendance_rate)}`}>
                {prog.attendance_rate}%
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Team Overview (admin without member_id) ---

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
            <div className={`h-full ${getRateBarColor(prog.attendance_rate)}`} style={{ width: `${prog.attendance_rate}%` }} />
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

// --- Managed-programs attendance breakdown ---

function ManagedProgramCard({ program }: { program: ManagedProgramAttendance }) {
  const isCumulative = program.attendance_mode === 'cumulative';

  return (
    <div className={`card ${isCumulative ? 'border-purple-200' : ''}`}>
      <div className="card-header flex items-center justify-between gap-2">
        <div className="flex items-center min-w-0">
          {isCumulative && <Sparkles className="w-4 h-4 text-purple-500 mr-1.5 flex-shrink-0" />}
          <h3 className="font-medium text-gray-900 truncate">{program.program_name}</h3>
        </div>
        <div className="flex items-center text-xs text-gray-500 flex-shrink-0">
          <Users className="w-3.5 h-3.5 mr-1" />
          {program.member_count} 人
          <span className="mx-2 text-gray-300">·</span>
          {program.total_rehearsals} 次{isCumulative ? '训练' : '排练'}
          <Link
            to={`/admin/programs/${program.program_id}`}
            className="ml-3 text-primary-600 hover:text-primary-700 flex items-center"
          >
            详情<ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </Link>
        </div>
      </div>
      <div className="card-body p-0">
        {program.members.length === 0 ? (
          <p className="text-gray-500 text-center py-6 text-sm">暂无成员</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">成员</th>
                  {isCumulative ? (
                    <th className="px-3 py-2 text-right font-medium">累计参加</th>
                  ) : (
                    <th className="px-3 py-2 text-right font-medium">出勤率</th>
                  )}
                  <th className="px-3 py-2 text-right font-medium hidden sm:table-cell">正常</th>
                  <th className="px-3 py-2 text-right font-medium hidden sm:table-cell">迟到/早退</th>
                  <th className="px-3 py-2 text-right font-medium hidden sm:table-cell">缺勤</th>
                  <th className="px-3 py-2 text-right font-medium hidden md:table-cell">请假</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {program.members.map((m) => (
                  <tr key={m.member_id}>
                    <td className="px-3 py-2 text-gray-900">
                      <span className="inline-flex items-center">
                        {m.is_leader && <Crown className="w-3.5 h-3.5 text-amber-500 mr-1" />}
                        {m.member_name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isCumulative ? (
                        <span className="text-purple-700 font-medium">
                          {m.attended_count}
                          <span className="text-gray-400 font-normal"> / {m.total_rehearsals}</span>
                        </span>
                      ) : (
                        <span className={`font-medium ${getRateColor(m.attendance_rate)}`}>
                          {m.attendance_rate}%
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-green-700 hidden sm:table-cell">{m.normal_count}</td>
                    <td className="px-3 py-2 text-right text-yellow-700 hidden sm:table-cell">
                      {m.late_count + m.early_leave_count}
                    </td>
                    <td className="px-3 py-2 text-right text-red-700 hidden sm:table-cell">{m.absent_count}</td>
                    <td className="px-3 py-2 text-right text-blue-700 hidden md:table-cell">{m.leave_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Dashboard ---

export default function Dashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  const [personalData, setPersonalData] = useState<PersonalAttendanceData | null>(null);
  const [teamPrograms, setTeamPrograms] = useState<TeamProgramOverview[]>([]);
  const [managedPrograms, setManagedPrograms] = useState<ManagedProgramAttendance[]>([]);

  const hasMemberId = !!user?.member_id;
  // Anyone with admin-side access (admin / committee / program_manager) sees
  // the per-member breakdown of programs they can manage. Members never reach
  // this page (they're routed to /member).
  const canManagePrograms = !!user
    && (user.role === 'admin' || user.role === 'committee' || user.role === 'program_manager');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const tasks: Promise<unknown>[] = [];

        if (hasMemberId) {
          tasks.push(memberPortalApi.getMyAttendance().then((d) => setPersonalData(d)));
        } else {
          tasks.push(publicApi.getAttendanceOverview().then((d) => setTeamPrograms(d.programs || [])));
        }

        if (canManagePrograms) {
          tasks.push(
            dashboardApi.getManagedProgramsAttendance().then((d) => setManagedPrograms(d.programs)),
          );
        }

        await Promise.all(tasks);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [hasMemberId, canManagePrograms]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
          <p className="mt-1 text-sm text-gray-500">欢迎回来,{user?.display_name}!</p>
        </div>
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-loaded">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
        <p className="mt-1 text-sm text-gray-500">欢迎回来,{user?.display_name}!</p>
      </div>

      {/* Personal / team attendance summary */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center">
            <ClipboardCheck className="w-5 h-5 mr-2 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900">
              {hasMemberId ? '我的考勤' : '全队考勤概览'}
            </h2>
          </div>
          <Link to="/attendance" className="text-sm text-primary-600 hover:text-primary-700 flex items-center">
            详情<ArrowRight className="w-4 h-4 ml-1" />
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

      {/* Per-program member attendance breakdown */}
      {canManagePrograms && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900">
            {user?.role === 'program_manager' ? '我负责的剧目' : '剧目考勤明细'}
          </h2>
          {managedPrograms.length === 0 ? (
            <div className="card">
              <div className="card-body text-center py-8 text-gray-500">
                {user?.role === 'program_manager' ? '尚未分配负责的剧目' : '本学期暂无活跃剧目'}
              </div>
            </div>
          ) : (
            managedPrograms.map((p) => <ManagedProgramCard key={p.program_id} program={p} />)
          )}
        </div>
      )}
    </div>
  );
}
