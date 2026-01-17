import React from 'react';
import type { CalendarEvent } from '../../types';
import { X, Calendar, Clock, MapPin, Repeat, Bell } from 'lucide-react';

interface EventDetailModalProps {
  event: CalendarEvent;
  onClose: () => void;
}

const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, onClose }) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];
    return `${year}年${month}月${day}日 星期${weekday}`;
  };

  const formatTime = (timeStr: string) => {
    return timeStr.slice(0, 5);
  };

  const formatDateRange = () => {
    if (event.end_date && event.end_date !== event.start_date) {
      return (
        <>
          <div>{formatDate(event.start_date)}</div>
          <div className="text-gray-400">至</div>
          <div>{formatDate(event.end_date)}</div>
        </>
      );
    }
    return <div>{formatDate(event.start_date)}</div>;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header with Color Bar */}
        <div
          className="h-2 rounded-t-lg"
          style={{ backgroundColor: event.event_type.color }}
        />

        <div className="p-6">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="float-right p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>

          {/* Title */}
          <div className="flex items-start space-x-3 mb-6">
            <span className="text-4xl">{event.event_type.icon}</span>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {event.title}
              </h2>
              <span
                className="inline-block text-sm px-3 py-1 rounded-full"
                style={{
                  backgroundColor: event.event_type.color + '20',
                  color: event.event_type.color,
                }}
              >
                {event.event_type.name}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4">
            {/* Date */}
            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="text-gray-700">
                {formatDateRange()}
              </div>
            </div>

            {/* Time */}
            {!event.is_all_day && event.start_time && (
              <div className="flex items-start space-x-3">
                <Clock className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="text-gray-700">
                  {formatTime(event.start_time)}
                  {event.end_time && ` - ${formatTime(event.end_time)}`}
                </div>
              </div>
            )}

            {event.is_all_day && (
              <div className="flex items-start space-x-3">
                <Clock className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="text-gray-700">全天</div>
              </div>
            )}

            {/* Location */}
            {event.location && (
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="text-gray-700">{event.location}</div>
              </div>
            )}

            {/* Program */}
            {event.program && (
              <div className="flex items-start space-x-3">
                <span className="text-lg mt-0.5 flex-shrink-0">🎭</span>
                <div>
                  <div className="text-sm text-gray-500">关联节目</div>
                  <div className="text-gray-700 font-medium">{event.program.name}</div>
                </div>
              </div>
            )}

            {/* Recurring */}
            {event.is_recurring && (
              <div className="flex items-start space-x-3">
                <Repeat className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-gray-700">重复事件</div>
                  {event.recurrence_rule && (
                    <div className="text-sm text-gray-500 mt-1">
                      {event.recurrence_rule}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reminder */}
            {event.reminder_minutes !== undefined && event.reminder_minutes > 0 && (
              <div className="flex items-start space-x-3">
                <Bell className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="text-gray-700">
                  提前 {event.reminder_minutes} 分钟提醒
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">描述</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {/* Status */}
          {event.status !== 'active' && (
            <div className="mt-6 pt-6 border-t">
              <div
                className={`inline-block px-3 py-1 rounded-full text-sm ${
                  event.status === 'cancelled'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {event.status === 'cancelled' ? '已取消' : '已完成'}
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="mt-6 pt-6 border-t flex justify-end">
            <button onClick={onClose} className="btn-secondary">
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailModal;
