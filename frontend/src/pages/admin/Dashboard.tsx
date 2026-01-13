import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  Music,
  Calendar,
  TrendingUp,
  Plus,
  Clock,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi } from '../../services/api';

interface DashboardStats {
  member_count: number;
  teacher_count: number;
  program_count: number;
  week_rehearsal_count: number;
}

interface UpcomingRehearsal {
  id: number;
  program_name: string;
  date: string;
  start_time: string | null;
  location: string | null;
}

interface RecentProgram {
  id: number;
  name: string;
  category: string;
  member_count: number;
  rehearsal_count: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingRehearsals, setUpcomingRehearsals] = useState<UpcomingRehearsal[]>([]);
  const [recentPrograms, setRecentPrograms] = useState<RecentProgram[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await dashboardApi.getStats();
      setStats(data.stats);
      setUpcomingRehearsals(data.upcoming_rehearsals);
      setRecentPrograms(data.recent_programs);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    {
      name: '队员总数',
      value: stats?.member_count ?? '--',
      icon: <Users className="w-6 h-6" />,
      link: '/admin/members',
      color: 'bg-blue-500',
    },
    {
      name: '教师总数',
      value: stats?.teacher_count ?? '--',
      icon: <UserCheck className="w-6 h-6" />,
      link: '/admin/teachers',
      color: 'bg-green-500',
    },
    {
      name: '进行中节目',
      value: stats?.program_count ?? '--',
      icon: <Music className="w-6 h-6" />,
      link: '/admin/programs',
      color: 'bg-purple-500',
    },
    {
      name: '本周排练',
      value: stats?.week_rehearsal_count ?? '--',
      icon: <Calendar className="w-6 h-6" />,
      link: '/admin/rehearsals',
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
          <p className="mt-1 text-sm text-gray-500">
            欢迎回来，{user?.display_name}！
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link
            key={stat.name}
            to={stat.link}
            className="card hover:shadow-md transition-shadow"
          >
            <div className="card-body">
              <div className="flex items-center">
                <div className={`${stat.color} p-3 rounded-lg text-white`}>
                  {stat.icon}
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {isLoading ? (
                      <span className="animate-pulse">--</span>
                    ) : (
                      stat.value
                    )}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Rehearsals */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">近期排练</h2>
            <Link
              to="/admin/rehearsals/new"
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              安排排练
            </Link>
          </div>
          <div className="card-body">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : upcomingRehearsals.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暂无近期排练安排</p>
            ) : (
              <div className="space-y-3">
                {upcomingRehearsals.map((rehearsal) => (
                  <Link
                    key={rehearsal.id}
                    to={`/admin/rehearsals/${rehearsal.id}`}
                    className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <p className="font-medium text-gray-900">
                      {rehearsal.program_name}
                    </p>
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {rehearsal.date}
                      </span>
                      {rehearsal.start_time && (
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {rehearsal.start_time}
                        </span>
                      )}
                      {rehearsal.location && (
                        <span className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {rehearsal.location}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Programs */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">活跃节目</h2>
            <Link
              to="/admin/programs/new"
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              创建节目
            </Link>
          </div>
          <div className="card-body">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : recentPrograms.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暂无活跃节目</p>
            ) : (
              <div className="space-y-3">
                {recentPrograms.map((program) => (
                  <Link
                    key={program.id}
                    to={`/admin/programs/${program.id}`}
                    className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900">{program.name}</p>
                      {program.category && (
                        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded">
                          {program.category}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        {program.member_count} 人
                      </span>
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {program.rehearsal_count} 次排练
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium text-gray-900">快捷操作</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              to="/admin/members/new"
              className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Users className="w-8 h-8 text-blue-500" />
              <span className="ml-3 font-medium text-gray-700">添加队员</span>
            </Link>
            <Link
              to="/admin/programs/new"
              className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Music className="w-8 h-8 text-purple-500" />
              <span className="ml-3 font-medium text-gray-700">创建节目</span>
            </Link>
            <Link
              to="/admin/rehearsals/new"
              className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Calendar className="w-8 h-8 text-orange-500" />
              <span className="ml-3 font-medium text-gray-700">安排排练</span>
            </Link>
            <Link
              to="/attendance"
              className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <TrendingUp className="w-8 h-8 text-green-500" />
              <span className="ml-3 font-medium text-gray-700">查看考勤</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
