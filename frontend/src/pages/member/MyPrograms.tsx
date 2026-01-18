import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Music, Users, Calendar, ChevronRight } from 'lucide-react';
import { memberPortalApi } from '../../services/api';

interface Program {
  id: number;
  name: string;
  category: string;
  display_color: string | null;
  is_leader: boolean;
  member_count: number;
  rehearsal_count: number;
  completed_rehearsal_count: number;
}

export default function MyPrograms() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPrograms = async () => {
      setIsLoading(true);
      try {
        const data = await memberPortalApi.getMyPrograms();
        setPrograms(data.programs);
      } catch (err) {
        console.error('Failed to fetch programs:', err);
        const error = err as { response?: { data?: { error?: string } } };
        setError(error.response?.data?.error || '加载失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrograms();
  }, []);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">我的节目</h1>
        <p className="mt-1 text-sm text-gray-500">查看您参与的所有节目</p>
      </div>

      {programs.length === 0 ? (
        <div className="text-center py-12">
          <Music className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">暂无节目</h3>
          <p className="mt-1 text-sm text-gray-500">您目前还未参与任何节目</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((program) => (
            <Link
              key={program.id}
              to={`/member/programs/${program.id}`}
              className="card hover:shadow-md transition-shadow"
            >
              <div className="card-body">
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded-full mr-3"
                      style={{ backgroundColor: program.display_color || '#3498DB' }}
                    />
                    <div>
                      <h3 className="font-medium text-gray-900">{program.name}</h3>
                      {program.category && (
                        <span className="text-xs text-gray-500">{program.category}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>

                {program.is_leader && (
                  <div className="mt-2">
                    <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                      节目负责人
                    </span>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {program.member_count} 人
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {program.completed_rehearsal_count}/{program.rehearsal_count} 次排练
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
