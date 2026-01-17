import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Music, User, Clock, MapPin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { rehearsalsApi, programsApi } from '../../services/api';
import type { Rehearsal, Program } from '../../types';

export default function MemberHome() {
  const { user } = useAuth();
  const [upcomingRehearsals, setUpcomingRehearsals] = useState<Rehearsal[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Get upcoming rehearsals (next 2 weeks)
        const today = new Date();
        const twoWeeksLater = new Date();
        twoWeeksLater.setDate(today.getDate() + 14);

        const [rehearsalsData, programsData] = await Promise.all([
          rehearsalsApi.list({
            date_from: today.toISOString().split('T')[0],
            date_to: twoWeeksLater.toISOString().split('T')[0],
          }),
          programsApi.list({ status: 'active' }),
        ]);

        setUpcomingRehearsals(rehearsalsData.slice(0, 5));
        setPrograms(programsData);
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

  const formatTime = (timeStr?: string) => {
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
            <Link to="/admin/rehearsals" className="text-sm text-primary-600 hover:text-primary-700">
              查看全部
            </Link>
          </div>
          <div className="card-body">
            {upcomingRehearsals.length === 0 ? (
              <p className="text-gray-500 text-sm">暂无近期排练安排</p>
            ) : (
              <div className="space-y-3">
                {upcomingRehearsals.map((rehearsal) => (
                  <div key={rehearsal.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">{rehearsal.program_name}</h4>
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

        {/* Programs */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center">
              <Music className="w-5 h-5 mr-2 text-primary-600" />
              <h2 className="text-lg font-medium text-gray-900">节目列表</h2>
            </div>
            <Link to="/admin/programs" className="text-sm text-primary-600 hover:text-primary-700">
              查看全部
            </Link>
          </div>
          <div className="card-body">
            {programs.length === 0 ? (
              <p className="text-gray-500 text-sm">暂无节目</p>
            ) : (
              <div className="space-y-2">
                {programs.slice(0, 5).map((program) => (
                  <Link
                    key={program.id}
                    to={`/admin/programs/${program.id}`}
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                  >
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-3"
                        style={{ backgroundColor: program.display_color || '#3498DB' }}
                      />
                      <span className="text-gray-900">{program.name}</span>
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
              to="/admin/rehearsals"
              className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Calendar className="w-8 h-8 text-primary-600 mb-2" />
              <span className="text-sm text-gray-700">排练安排</span>
            </Link>
            <Link
              to="/admin/programs"
              className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Music className="w-8 h-8 text-primary-600 mb-2" />
              <span className="text-sm text-gray-700">节目信息</span>
            </Link>
            <Link
              to="/admin/settings/profile"
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
