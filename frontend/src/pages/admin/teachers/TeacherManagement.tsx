import { useSearchParams } from 'react-router-dom';
import TeacherList from './TeacherList';
import TeacherApplications from './TeacherApplications';
import TeacherPayments from './TeacherPayments';

const TABS = [
  { key: 'list', label: '教师列表' },
  { key: 'applications', label: '入校申请' },
  { key: 'payments', label: '劳务发放' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function TeacherManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as TabKey) || 'list';

  const handleTabChange = (tab: TabKey) => {
    setSearchParams(tab === 'list' ? {} : { tab });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">教师管理</h1>
          <p className="mt-1 text-sm text-gray-500">管理教师信息、入校申请和劳务发放</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1">
        {TABS.map((tab) => (
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
      {currentTab === 'list' && <TeacherList />}
      {currentTab === 'applications' && <TeacherApplications />}
      {currentTab === 'payments' && <TeacherPayments />}
    </div>
  );
}
