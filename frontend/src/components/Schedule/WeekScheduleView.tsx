import { useState, useMemo } from 'react';
import type { WeekScheduleData, ScheduleEvent } from '../../types';
import { ScheduleLegend } from './ScheduleLegend';

interface WeekScheduleViewProps {
  data: WeekScheduleData;
  onEventClick?: (event: ScheduleEvent) => void;
  onWeekChange?: (startDate: string) => void;
  /** Fixed mode for training period - no week navigation, fixed time range */
  fixedMode?: boolean;
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAY_NAMES_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

function parseTime(timeStr: string | undefined): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(timeStr: string | undefined): string {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

function getDateInfo(dateStr: string): { dayOfWeek: string; dayOfWeekShort: string; monthDay: string } {
  const date = new Date(dateStr);
  const dayIndex = date.getDay();
  return {
    dayOfWeek: WEEKDAY_NAMES[dayIndex],
    dayOfWeekShort: WEEKDAY_NAMES_SHORT[dayIndex],
    monthDay: `${date.getMonth() + 1}/${date.getDate()}`,
  };
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

interface EventWithLayout extends ScheduleEvent {
  column: number;
  totalColumns: number;
}

interface SeparatedEvents {
  timedEvents: EventWithLayout[];
  allDayEvents: ScheduleEvent[];
}

function calculateEventLayout(events: ScheduleEvent[]): SeparatedEvents {
  if (events.length === 0) return { timedEvents: [], allDayEvents: [] };

  // Separate all-day events from timed events
  const allDayEvents: ScheduleEvent[] = [];
  const timedEventsRaw: ScheduleEvent[] = [];

  for (const event of events) {
    if (event.is_all_day || (!event.start_time && !event.end_time)) {
      allDayEvents.push(event);
    } else {
      timedEventsRaw.push(event);
    }
  }

  // Sort timed events by start time, then by duration (longer first for better layout)
  const sorted = [...timedEventsRaw].sort((a, b) => {
    const startA = parseTime(a.start_time);
    const startB = parseTime(b.start_time);
    if (startA !== startB) return startA - startB;
    const durationA = parseTime(a.end_time) - startA;
    const durationB = parseTime(b.end_time) - startB;
    return durationB - durationA;
  });

  const result: EventWithLayout[] = [];
  const columns: { endTime: number }[] = [];

  for (const event of sorted) {
    const startMin = parseTime(event.start_time);
    const endMin = parseTime(event.end_time);

    // Find a column where this event fits (no overlap)
    let columnIndex = columns.findIndex(col => col.endTime <= startMin);
    if (columnIndex === -1) {
      columnIndex = columns.length;
      columns.push({ endTime: endMin });
    } else {
      columns[columnIndex].endTime = endMin;
    }

    result.push({
      ...event,
      column: columnIndex,
      totalColumns: 0, // Will be calculated later
    });
  }

  // Calculate total columns for each event based on overlapping events
  for (const event of result) {
    const startMin = parseTime(event.start_time);
    const endMin = parseTime(event.end_time);

    // Find all events that overlap with this one
    const overlapping = result.filter(e => {
      const eStart = parseTime(e.start_time);
      const eEnd = parseTime(e.end_time);
      return !(eEnd <= startMin || eStart >= endMin);
    });

    // Total columns is the max column index + 1 among overlapping events
    const maxCol = Math.max(...overlapping.map(e => e.column));
    for (const e of overlapping) {
      e.totalColumns = Math.max(e.totalColumns, maxCol + 1);
    }
  }

  return { timedEvents: result, allDayEvents };
}

export function WeekScheduleView({ data, onEventClick, onWeekChange, fixedMode = false }: WeekScheduleViewProps) {
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);

  const dates = useMemo(() => {
    const result: string[] = [];
    let current = new Date(data.week_start);
    const end = new Date(data.week_end);
    while (current <= end) {
      result.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return result;
  }, [data.week_start, data.week_end]);

  const timeRange = useMemo(() => {
    let minTime = 24 * 60;
    let maxTime = 0;

    Object.values(data.schedule).forEach((events) => {
      events.forEach((event) => {
        const start = parseTime(event.start_time);
        const end = parseTime(event.end_time);
        if (start > 0) minTime = Math.min(minTime, start);
        if (end > 0) maxTime = Math.max(maxTime, end);
      });
    });

    if (minTime >= maxTime) {
      return { start: 8 * 60, end: 20 * 60 };
    }

    // Round to hour boundaries
    const paddedStart = Math.max(0, Math.floor(minTime / 60) * 60);
    const paddedEnd = Math.min(24 * 60, Math.ceil(maxTime / 60) * 60);

    return { start: paddedStart, end: paddedEnd };
  }, [data.schedule]);

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let t = timeRange.start; t < timeRange.end; t += 60) {
      const hours = Math.floor(t / 60);
      slots.push(`${hours.toString().padStart(2, '0')}:00`);
    }
    return slots;
  }, [timeRange]);

