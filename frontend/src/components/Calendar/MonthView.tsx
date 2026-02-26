import React, { useMemo } from 'react';
import type { CalendarEvent, EventsByDate } from '../../types';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthViewProps {
  year: number;
  month: number;
  eventsByDate: EventsByDate;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDateClick?: (date: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

const MonthView: React.FC<MonthViewProps> = ({
  year,
  month,
  eventsByDate,
  onPrevMonth,
  onNextMonth,
  onDateClick,
  onEventClick,
}) => {
  const monthName = useMemo(() => {
    return new Date(year, month - 1).toLocaleString('zh-CN', { month: 'long' });
  }, [year, month]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    // Convert to Monday-based: 0=Monday, 6=Sunday
    const startWeekday = (firstDay.getDay() + 6) % 7;

    const days: Array<{ date: number; dateStr: string; isCurrentMonth: boolean }> = [];

    // Previous month days
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      days.push({
        date: prevMonthLastDay - i,
        dateStr: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevMonthLastDay - i).padStart(2, '0')}`,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: i,
        dateStr: `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        isCurrentMonth: true,
      });
    }

    // Next month days
    const remainingDays = 42 - days.length; // 6 weeks
    for (let i = 1; i <= remainingDays; i++) {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      days.push({
        date: i,
        dateStr: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Calendar className="h-5 w-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            {year}年 {monthName}
          </h2>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onPrevMonth}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={onNextMonth}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-px mb-2">
          {weekDays.map((day, index) => (
            <div
              key={day}
              className={`text-center text-sm font-medium py-2 ${
                index === 5 || index === 6 ? 'text-red-600' : 'text-gray-700'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {calendarDays.map((day, index) => {
            const dayEvents = eventsByDate[day.dateStr] || [];
            const isToday = day.dateStr === today;

            return (
              <div
                key={index}
                className={`bg-white min-h-[100px] p-2 ${
                  !day.isCurrentMonth ? 'opacity-40' : ''
                } ${onDateClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={() => onDateClick?.(day.dateStr)}
              >
                <div
                  className={`text-sm font-medium mb-1 ${
                    isToday
                      ? 'bg-primary-600 text-white w-6 h-6 rounded-full flex items-center justify-center'
                      : day.isCurrentMonth
                      ? 'text-gray-900'
                      : 'text-gray-400'
                  }`}
                >
                  {day.date}
                </div>

                {/* Events */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className="text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                      style={{
                        backgroundColor: event.event_type.color + '20',
                        borderLeft: `3px solid ${event.event_type.color}`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(event);
                      }}
                      title={`${event.event_type.icon} ${event.title}`}
                    >
                      {event.event_type.icon} {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500 px-1">
                      +{dayEvents.length - 3} 更多
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MonthView;
