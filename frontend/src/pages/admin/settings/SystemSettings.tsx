import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import SemesterList from './SemesterList';
import UserList from './UserList';
import Profile from './Profile';

interface Tab {
  key: string;
  label: string;
  visible: boolean;
}

export default function SystemSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isCommittee = hasRole('admin', 'committee');

  const tabs: Tab[] = [
    { key: 'semesters', label: '学期管理', visible: isAdmin },
    { key: 'users', label: '用户管理', visible: isCommittee },
    { key: 'profile', label: '个人资料', visible: true },
  ];

  const visibleTabs = tabs.filter((t) => t.visible);
  const currentTab = searchParams.get('tab') || visibleTabs[0]?.key || 'profile';

  const handleTabChange = (tab: string) => {
    setSearchParams(tab === visibleTabs[0]?.key ? {} : { tab });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
        <p className="mt-1 text-sm text-gray-500">管理系统配置和个人信息</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              currentTab === tab.key
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {currentTab === 'semesters' && isAdmin && <SemesterList />}
      {currentTab === 'users' && isCommittee && <UserList />}
      {currentTab === 'profile' && <Profile />}
    </div>
  );
}
