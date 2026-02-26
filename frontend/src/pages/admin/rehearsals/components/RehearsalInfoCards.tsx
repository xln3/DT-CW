import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import type { Rehearsal } from '../../../../types';

interface RehearsalInfoCardsProps {
  rehearsal: Rehearsal;
}

export default function RehearsalInfoCards({ rehearsal }: RehearsalInfoCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="card">
        <div className="card-body">
          <div className="flex items-center">
            <Calendar className="w-8 h-8 text-primary-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">日期</p>
              <p className="text-lg font-semibold text-gray-900">
                {rehearsal.scheduled_date}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-primary-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">时间</p>
              <p className="text-lg font-semibold text-gray-900">
                {rehearsal.scheduled_start_time || '-'} -{' '}
                {rehearsal.scheduled_end_time || '-'}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="flex items-center">
            <MapPin className="w-8 h-8 text-primary-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">地点</p>
              <p className="text-lg font-semibold text-gray-900">
                {rehearsal.location || '未指定'}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-primary-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">教师</p>
              <p className="text-lg font-semibold text-gray-900">
                {rehearsal.teacher_name || '未指定'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
