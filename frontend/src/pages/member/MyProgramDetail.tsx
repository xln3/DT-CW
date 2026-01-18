import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Calendar, Clock, MapPin, Star, CheckCircle } from 'lucide-react';
import { memberPortalApi } from '../../services/api';

interface ProgramMember {
  id: number;
  name: string;
  is_leader: boolean;
}

interface Rehearsal {
  id: number;
  scheduled_date: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  location: string | null;
  status: string;
  is_completed: boolean;
}

interface ProgramDetail {
  program: {
    id: number;
    name: string;
    category: string;
    display_color: string | null;
    description: string | null;
  };
  is_leader: boolean;
  members: ProgramMember[];
  rehearsals: Rehearsal[];
}

export default function MyProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ProgramDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDetail = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const result = await memberPortalApi.getMyProgramDetail(Number(id));
        setData(result);
      } catch (err) {
        console.error('Failed to fetch program detail:', err);
        const error = err as { response?: { data?: { error?: string } } };
        setError(error.response?.data?.error || '加载失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

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

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error || '节目不存在'}</p>
        <button
          onClick={() => navigate('/member/programs')}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          返回节目列表
        </button>
      </div>
    );
  }

  const { program, is_leader, members, rehearsals } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/member/programs')}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center">
          <div
            className="w-4 h-4 rounded-full mr-3"
            style={{ backgroundColor: program.display_color || '#3498DB' }}
          />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{program.name}</h1>
            <div className="flex items-center mt-1">
              {program.category && (
                <span className="text-sm text-gray-500 mr-2">{program.category}</span>
              )}
              {is_leader && (
                <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                  节目负责人
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {program.description && (
        <div className="card">
          <div className="card-body">
            <p className="text-gray-700 whitespace-pre-wrap">{program.description}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members */}
        <div className="card">
          <div className="card-header flex items-center">
            <Users className="w-5 h-5 mr-2 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900">成员列表</h2>
            <span className="ml-2 text-sm text-gray-500">({members.length} 人)</span>
          </div>
          <div className="card-body">
            {members.length === 0 ? (
              <p className="text-gray-500 text-sm">暂无成员</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {members.map((member) => (
                  <div key={member.id} className="py-2 flex items-center justify-between">
                    <span className="text-gray-900">{member.name}</span>
                    {member.is_leader && (
                      <span className="flex items-center text-xs text-yellow-600">
                        <Star className="w-3 h-3 mr-1" />
                        负责人
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rehearsals */}
        <div className="card">
          <div className="card-header flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900">排练记录</h2>
          </div>
          <div className="card-body">
            {rehearsals.length === 0 ? (
              <p className="text-gray-500 text-sm">暂无排练记录</p>
            ) : (
              <div className="space-y-3">
                {rehearsals.map((rehearsal) => (
                  <div
                    key={rehearsal.id}
                    className={`p-3 rounded-lg ${
                      rehearsal.is_completed ? 'bg-gray-50' : 'bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        {formatDate(rehearsal.scheduled_date)}
                      </span>
                      {rehearsal.is_completed ? (
                        <span className="flex items-center text-xs text-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          已完成
                        </span>
                      ) : (
                        <span className="text-xs text-blue-600">即将进行</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
                      {rehearsal.scheduled_start_time && (
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatTime(rehearsal.scheduled_start_time)}
                          {rehearsal.scheduled_end_time &&
                            ` - ${formatTime(rehearsal.scheduled_end_time)}`}
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
      </div>
    </div>
  );
}
