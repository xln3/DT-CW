import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Star } from 'lucide-react';
import { publicApi } from '../../services/api';
import type { ProgramMatrixData } from '../../types';
import ThreeSegmentCell from './components/ThreeSegmentCell';

export default function ProgramAttendance() {
  const { id } = useParams();
  const [data, setData] = useState<ProgramMatrixData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await publicApi.getProgramMatrix(Number(id));
      setData(result);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
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
      <div className="space-y-4">
        <Link
          to="/attendance"
          className="inline-flex items-center text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回总览
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error || '数据加载失败'}</span>
        </div>
      </div>
    );
  }

  const hasData = data.members.length > 0 && data.rehearsals.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          to="/attendance"
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.program.name}</h1>
          <p className="text-gray-500">考勤统计详情</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-green-500 rounded" />
          <span className="text-gray-600">出勤</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-orange-500 rounded" />
          <span className="text-gray-600">缺勤</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded" />
          <span className="text-gray-600">请假</span>
        </div>
        <div className="flex items-center space-x-2">
          <Star className="w-4 h-4 text-yellow-500" />
          <span className="text-gray-600">负责人</span>
        </div>
      </div>

      {/* Matrix Table */}
      {!hasData ? (
        <div className="card">
          <div className="card-body">
            <p className="text-center text-gray-500 py-8">暂无考勤数据</p>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th
                    className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200"
                    style={{ minWidth: '120px' }}
                  >
                    队员
                  </th>
                  {data.rehearsals.map((rehearsal) => (
                    <th
                      key={rehearsal.id}
                      className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider ${
                        !rehearsal.counts ? 'opacity-50' : ''
                      }`}
                      style={{ minWidth: '50px' }}
                      title={!rehearsal.counts ? '不计入考勤统计' : undefined}
                    >
                      {formatDate(rehearsal.date)}
                    </th>
                  ))}
                  <th
                    className="sticky right-0 z-20 bg-gray-50 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200"
                    style={{ minWidth: '70px' }}
                  >
                    A/B
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.members.map((member) => {
                  const summary = data.summary[member.id];
                  return (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 border-r border-gray-200">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">
                            {member.name}
                          </span>
                          {member.is_leader && (
                            <Star className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                      </td>
                      {data.rehearsals.map((rehearsal) => {
                        const cell = data.matrix[member.id]?.[rehearsal.id];
                        return (
                          <td
                            key={rehearsal.id}
                            className="px-2 py-3 text-center"
                          >
                            <ThreeSegmentCell
                              cell={cell}
                              counts={rehearsal.counts}
                            />
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-10 bg-white px-4 py-3 text-center border-l border-gray-200">
                        {summary && (
                          <span className="text-sm">
                            <span className="text-green-600 font-medium">
                              {summary.attended}
                            </span>
                            <span className="text-gray-400">/</span>
                            <span className="text-gray-900">{summary.total}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
