import { Link } from 'react-router-dom';
import { Calendar, Users, ChevronRight } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

export default function SettingsHub() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isCommittee = hasRole('admin', 'committee');

  const settingsItems = [
    {
      title: '学期管理',
      description: '管理学期设置，设置当前学期',
      icon: Calendar,
      path: '/admin/settings/semesters',
      color: 'bg-blue-500',
      visible: isAdmin,
    },
    {
      title: '用户管理',
      description: '管理系统用户账号和权限',
      icon: Users,
      path: '/admin/settings/users',
      color: 'bg-green-500',
      visible: isCommittee,
    },
  ];

  const visibleItems = settingsItems.filter((item) => item.visible);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
        <p className="mt-1 text-sm text-gray-500">管理系统配置和用户</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((item) => (
          <Link key={item.title} to={item.path} className="card hover:shadow-md transition-shadow">
            <div className="card-body">
              <div className="flex items-start">
                <div
                  className={`${item.color} p-3 rounded-lg text-white flex-shrink-0`}
                >
                  <item.icon className="w-6 h-6" />
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-medium text-gray-900">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {item.description}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Role Info */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium text-gray-900">角色权限说明</h2>
        </div>
        <div className="card-body">
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-lg">
              <h3 className="font-medium text-red-800">系统管理员</h3>
              <p className="mt-1 text-sm text-red-600">
                拥有所有权限，包括用户管理、学期管理、系统配置等
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-800">队委</h3>
              <p className="mt-1 text-sm text-blue-600">
                可以管理队员、教师、节目、排练，以及创建用户账号
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-800">节目负责人</h3>
              <p className="mt-1 text-sm text-green-600">
                可以管理自己负责的节目和排练，标记考勤
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
