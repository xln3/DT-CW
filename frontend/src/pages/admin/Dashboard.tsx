import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, ArrowRight, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi, memberPortalApi } from '../../services/api';
import type { ManagedProgramAttendance, RehearsalSlotDTO } from '../../services/api';
import {
  AttendanceTimeline,
  AttendanceLegend,
  PersonalProgramRow,
  type AttendanceMode,
} from '../../components/AttendanceTimeline';

// --- Personal Attendance (compact, top of dashboard) ---

interface PersonalProgramData {
  program_id: number;
  program_name: string;
  attendance_mode: AttendanceMode;
  rehearsals: RehearsalSlotDTO[];
  completed_total: number;
  attendance: Record<string, string>;
  attended_count: number;
}

interface PersonalAttendanceData {
  programs: PersonalProgramData[];
}

function PersonalAttendanceCard({ data }: { data: PersonalAttendanceData }) {
  if (data.programs.length === 0) {
    return <p className="text-gray-500 text-center py-4">本学期暂无考勤数据</p>;
  }
  return (
    <div className="space-y-3">
      {data.programs.map((prog) => (
        <PersonalProgramRow
          key={prog.program_id}
          programName={prog.program_name}
          mode={prog.attendance_mode}
          rehearsals={prog.rehearsals}
          attendance={prog.attendance}
        />
      ))}
    </div>
  );
}

// --- Managed-programs attendance (per-member timeline grid) ---

function ManagedProgramCard({ program }: { program: ManagedProgramAttendance }) {
  const isCumulative = program.attendance_mode === 'cumulative';
  return (
    <div className={`card ${isCumulative ? 'border-purple-200' : ''}`}>
      <div className="card-header flex items-center justify-between gap-2">
        <h3 className="font-medium text-gray-900 truncate">{program.program_name}</h3>
        <div className="flex items-center text-xs text-gray-500 flex-shrink-0">
          <Users className="w-3.5 h-3.5 mr-1" />
          {program.member_count} 人
          <span className="mx-2 text-gray-300">·</span>
          已完成 {program.completed_total} / 共 {program.rehearsals.length} 次
          <Link
            to={`/admin/programs/${program.program_id}`}
            className="ml-3 text-primary-600 hover:text-primary-700 flex items-center"
          >
            详情<ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </Link>
        </div>
      </div>
      <div className="card-body p-3">
        <AttendanceTimeline
          rehearsals={program.rehearsals}
          members={program.members}
          mode={program.attendance_mode}
        />
      </div>
    </div>
  );
}

// --- Main Dashboard ---

export default function Dashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  const [personalData, setPersonalData] = useState<PersonalAttendanceData | null>(null);
  const [managedPrograms, setManagedPrograms] = useState<ManagedProgramAttendance[]>([]);

  const hasMemberId = !!user?.member_id;
  // Admin / committee / program_manager all see the per-member timeline
  // breakdown. Members never reach this page (they go to /member).
  const canManagePrograms = !!user
    && (user.role === 'admin' || user.role === 'committee' || user.role === 'program_manager');

  // Pick a section heading appropriate for the user's role. For admin /
  // committee without a linked member this is the only block on the page,
  // so the heading carries more weight.
  const managedHeading =
    user?.role === 'program_manager' ? '我负责的剧目'
    : hasMemberId ? '剧目考勤明细'
    : '全队考勤';

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const tasks: Promise<unknown>[] = [];

        if (hasMemberId) {
          tasks.push(memberPortalApi.getMyAttendance().then((d) => setPersonalData(d)));
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

      {/* Personal attendance — only when the user is also a member. */}
      {hasMemberId && personalData && (
        <div className="card">
          <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center">
              <ClipboardCheck className="w-5 h-5 mr-2 text-gray-400" />
              <h2 className="text-lg font-medium text-gray-900">我的考勤</h2>
            </div>
            <AttendanceLegend />
          </div>
          <div className="card-body">
            <PersonalAttendanceCard data={personalData} />
          </div>
        </div>
      )}

      {/* Per-program member attendance breakdown (timeline grid). */}
      {canManagePrograms && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-lg font-medium text-gray-900">{managedHeading}</h2>
            <AttendanceLegend />
          </div>
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
