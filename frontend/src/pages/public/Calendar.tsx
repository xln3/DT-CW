import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CalendarEvent, EventsByDate, Semester, WeekScheduleData } from '../../types';
import { isTrainingPeriod, SEMESTER_TYPES } from '../../types';
import { publicCalendarApi, publicScheduleApi } from '../../services/api';
import MonthView from '../../components/Calendar/MonthView';
import EventList from '../../components/Calendar/EventList';
import EventDetailModal from '../../components/Calendar/EventDetailModal';
import { WeekScheduleView } from '../../components/Schedule';
import { AlertCircle, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';

const CalendarPage: React.FC = () => {
  const navigate = useNavigate();

  // Semester state
  const [semester, setSemester] = useState<Semester | null>(null);
  const [semesterLoading, setSemesterLoading] = useState(true);

  // Month view state
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [eventsByDate, setEventsByDate] = useState<EventsByDate>({});
  const [weekEvents, setWeekEvents] = useState<CalendarEvent[]>([]);

  // Week schedule view state
  const [weekSchedule, setWeekSchedule] = useState<WeekScheduleData | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Load current semester
  useEffect(() => {
    const loadSemester = async () => {
      try {
        setSemesterLoading(true);
        const data = await publicScheduleApi.getCurrentSemester();
        setSemester(data);
      } catch (err) {
        console.error('Load semester error:', err);
        // Default to null, will show month view
      } finally {
        setSemesterLoading(false);
      }
    };
    loadSemester();
  }, []);

  // Load data based on semester type
  useEffect(() => {
    if (semesterLoading) return;

    if (semester && isTrainingPeriod(semester.semester_type)) {
      loadWeekSchedule();
    } else {
      loadMonthEvents();
      loadCalendarWeekEvents();
    }
  }, [semester, semesterLoading, year, month]);

  const loadWeekSchedule = useCallback(async (startDate?: string) => {
    try {
      setLoading(true);
      setError('');
      const data = await publicScheduleApi.getWeekSchedule({
        start_date: startDate,
        semester_id: semester?.id,
      });
      setWeekSchedule(data);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载时间表失败');
      console.error('Load week schedule error:', err);
    } finally {
      setLoading(false);
    }
  }, [semester?.id]);

  const loadMonthEvents = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await publicCalendarApi.getMonthEvents(year, month);
      setEventsByDate(data.events_by_date || {});
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
      console.error('Load month events error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarWeekEvents = async () => {
    try {
      const data = await publicCalendarApi.getWeekEvents();
      const allEvents: CalendarEvent[] = [];
      Object.values(data.events_by_date || {}).forEach((events: any) => {
        allEvents.push(...events);
      });
      setWeekEvents(allEvents);
    } catch (err) {
      console.error('Load week events error:', err);
    }
  };

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  const handleCloseModal = () => {
    setSelectedEvent(null);
  };

  const handleWeekChange = (startDate: string) => {
    loadWeekSchedule(startDate);
  };

  const getSemesterTypeLabel = (type: string) => {
    return SEMESTER_TYPES.find(t => t.value === type)?.label || type;
  };

  // Show loading while determining semester type
  if (semesterLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  const isTraining = semester && isTrainingPeriod(semester.semester_type);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">
                  {isTraining ? '训练时间表' : '活动日历'}
                </h1>
                {semester && (
                  <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                    {getSemesterTypeLabel(semester.semester_type)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {isTraining
                  ? '查看本周排练安排'
                  : '查看演出、排练和其他活动安排'}
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => navigate('/attendance')}
                className="btn-secondary"
              >
                考勤公示
              </button>
              <button
                onClick={() => navigate('/login')}
                className="btn-primary"
              >
                管理后台
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {/* Render based on semester type */}
        {isTraining ? (
          // Week Schedule View for training periods
          <div>
            {loading ? (
              <div className="bg-white rounded-lg shadow p-12 text-center flex items-center justify-center">
                <div>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="mt-4 text-gray-500">加载中...</p>
                </div>
              </div>
            ) : weekSchedule ? (
              <WeekScheduleView
                data={weekSchedule}
                onWeekChange={handleWeekChange}
                fixedMode={true}
              />
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">暂无排练安排</p>
              </div>
            )}
          </div>
        ) : (
          // Month View for regular semesters
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Calendar */}
            <div className="lg:col-span-2">
              {loading ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="mt-4 text-gray-500">加载中...</p>
                </div>
              ) : (
                <MonthView
                  year={year}
                  month={month}
                  eventsByDate={eventsByDate}
                  onPrevMonth={handlePrevMonth}
                  onNextMonth={handleNextMonth}
                  onEventClick={handleEventClick}
                />
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Week Events */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-primary-600" />
                  <h3 className="text-lg font-semibold text-gray-900">本周事件</h3>
                </div>
                <EventList
                  events={weekEvents}
                  onEventClick={handleEventClick}
                />
              </div>

              {/* Legend */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">图例</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">🎭</span>
                    <span className="text-sm text-gray-700">演出</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">📋</span>
                    <span className="text-sm text-gray-700">审核</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">🎵</span>
                    <span className="text-sm text-gray-700">排练</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">👥</span>
                    <span className="text-sm text-gray-700">会议</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">📌</span>
                    <span className="text-sm text-gray-700">其他</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Event Detail Modal (for month view) */}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={handleCloseModal} />
      )}
    </div>
  );
};

export default CalendarPage;
