import React from 'react';
import type { CalendarEvent } from '../../types';
import { MapPin, Clock } from 'lucide-react';

interface EventListProps {
  events: CalendarEvent[];
  title?: string;
  onEventClick?: (event: CalendarEvent) => void;
}

const EventList: React.FC<EventListProps> = ({ events, title, onEventClick }) => {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {title ? `${title}暂无事件` : '暂无事件'}
      </div>
    );
  }

  // Group events by date
  const eventsByDate: { [date: string]: CalendarEvent[] } = {};
  events.forEach((event) => {
    if (!eventsByDate[event.start_date]) {
      eventsByDate[event.start_date] = [];
    }
    eventsByDate[event.start_date].push(event);
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];
    return `${month}月${day}日 (${weekday})`;
  };

  const formatTime = (event: CalendarEvent) => {
    if (event.is_all_day) {
      return '全天';
    }
    if (event.start_time) {
      const end = event.end_time ? ` - ${event.end_time.slice(0, 5)}` : '';
      return `${event.start_time.slice(0, 5)}${end}`;
    }
    return '';
  };

  return (
    <div className="space-y-6">
      {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}

      {Object.entries(eventsByDate).map(([date, dateEvents]) => (
        <div key={date} className="space-y-3">
          <div className="text-sm font-medium text-gray-700 border-b pb-2">
            📅 {formatDate(date)}
          </div>

          {dateEvents.map((event) => (
            <div
              key={event.id}
              className={`border-l-4 bg-white rounded-r-lg shadow-sm p-4 hover:shadow-md transition-shadow ${
                onEventClick ? 'cursor-pointer' : ''
              }`}
              style={{ borderColor: event.event_type.color }}
              onClick={() => onEventClick?.(event)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">{event.event_type.icon}</span>
                    <h4 className="font-medium text-gray-900">{event.title}</h4>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: event.event_type.color + '20',
                        color: event.event_type.color,
                      }}
                    >
                      {event.event_type.name}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-gray-600">
                    {!event.is_all_day && event.start_time && (
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>{formatTime(event)}</span>
                      </div>
                    )}

                    {event.location && (
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4" />
                        <span>{event.location}</span>
                      </div>
                    )}

                    {event.program && (
                      <div className="flex items-center space-x-2">
                        <span>🎭</span>
                        <span>{event.program.name}</span>
                      </div>
                    )}
                  </div>

                  {event.description && (
                    <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default EventList;
