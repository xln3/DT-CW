import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Music, User, Clock, MapPin, ClipboardCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { memberPortalApi } from '../../services/api';

interface Rehearsal {
  id: number;
  program_id: number;
  program_name: string;
  program_color: string | null;
  scheduled_date: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  location: string | null;
}

interface Program {
  id: number;
  name: string;
  category: string;
  display_color: string | null;
  is_leader: boolean;
  member_count: number;
  rehearsal_count: number;
}

export default function MemberDashboard() {
  const { user } = useAuth();
  const [upcomingRehearsals, setUpcomingRehearsals] = useState<Rehearsal[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [rehearsalsData, programsData] = await Promise.all([
          memberPortalApi.getMyRehearsals({ days: 14, limit: 5 }),
          memberPortalApi.getMyPrograms(),
        ]);

        setUpcomingRehearsals(rehearsalsData.rehearsals);
        setPrograms(programsData.programs);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
  };

  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          欢迎回来，{user?.display_name || user?.username}
        </h1>
        <p className="mt-1 text-sm text-gray-500">查看排练安排和节目信息</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Rehearsals */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-primary-600" />
              <h2 className="text-lg font-medium text-gray-900">近期排练</h2>
            </div>
          </div>
          <div className="card-body">
            {upcomingRehearsals.length === 0 ? (
              <p className="text-gray-500 text-sm">暂无近期排练安排</p>
            ) : (
              <div className="space-y-3">
                {upcomingRehearsals.map((rehearsal) => (
                  <div key={rehearsal.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: rehearsal.program_color || '#3498DB' }}
                        />
                        <h4 className="font-medium text-gray-900">{rehearsal.program_name}</h4>
                      </div>
                      <span className="text-sm text-gray-500">{formatDate(rehearsal.scheduled_date)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
                      {rehearsal.scheduled_start_time && (
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatTime(rehearsal.scheduled_start_time)}
                          {rehearsal.scheduled_end_time && ` - ${formatTime(rehearsal.scheduled_end_time)}`}
                        </div>
                      )}
                      {rehearsal.location && (
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {rehearsal.location}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* My Programs */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center">
              <Music className="w-5 h-5 mr-2 text-primary-600" />
              <h2 className="text-lg font-medium text-gray-900">我的节目</h2>
            </div>
            <Link to="/member/programs" className="text-sm text-primary-600 hover:text-primary-700">
              查看全部
            </Link>
          </div>
          <div className="card-body">
            {programs.length === 0 ? (
              <p className="text-gray-500 text-sm">暂未参与任何节目</p>
            ) : (
              <div className="space-y-2">
                {programs.slice(0, 5).map((program) => (
                  <Link
                    key={program.id}
                    to={`/member/programs/${program.id}`}
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                  >
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-3"
                        style={{ backgroundColor: program.display_color || '#3498DB' }}
                      />
                      <span className="text-gray-900">{program.name}</span>
                      {program.is_leader && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                          节目负责人
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">{program.member_count} 人</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium text-gray-900">快捷入口</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Link
              to="/member/programs"
              className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Music className="w-8 h-8 text-primary-600 mb-2" />
              <span className="text-sm text-gray-700">节目信息</span>
            </Link>
            <Link
              to="/member/attendance"
              className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ClipboardCheck className="w-8 h-8 text-primary-600 mb-2" />
              <span className="text-sm text-gray-700">我的考勤</span>
            </Link>
            <Link
              to="/member/profile"
              className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <User className="w-8 h-8 text-primary-600 mb-2" />
              <span className="text-sm text-gray-700">个人设置</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