  const handlePrevWeek = () => {
    onWeekChange?.(addDays(data.week_start, -7));
  };

  const handleNextWeek = () => {
    onWeekChange?.(addDays(data.week_start, 7));
  };

  const handleEventClick = (event: ScheduleEvent) => {
    setSelectedEvent(event);
    onEventClick?.(event);
  };

  // Calculate pixel height per minute for proper scaling
  const totalMinutes = timeRange.end - timeRange.start;
  // Use compact scaling: 48px per hour (0.8px per minute) for fixedMode
  const pixelsPerMinute = fixedMode ? 0.8 : 1;
  const gridHeight = totalMinutes * pixelsPerMinute;
  const hourHeight = 60 * pixelsPerMinute;

  const renderEvent = (event: EventWithLayout) => {
    const startMin = parseTime(event.start_time);
    const endMin = parseTime(event.end_time);
    const duration = endMin - startMin;

    const top = ((startMin - timeRange.start) / totalMinutes) * 100;
    const height = (duration / totalMinutes) * 100;
    const heightPx = duration * pixelsPerMinute;

    // Calculate width and left position based on columns
    const columnWidth = 100 / event.totalColumns;
    const left = event.column * columnWidth;

    // Estimate available width per column (assume ~50px per column on mobile, ~80px on desktop)
    const isNarrow = event.totalColumns >= 2;
    const isVeryNarrow = event.totalColumns >= 3;

    // Determine font size based on available height AND column count
    const getHeightLevel = () => {
      if (heightPx < 25) return 0; // xs
      if (heightPx < 40) return 1; // sm
      return 2; // base
    };
    const columnPenalty = isVeryNarrow ? 2 : isNarrow ? 1 : 0;
    const effectiveLevel = Math.max(0, getHeightLevel() - columnPenalty);
    const fontSizeClass = effectiveLevel === 0 ? 'text-[10px]' : effectiveLevel === 1 ? 'text-xs' : 'text-sm';

    // Priority: Time > Name > Location
    // Time: always show if height >= 25px (lowered threshold)
    const showTime = heightPx >= 25;
    // Location: only show if plenty of space and single column
    const showLocation = heightPx >= 50 && event.location && !isNarrow;

    // Truncate name based on available space
    const fullName = event.title || event.program_name || '';
    const getDisplayName = () => {
      if (isVeryNarrow) return fullName.slice(0, 1); // Very narrow: 1 char
      if (isNarrow) return fullName.slice(0, 2); // Narrow: 2 chars
      if (heightPx < 35) return fullName.slice(0, 3); // Short height: 3 chars
      return fullName; // Full name
    };
    const displayName = getDisplayName();

    // Truncate location to first char if narrow
    const displayLocation = event.location
      ? (isNarrow ? event.location.slice(0, 1) : event.location)
      : '';

    // Event type indicator (calendar event vs rehearsal)
    const isCalendarEvent = event.event_type !== undefined;

    return (
      <div
        key={`${isCalendarEvent ? 'cal' : 'reh'}-${event.id}`}
        onClick={() => handleEventClick(event)}
        className={`absolute rounded-md overflow-hidden cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-blue-400 transition-all ${
          isCalendarEvent ? 'border-2 border-dashed border-white/50' : ''
        }`}
        style={{
          top: `${top}%`,
          height: `${Math.max(height, 3)}%`,
          left: `calc(${left}% + 1px)`,
          width: `calc(${columnWidth}% - 2px)`,
          backgroundColor: event.program_color || '#6B7280',
        }}
      >
        <div className={`px-0.5 h-full flex flex-col justify-center text-white ${fontSizeClass} overflow-hidden`}>
          <span className="font-semibold leading-tight whitespace-nowrap overflow-hidden">
            {displayName}
          </span>
          {showTime && (
            <span className="text-white/90 leading-tight break-all">
              {formatTime(event.start_time)}-{formatTime(event.end_time)}
            </span>
          )}
          {showLocation && (
            <span className="text-white/70 leading-tight whitespace-nowrap overflow-hidden">{displayLocation}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col bg-white rounded-lg shadow-sm ${fixedMode ? '' : 'h-full'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 sm:p-4 border-b">
        {fixedMode ? (
          // Fixed mode: just show title, no navigation
          <h2 className="text-sm sm:text-lg font-semibold text-gray-900">
            {data.semester.name}
          </h2>
        ) : (
          // Normal mode: show navigation
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={handlePrevWeek}
              className="p-1 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-sm sm:text-lg font-semibold text-gray-900">
              {data.week_start} ~ {data.week_end}
            </h2>
            <button
              onClick={handleNextWeek}
              className="p-1 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
        <div className="text-[10px] sm:text-sm text-gray-500 hidden sm:block">
          {data.week_start} ~ {data.week_end}
        </div>
      </div>

      {/* Legend */}
      {data.programs.length > 0 && (
        <div className="p-2 sm:p-4 border-b">
          <ScheduleLegend programs={data.programs} />
        </div>
      )}

      {/* Schedule Grid */}
      <div className={fixedMode ? 'flex-1' : 'flex-1 overflow-auto'}>
        <div className={fixedMode ? '' : 'min-w-[800px]'}>
          {/* Day Headers */}
          <div className="flex border-b sticky top-0 bg-white z-10">
            <div className="w-8 sm:w-14 flex-shrink-0 p-1 sm:p-2 border-r" />
            {dates.map((date) => {
              const { dayOfWeek, dayOfWeekShort, monthDay } = getDateInfo(date);
              const isToday = date === new Date().toISOString().split('T')[0];
              return (
                <div
                  key={date}
                  className={`flex-1 p-1 sm:p-2 text-center border-r last:border-r-0 ${
                    isToday ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className={`text-xs sm:text-base font-medium ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    <span className="sm:hidden">{dayOfWeekShort}</span>
                    <span className="hidden sm:inline">{dayOfWeek}</span>
                  </div>
                  <div className={`text-[10px] sm:text-sm ${isToday ? 'text-blue-500' : 'text-gray-500'}`}>
                    {monthDay}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time Grid */}
          <div className="flex relative" style={{ height: fixedMode ? `${gridHeight}px` : `${timeSlots.length * 60}px` }}>
            {/* Time Labels - using absolute positioning for accurate alignment */}
            <div className="w-8 sm:w-14 flex-shrink-0 border-r relative">
              {timeSlots.map((time, i) => {
                const hour = time.split(':')[0];
                return (
                  <div
                    key={time}
                    className="absolute text-[10px] sm:text-xs text-gray-500 text-right pr-0.5 sm:pr-2 font-medium"
                    style={{
                      top: `${i * hourHeight}px`,
                      transform: 'translateY(-50%)',
                      right: 0,
                      left: 0,
                    }}
                  >
                    <span className="sm:hidden">{parseInt(hour, 10)}</span>
                    <span className="hidden sm:inline">{time}</span>
                  </div>
                );
              })}
            </div>

            {/* Day Columns */}
            {dates.map((date) => {
              const events = data.schedule[date] || [];
              const { timedEvents, allDayEvents } = calculateEventLayout(events);
              const isToday = date === new Date().toISOString().split('T')[0];
              return (
                <div
                  key={date}
                  className={`flex-1 border-r last:border-r-0 relative ${
                    isToday ? 'bg-blue-50/30' : ''
                  }`}
                >
                  {/* Hour lines */}
                  {timeSlots.map((_, i) => (
                    <div
                      key={i}
                      className="border-b border-gray-100"
                      style={{ height: `${hourHeight}px` }}
                    />
                  ))}

                  {/* All-day events banner at top */}
                  {allDayEvents.length > 0 && (
                    <div className="absolute top-0 left-0 right-0 z-10 p-0.5 sm:p-1 space-y-0.5 sm:space-y-1">
                      {allDayEvents.map((event) => (
                        <div
                          key={`allday-${event.id}`}
                          onClick={() => handleEventClick(event)}
                          className="rounded px-1 sm:px-2 py-0.5 text-[10px] sm:text-xs text-white font-medium cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-blue-400 border border-dashed border-white/50 break-words line-clamp-1"
                          style={{ backgroundColor: event.program_color || '#6B7280' }}
                        >
                          {event.title || event.program_name}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Timed Events */}
                  {timedEvents.map(renderEvent)}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-4 text-white"
              style={{ backgroundColor: selectedEvent.program_color || '#6B7280' }}
            >
              <h3 className="text-lg font-semibold">{selectedEvent.title || selectedEvent.program_name}</h3>
              {selectedEvent.title && selectedEvent.program_name && (
                <p className="text-white/80 text-sm">{selectedEvent.program_name}</p>
              )}
            </div>
            <div className="p-4 space-y-3">
              {(selectedEvent.start_time || selectedEvent.end_time) && (
                <div className="flex items-center gap-2 text-gray-700">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    {formatTime(selectedEvent.start_time)} - {formatTime(selectedEvent.end_time)}
                  </span>
                </div>
              )}
              {selectedEvent.location && (
                <div className="flex items-center gap-2 text-gray-700">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              {selectedEvent.teacher_name && (
                <div className="flex items-center gap-2 text-gray-700">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>{selectedEvent.teacher_name}</span>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WeekScheduleView;
