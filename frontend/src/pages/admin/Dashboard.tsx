import React from 'react';
import { Link } from 'react-router-dom';
import { Users, UserCheck, Music, Calendar, TrendingUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface StatCard {
  name: string;
  value: string;
  icon: React.ReactNode;
  link: string;
  color: string;
}

const stats: StatCard[] = [
  {
    name: '队员总数',
    value: '--',
    icon: <Users className="w-6 h-6" />,
    link: '/admin/members',
    color: 'bg-blue-500',
  },
  {
    name: '教师总数',
    value: '--',
    icon: <UserCheck className="w-6 h-6" />,
    link: '/admin/teachers',
    color: 'bg-green-500',
  },
  {
    name: '进行中节目',
    value: '--',
    icon: <Music className="w-6 h-6" />,
    link: '/admin/programs',
    color: 'bg-purple-500',
  },
  {
    name: '本周排练',
    value: '--',
    icon: <Calendar className="w-6 h-6" />,
    link: '/admin/rehearsals',
    color: 'bg-orange-500',
  },
];

export default function Dashboard() {
  const { user } = useAuth();

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
        {stats.map((stat) => (
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
                  <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium text-gray-900">快捷操作</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              to="/admin/members"
              className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Users className="w-8 h-8 text-blue-500" />
              <span className="ml-3 font-medium text-gray-700">添加队员</span>
            </Link>
            <Link
              to="/admin/programs"
              className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Music className="w-8 h-8 text-purple-500" />
              <span className="ml-3 font-medium text-gray-700">创建节目</span>
            </Link>
            <Link
              to="/admin/rehearsals"
              className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Calendar className="w-8 h-8 text-orange-500" />
              <span className="ml-3 font-medium text-gray-700">安排排练</span>
            </Link>
            <Link
              to="/"
              className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <TrendingUp className="w-8 h-8 text-green-500" />
              <span className="ml-3 font-medium text-gray-700">查看考勤</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium text-gray-900">最近活动</h2>
        </div>
        <div className="card-body">
          <p className="text-gray-500 text-center py-8">暂无最近活动</p>
        </div>
      </div>
    </div>
  );
}
