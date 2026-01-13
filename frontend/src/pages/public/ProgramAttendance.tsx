import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { publicApi } from '../../services/api';

interface MemberAttendance {
  member_id: number;
  member_name: string;
  student_id: string;
  total_rehearsals: number;
  normal_count: number;
  late_count: number;
  absent_count: number;
  leave_count: number;
  attendance_rate: number;
}

interface ProgramAttendanceData {
  program: {
    id: number;
    name: string;
    category: string;
  };
  stats: {
    total_rehearsals: number;
    total_members: number;
    average_attendance_rate: number;
  };
  members: MemberAttendance[];
  recent_rehearsals: {
    id: number;
    date: string;
    location: string;
    attendance_rate: number;
  }[];
}

export default function ProgramAttendance() {
  const { id } = useParams();
  const [data, setData] = useState<ProgramAttendanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'members' | 'rehearsals'>('members');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await publicApi.getProgramAttendance(Number(id));
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAttendanceBadge = (rate: number) => {
    if (rate >= 90)
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
          优秀
        </span>
      );
    if (rate >= 70)
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
          良好
        </span>
      );
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
        需改进
      </span>
    );
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body text-center">
            <Users className="w-8 h-8 text-primary-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              {data.stats.total_members}
            </p>
            <p className="text-sm text-gray-500">成员人数</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <Calendar className="w-8 h-8 text-primary-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              {data.stats.total_rehearsals}
            </p>
            <p className="text-sm text-gray-500">排练次数</p>
          </div>
        </div>
        <div className="card col-span-2">
          <div className="card-body text-center">
            <TrendingUp className="w-8 h-8 text-primary-600 mx-auto mb-2" />
            <p
              className={`text-3xl font-bold ${getAttendanceColor(data.stats.average_attendance_rate)}`}
            >
              {data.stats.average_attendance_rate.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-500">平均出勤率</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('members')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'members'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            成员考勤
          </button>
          <button
            onClick={() => setActiveTab('rehearsals')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'rehearsals'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            排练记录
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'members' && (
        <div className="card">
          <div className="card-body">
            {data.members.length === 0 ? (
              <p className="text-center text-gray-500 py-8">暂无成员数据</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        姓名
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        正常
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        迟到
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        缺勤
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        请假
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        出勤率
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        评级
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.members.map((member) => (
                      <tr key={member.member_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <p className="font-medium text-gray-900">
                              {member.member_name}
                            </p>
                            {member.student_id && (
                              <p className="text-sm text-gray-500">
                                {member.student_id}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-green-600 font-medium">
                            {member.normal_count}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-yellow-600 font-medium">
                            {member.late_count}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-red-600 font-medium">
                            {member.absent_count}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-blue-600 font-medium">
                            {member.leave_count}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span
                            className={`font-semibold ${getAttendanceColor(member.attendance_rate)}`}
                          >
                            {member.attendance_rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {getAttendanceBadge(member.attendance_rate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'rehearsals' && (
        <div className="card">
          <div className="card-body">
            {data.recent_rehearsals.length === 0 ? (
              <p className="text-center text-gray-500 py-8">暂无排练记录</p>
            ) : (
              <div className="space-y-3">
                {data.recent_rehearsals.map((rehearsal) => (
                  <div
                    key={rehearsal.id}
                    className="p-4 bg-gray-50 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{rehearsal.date}</p>
                      <p className="text-sm text-gray-500">
                        {rehearsal.location || '地点待定'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-semibold ${getAttendanceColor(rehearsal.attendance_rate)}`}
                      >
                        {rehearsal.attendance_rate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500">出勤率</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
