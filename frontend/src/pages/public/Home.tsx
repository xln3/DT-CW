import { Link } from 'react-router-dom';
import { Users, Calendar, Search, ArrowRight } from 'lucide-react';

export default function Home() {
  const features = [
    {
      icon: Users,
      title: '考勤总览',
      description: '查看各节目的考勤统计和出勤情况',
      link: '/attendance',
      color: 'bg-blue-500',
    },
    {
      icon: Search,
      title: '考勤查询',
      description: '按姓名或学号查询个人考勤记录',
      link: '/attendance/search',
      color: 'bg-green-500',
    },
    {
      icon: Calendar,
      title: '排练日历',
      description: '查看近期排练安排和时间表',
      link: '/calendar',
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center py-12 bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl text-white">
        <h1 className="text-4xl font-bold mb-4">欢迎来到艺术团</h1>
        <p className="text-xl text-primary-100 mb-8">
          艺术团综合管理系统 - 高效管理，精彩演出
        </p>
        <div className="flex justify-center space-x-4">
          <Link
            to="/attendance"
            className="inline-flex items-center px-6 py-3 bg-white text-primary-600 rounded-lg font-medium hover:bg-primary-50 transition-colors"
          >
            查看考勤
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </div>

      {/* Features */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          快速访问
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Link
              key={feature.title}
              to={feature.link}
              className="card hover:shadow-lg transition-shadow group"
            >
              <div className="card-body">
                <div
                  className={`w-12 h-12 ${feature.color} rounded-lg flex items-center justify-center mb-4`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-white rounded-xl p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">关于我们</h2>
        <p className="text-gray-600 leading-relaxed">
          艺术团是一个充满活力和创造力的团队，致力于为校园文化生活增添色彩。
          我们汇聚了来自各个院系的艺术爱好者，通过专业的训练和精心的编排，
          为大家呈现精彩的演出。无论是舞蹈、声乐还是器乐，我们都追求卓越，
          展现艺术的魅力。
        </p>
      </div>
    </div>
  );
}
