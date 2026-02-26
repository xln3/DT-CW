import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  AlertCircle,
  Settings,
} from 'lucide-react';
import { venuesApi, bookingsApi, programsApi, semestersApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { Venue, VenueScheduleDay, VenueTimeSlot, VenueBooking, Program, Semester } from '../../../types';
import { DAY_NAMES } from '../../../types';

// --- Types ---

type ViewMode = 'week' | 'month' | 'semester';

const VIEW_LABELS: Record<ViewMode, string> = { week: '周', month: '月', semester: '学期' };

// --- Helpers ---

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayStr(): string {
  return toDateStr(new Date());
}

function parseTimeMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function getMondayStr(date: Date): string {
  return toDateStr(getMonday(date));
}

function getWeekDateStrs(mondayStr: string): string[] {
  const dates: string[] = [];
  const [y, m, d] = mondayStr.split('-').map(Number);
  for (let i = 0; i < 7; i++) {
    dates.push(toDateStr(new Date(y, m - 1, d + i)));
  }
  return dates;
}

function getMonthCalendarDates(year: number, month: number): { dateStr: string; isCurrentMonth: boolean }[] {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7; // Monday=0

  const days: { dateStr: string; isCurrentMonth: boolean }[] = [];

  // Previous month padding
  for (let i = startWeekday - 1; i >= 0; i--) {
    days.push({ dateStr: toDateStr(new Date(year, month - 1, -i)), isCurrentMonth: false });
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ dateStr: toDateStr(new Date(year, month - 1, i)), isCurrentMonth: true });
  }
  // Next month padding to 42 cells
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ dateStr: toDateStr(new Date(year, month, i)), isCurrentMonth: false });
  }
  return days;
}

function getWeeksInRange(startDate: string, endDate: string): string[][] {
  const weeks: string[][] = [];
  const [ey, em, ed] = endDate.split('-').map(Number);
  const end = new Date(ey, em - 1, ed);
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const monday = getMonday(new Date(sy, sm - 1, sd));

  while (monday <= end) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(monday);
      dt.setDate(dt.getDate() + i);
      week.push(toDateStr(dt));
    }
    weeks.push(week);
    monday.setDate(monday.getDate() + 7);
  }
  return weeks;
}

function shortTime(time: string): string {
  return time.slice(0, 5);
}

function dateFromStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// --- Week grid constants ---

const GRID_START_MIN = 8 * 60;
const GRID_END_MIN = 22 * 60;
const HOUR_HEIGHT = 60;
const GRID_HEIGHT = ((GRID_END_MIN - GRID_START_MIN) / 60) * HOUR_HEIGHT; // 840px

function timeToTop(timeStr: string): number {
  const min = Math.max(parseTimeMinutes(timeStr), GRID_START_MIN);
  return ((min - GRID_START_MIN) / 60) * HOUR_HEIGHT;
}

function timeRangeToPx(startTime: string, endTime: string): number {
  const s = Math.max(parseTimeMinutes(startTime), GRID_START_MIN);
  const e = Math.min(parseTimeMinutes(endTime), GRID_END_MIN);
  return Math.max(0, ((e - s) / 60) * HOUR_HEIGHT);
}

// --- WeekGrid ---

interface WeekGridProps {
  dates: string[];
  schedule: Record<string, VenueScheduleDay>;
  canEdit: boolean;
  onSlotClick: (date: string, slot: VenueTimeSlot) => void;
  onAddBooking: (date: string) => void;
  onCancelBooking: (bookingId: number) => void;
}

function WeekGrid({ dates, schedule, canEdit, onSlotClick, onAddBooking, onCancelBooking }: WeekGridProps) {
  const today = todayStr();
  const hours = useMemo(() => {
    const h: string[] = [];
    for (let t = GRID_START_MIN; t < GRID_END_MIN; t += 60) {
      h.push(`${Math.floor(t / 60).toString().padStart(2, '0')}:00`);
    }
    return h;
  }, []);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Column headers */}
          <div className="flex border-b sticky top-0 bg-white z-10">
            <div className="w-14 flex-shrink-0 border-r" />
            {dates.map((dateStr) => {
              const d = dateFromStr(dateStr);
              const dayIdx = (d.getDay() + 6) % 7;
              const isToday = dateStr === today;
              return (
                <div
                  key={dateStr}
                  className={`flex-1 py-2 px-1 text-center border-r last:border-r-0 ${isToday ? 'bg-primary-50' : ''}`}
                >
                  <div className={`text-xs ${isToday ? 'text-primary-600' : 'text-gray-500'}`}>
                    {DAY_NAMES[dayIdx]}
                  </div>
                  <div className={`text-sm font-medium ${isToday ? 'text-primary-600' : 'text-gray-900'}`}>
                    {d.getMonth() + 1}/{d.getDate()}
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => onAddBooking(dateStr)}
                      className="mt-0.5 text-gray-300 hover:text-primary-500"
                      title="添加预订"
                    >
                      <Plus className="w-3.5 h-3.5 mx-auto" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="flex relative" style={{ height: `${GRID_HEIGHT}px` }}>
            {/* Time labels */}
            <div className="w-14 flex-shrink-0 border-r relative">
              {hours.map((time, i) => (
                <div
                  key={time}
                  className="absolute text-xs text-gray-400 text-right pr-2"
                  style={{ top: `${i * HOUR_HEIGHT}px`, transform: 'translateY(-50%)', right: 0, left: 0 }}
                >
                  {time}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {dates.map((dateStr) => {
              const isToday = dateStr === today;
              const day = schedule[dateStr];

              return (
                <div
                  key={dateStr}
                  className={`flex-1 border-r last:border-r-0 relative ${isToday ? 'bg-primary-50/30' : ''}`}
                >
                  {/* Hour lines */}
                  {hours.map((_, i) => (
                    <div key={i} className="border-b border-gray-100" style={{ height: `${HOUR_HEIGHT}px` }} />
                  ))}

                  {/* Available slots */}
                  {day?.available_slots?.map((slot, j) => {
                    const top = timeToTop(slot.start_time);
                    const height = timeRangeToPx(slot.start_time, slot.end_time);
                    if (height <= 0) return null;
                    return (
                      <div
                        key={`slot-${j}`}
                        className={`absolute left-0.5 right-0.5 bg-green-100/80 border border-green-300/60 rounded overflow-hidden ${
                          canEdit ? 'cursor-pointer hover:bg-green-200/80' : ''
                        }`}
                        style={{ top: `${top}px`, height: `${height}px` }}
                        onClick={() => canEdit && onSlotClick(dateStr, slot)}
                        title={canEdit ? `点击预订 ${shortTime(slot.start_time)}-${shortTime(slot.end_time)}` : `可用 ${shortTime(slot.start_time)}-${shortTime(slot.end_time)}`}
                      >
                        <div className="px-1 py-0.5 text-[10px] text-green-700 leading-tight">
                          <div className="font-medium">{shortTime(slot.start_time)}-{shortTime(slot.end_time)}</div>
                          {height >= 40 && <div className="text-green-600">可预订</div>}
                        </div>
                      </div>
                    );
                  })}

                  {/* Bookings */}
                  {day?.bookings?.map((booking: VenueBooking) => {
                    const top = timeToTop(booking.start_time);
                    const height = timeRangeToPx(booking.start_time, booking.end_time);
                    if (height <= 0) return null;
                    return (
                      <div
                        key={`booking-${booking.id}`}
                        className="absolute left-1 right-1 bg-blue-500 rounded overflow-hidden text-white group"
                        style={{ top: `${top}px`, height: `${height}px` }}
                        title={`${booking.program?.name || '预订'} ${shortTime(booking.start_time)}-${shortTime(booking.end_time)}`}
                      >
                        <div className="px-1.5 py-0.5 h-full flex flex-col relative">
                          {canEdit && (
                            <button
                              onClick={() => onCancelBooking(booking.id)}
                              className="absolute top-0.5 right-0.5 text-white/40 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              title="取消预订"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          <span className="text-xs font-semibold truncate leading-tight">
                            {booking.program?.name || '预订'}
                          </span>
                          {height >= 30 && (
                            <span className="text-[10px] text-white/80 leading-tight">
                              {shortTime(booking.start_time)}-{shortTime(booking.end_time)}
                            </span>
                          )}
                          {height >= 50 && booking.notes && (
                            <span className="text-[10px] text-white/60 truncate leading-tight">{booking.notes}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- MonthGrid ---

interface MonthGridProps {
  year: number;
  month: number;
  schedule: Record<string, VenueScheduleDay>;
  onDayClick: (dateStr: string) => void;
}

function MonthGrid({ year, month, schedule, onDayClick }: MonthGridProps) {
  const today = todayStr();
  const calendarDays = useMemo(() => getMonthCalendarDates(year, month), [year, month]);

  return (
    <div className="card overflow-hidden p-4">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px mb-2">
        {DAY_NAMES.map((name, i) => (
          <div
            key={name}
            className={`text-center text-sm font-medium py-2 ${i >= 5 ? 'text-red-500' : 'text-gray-700'}`}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded overflow-hidden">
        {calendarDays.map((day, idx) => {
          const dayData = schedule[day.dateStr];
          const isToday = day.dateStr === today;
          const dateObj = dateFromStr(day.dateStr);

          const items: { type: 'slot' | 'booking'; label: string }[] = [];
          dayData?.available_slots?.forEach((slot) => {
            items.push({ type: 'slot', label: `${shortTime(slot.start_time)}-${shortTime(slot.end_time)}` });
          });
          dayData?.bookings?.forEach((booking) => {
            items.push({ type: 'booking', label: booking.program?.name || '预订' });
          });

          return (
            <div
              key={idx}
              className={`bg-white min-h-[90px] p-1.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                !day.isCurrentMonth ? 'opacity-40' : ''
              }`}
              onClick={() => onDayClick(day.dateStr)}
            >
              <div
                className={`text-sm font-medium mb-1 ${
                  isToday
                    ? 'bg-primary-600 text-white w-6 h-6 rounded-full flex items-center justify-center'
                    : 'text-gray-900'
                }`}
              >
                {dateObj.getDate()}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((item, i) => (
                  <div
                    key={i}
                    className={`text-[10px] px-1 py-0.5 rounded truncate ${
                      item.type === 'slot'
                        ? 'bg-green-50 text-green-700 border-l-2 border-green-400'
                        : 'bg-blue-50 text-blue-700 border-l-2 border-blue-400'
                    }`}
                  >
                    {item.label}
                  </div>
                ))}
                {items.length > 3 && (
                  <div className="text-[10px] text-gray-500 px-1">+{items.length - 3} 更多</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- SemesterGrid ---

interface SemesterGridProps {
  semester: Semester;
  schedule: Record<string, VenueScheduleDay>;
  onDayClick: (dateStr: string) => void;
}

function SemesterGrid({ semester, schedule, onDayClick }: SemesterGridProps) {
  const today = todayStr();
  const weeks = useMemo(
    () => getWeeksInRange(semester.start_date, semester.end_date),
    [semester.start_date, semester.end_date],
  );

  const semStart = semester.start_date;
  const semEnd = semester.end_date;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-center border-b w-10 text-gray-400 font-medium">周</th>
              {DAY_NAMES.map((name) => (
                <th key={name} className="p-2 text-center border-b text-gray-700 font-medium">{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi} className="border-b last:border-b-0">
                <td className="p-1 text-center text-gray-400 border-r text-[10px]">{wi + 1}</td>
                {week.map((dateStr) => {
                  const isToday = dateStr === today;
                  const inSemester = dateStr >= semStart && dateStr <= semEnd;
                  const dayData = schedule[dateStr];
                  const d = dateFromStr(dateStr);
                  const slots = dayData?.available_slots || [];
                  const bookings = dayData?.bookings || [];

                  return (
                    <td
                      key={dateStr}
                      className={`p-1 border-r last:border-r-0 align-top cursor-pointer hover:bg-gray-50 transition-colors ${
                        !inSemester ? 'bg-gray-50/80' : ''
                      } ${isToday ? 'bg-primary-50' : ''}`}
                      style={{ minWidth: '80px' }}
                      onClick={() => onDayClick(dateStr)}
                    >
                      <div className={`text-[10px] font-medium ${
                        !inSemester ? 'text-gray-300' : isToday ? 'text-primary-600' : 'text-gray-600'
                      }`}>
                        {d.getMonth() + 1}/{d.getDate()}
                      </div>
                      {inSemester && slots.length > 0 && (
                        <div
                          className="mt-0.5 text-[9px] bg-green-100 text-green-700 rounded px-0.5 truncate"
                          title={slots.map(s => `${shortTime(s.start_time)}-${shortTime(s.end_time)}`).join(', ')}
                        >
                          {parseInt(slots[0].start_time)}-{parseInt(slots[slots.length - 1].end_time)}
                        </div>
                      )}
                      {inSemester && bookings.map((b) => (
                        <div
                          key={b.id}
                          className="mt-0.5 text-[9px] bg-blue-100 text-blue-700 rounded px-0.5 truncate"
                          title={`${b.program?.name || '预订'} ${shortTime(b.start_time)}-${shortTime(b.end_time)}`}
                        >
                          {(b.program?.name || '预订').slice(0, 4)}
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-2 bg-green-100 border border-green-300 rounded" /> 可用时段
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-2 bg-blue-100 border border-blue-300 rounded" /> 已预订
        </span>
        <span className="text-gray-400 ml-auto">点击日期查看周视图</span>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function VenueSchedule() {
  const navigate = useNavigate();
  const { id } = useParams();
  const venueId = parseInt(id || '0');

  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'committee');

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [weekStart, setWeekStart] = useState(() => getMondayStr(new Date()));
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [semester, setSemester] = useState<Semester | null>(null);

  // Data state
  const [venue, setVenue] = useState<Venue | null>(null);
  const [schedule, setSchedule] = useState<Record<string, VenueScheduleDay>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Booking modal state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [bookingForm, setBookingForm] = useState({
    program_id: '',
    start_time: '',
    end_time: '',
    notes: '',
  });
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isSavingBooking, setIsSavingBooking] = useState(false);

  // Time slots editing modal
  const [showTimeSlotsModal, setShowTimeSlotsModal] = useState(false);
  const [editingTimeSlots, setEditingTimeSlots] = useState<
    { day_of_week: number; start_time: string; end_time: string; is_available: boolean }[]
  >([]);
  const [isSavingTimeSlots, setIsSavingTimeSlots] = useState(false);

  // Derived
  const weekDates = useMemo(() => getWeekDateStrs(weekStart), [weekStart]);

  // Fetch semester on mount
  useEffect(() => {
    semestersApi.getCurrent().then((s) => setSemester(s)).catch(console.error);
  }, []);

  // Fetch programs once
  useEffect(() => {
    if (venueId) {
      programsApi.list({ status: 'active' }).then(setPrograms).catch(console.error);
    }
  }, [venueId]);

  // Fetch schedule when view/range changes
  useEffect(() => {
    if (!venueId) return;

    let startDate: string;
    let endDate: string;

    if (viewMode === 'week') {
      startDate = weekStart;
      const end = dateFromStr(weekStart);
      end.setDate(end.getDate() + 6);
      endDate = toDateStr(end);
    } else if (viewMode === 'month') {
      const calDays = getMonthCalendarDates(monthDate.year, monthDate.month);
      startDate = calDays[0].dateStr;
      endDate = calDays[calDays.length - 1].dateStr;
    } else {
      if (!semester) return;
      startDate = getMondayStr(dateFromStr(semester.start_date));
      const semEnd = dateFromStr(semester.end_date);
      const lastMonday = getMonday(semEnd);
      lastMonday.setDate(lastMonday.getDate() + 6);
      endDate = toDateStr(lastMonday);
    }

    setIsLoading(true);
    setError('');
    venuesApi.getSchedule(venueId, startDate, endDate)
      .then((data) => {
        setVenue(data.venue);
        setSchedule(data.schedule);
      })
      .catch((err: any) => {
        setError(err.response?.data?.error || '加载失败');
      })
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, viewMode, weekStart, monthDate.year, monthDate.month, semester?.id, refreshKey]);

  // Navigation
  const navigateWeek = (direction: number) => {
    const d = dateFromStr(weekStart);
    d.setDate(d.getDate() + direction * 7);
    setWeekStart(toDateStr(d));
  };

  const navigateMonth = (direction: number) => {
    setMonthDate((prev) => {
      let m = prev.month + direction;
      let y = prev.year;
      if (m < 1) { m = 12; y--; }
      if (m > 12) { m = 1; y++; }
      return { year: y, month: m };
    });
  };

  const goToToday = () => {
    const now = new Date();
    if (viewMode === 'week') {
      setWeekStart(getMondayStr(now));
    } else if (viewMode === 'month') {
      setMonthDate({ year: now.getFullYear(), month: now.getMonth() + 1 });
    }
  };

  const goToWeekOf = (dateStr: string) => {
    setWeekStart(getMondayStr(dateFromStr(dateStr)));
    setViewMode('week');
  };

  const handleViewChange = (mode: ViewMode) => {
    if (mode === 'month' && viewMode === 'week') {
      const d = dateFromStr(weekStart);
      setMonthDate({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    setViewMode(mode);
  };

  // Booking handlers
  const openBookingModal = (date: string, slot?: VenueTimeSlot) => {
    setSelectedDate(date);
    setBookingForm({
      program_id: '',
      start_time: slot?.start_time || '',
      end_time: slot?.end_time || '',
      notes: '',
    });
    setShowBookingModal(true);
  };

  const handleCreateBooking = async () => {
    if (!bookingForm.start_time || !bookingForm.end_time) {
      setError('请选择开始和结束时间');
      return;
    }
    setIsSavingBooking(true);
    setError('');
    try {
      await bookingsApi.create({
        venue_id: venueId,
        program_id: bookingForm.program_id ? parseInt(bookingForm.program_id) : undefined,
        date: selectedDate,
        start_time: bookingForm.start_time,
        end_time: bookingForm.end_time,
        notes: bookingForm.notes || undefined,
      });
      setShowBookingModal(false);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      setError(err.response?.data?.error || '预订失败');
    } finally {
      setIsSavingBooking(false);
    }
  };

  const handleCancelBooking = async (bookingId: number) => {
    if (!confirm('确定要取消此预订吗？')) return;
    try {
      await bookingsApi.cancel(bookingId);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      setError(err.response?.data?.error || '取消失败');
    }
  };

  // Time slots modal handlers
  const fetchTimeSlots = async () => {
    try {
      const timeSlots = await venuesApi.getTimeSlots(venueId);
      setEditingTimeSlots(
        timeSlots.map((ts) => ({
          day_of_week: ts.day_of_week,
          start_time: ts.start_time,
          end_time: ts.end_time,
          is_available: ts.is_available,
        })),
      );
    } catch (err) {
      console.error('Failed to load time slots', err);
    }
  };

  const openTimeSlotsModal = () => {
    fetchTimeSlots();
    setShowTimeSlotsModal(true);
  };

  const addTimeSlot = () => {
    setEditingTimeSlots([
      ...editingTimeSlots,
      { day_of_week: 0, start_time: '09:00', end_time: '12:00', is_available: true },
    ]);
  };

  const removeTimeSlot = (index: number) => {
    setEditingTimeSlots(editingTimeSlots.filter((_, i) => i !== index));
  };

  const updateTimeSlot = (index: number, field: string, value: string | number | boolean) => {
    const updated = [...editingTimeSlots];
    updated[index] = { ...updated[index], [field]: value };
    setEditingTimeSlots(updated);
  };

  const handleSaveTimeSlots = async () => {
    setIsSavingTimeSlots(true);
    setError('');
    try {
      await venuesApi.updateTimeSlots(venueId, editingTimeSlots);
      setShowTimeSlotsModal(false);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      setError(err.response?.data?.error || '保存失败');
    } finally {
      setIsSavingTimeSlots(false);
    }
  };

  // Initial loading state
  if (isLoading && !venue) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <span className="mt-3 block text-gray-500">加载中...</span>
      </div>
    );
  }

  // Format navigation text
  const weekRangeText = (() => {
    const d1 = dateFromStr(weekDates[0]);
    const d2 = dateFromStr(weekDates[6]);
    return `${d1.getMonth() + 1}月${d1.getDate()}日 - ${d2.getMonth() + 1}月${d2.getDate()}日`;
  })();

  return (
    <div className="space-y-4">
      {/* Header: back + title + tabs + settings */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/admin/venues')}
            className="mr-4 p-2 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{venue?.name} - 时间表</h1>
            {venue?.location && <p className="mt-1 text-sm text-gray-500">{venue.location}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* View tabs */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {(['week', 'month', 'semester'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleViewChange(mode)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {VIEW_LABELS[mode]}
              </button>
            ))}
          </div>
          {canEdit && (
            <button onClick={openTimeSlotsModal} className="btn-secondary">
              <Settings className="w-4 h-4 mr-2" />
              设置可用时间
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Navigation bar */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between">
            {viewMode === 'week' && (
              <>
                <button onClick={() => navigateWeek(-1)} className="p-2 text-gray-400 hover:text-gray-600">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{weekRangeText}</span>
                  <button onClick={goToToday} className="text-xs text-primary-600 hover:text-primary-700">
                    今天
                  </button>
                </div>
                <button onClick={() => navigateWeek(1)} className="p-2 text-gray-400 hover:text-gray-600">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
            {viewMode === 'month' && (
              <>
                <button onClick={() => navigateMonth(-1)} className="p-2 text-gray-400 hover:text-gray-600">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{monthDate.year}年 {monthDate.month}月</span>
                  <button onClick={goToToday} className="text-xs text-primary-600 hover:text-primary-700">
                    本月
                  </button>
                </div>
                <button onClick={() => navigateMonth(1)} className="p-2 text-gray-400 hover:text-gray-600">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
            {viewMode === 'semester' && (
              <div className="w-full text-center">
                {semester ? (
                  <span className="font-medium">
                    {semester.name}
                    <span className="text-sm text-gray-500 ml-2">
                      ({dateFromStr(semester.start_date).getMonth() + 1}/{dateFromStr(semester.start_date).getDate()}
                      {' - '}
                      {dateFromStr(semester.end_date).getMonth() + 1}/{dateFromStr(semester.end_date).getDate()})
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-500">暂无当前学期信息</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      )}

      {/* View content */}
      {!isLoading && viewMode === 'week' && (
        <WeekGrid
          dates={weekDates}
          schedule={schedule}
          canEdit={canEdit}
          onSlotClick={(date, slot) => openBookingModal(date, slot)}
          onAddBooking={(date) => openBookingModal(date)}
          onCancelBooking={handleCancelBooking}
        />
      )}

      {!isLoading && viewMode === 'month' && (
        <MonthGrid
          year={monthDate.year}
          month={monthDate.month}
          schedule={schedule}
          onDayClick={goToWeekOf}
        />
      )}

      {!isLoading && viewMode === 'semester' && semester && (
        <SemesterGrid
          semester={semester}
          schedule={schedule}
          onDayClick={goToWeekOf}
        />
      )}

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">
                创建预订 - {dateFromStr(selectedDate).toLocaleDateString('zh-CN')}
              </h3>
              <button
                onClick={() => setShowBookingModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="form-label">关联节目</label>
                <select
                  className="form-input"
                  value={bookingForm.program_id}
                  onChange={(e) =>
                    setBookingForm({ ...bookingForm, program_id: e.target.value })
                  }
                >
                  <option value="">不关联节目</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">开始时间 *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={bookingForm.start_time}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, start_time: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="form-label">结束时间 *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={bookingForm.end_time}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, end_time: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div>
                <label className="form-label">备注</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={bookingForm.notes}
                  onChange={(e) =>
                    setBookingForm({ ...bookingForm, notes: e.target.value })
                  }
                  placeholder="可选"
                />
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 p-4 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setShowBookingModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleCreateBooking}
                className="btn-primary"
                disabled={isSavingBooking}
              >
                {isSavingBooking ? '创建中...' : '创建预订'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Slots Modal */}
      {showTimeSlotsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">设置可用时间段</h3>
              <button
                onClick={() => setShowTimeSlotsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-sm text-gray-500 mb-4">
                设置本学期每周的可用时间段，这些时间段会显示在时间表上供预订。
              </p>
              <div className="space-y-3">
                {editingTimeSlots.map((slot, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                    <select
                      className="form-input w-28"
                      value={slot.day_of_week}
                      onChange={(e) =>
                        updateTimeSlot(index, 'day_of_week', parseInt(e.target.value))
                      }
                    >
                      {DAY_NAMES.map((name, i) => (
                        <option key={i} value={i}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      className="form-input w-28"
                      value={slot.start_time}
                      onChange={(e) => updateTimeSlot(index, 'start_time', e.target.value)}
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="time"
                      className="form-input w-28"
                      value={slot.end_time}
                      onChange={(e) => updateTimeSlot(index, 'end_time', e.target.value)}
                    />
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="form-checkbox"
                        checked={slot.is_available}
                        onChange={(e) =>
                          updateTimeSlot(index, 'is_available', e.target.checked)
                        }
                      />
                      <span className="ml-2 text-sm text-gray-600">可用</span>
                    </label>
                    <button
                      onClick={() => removeTimeSlot(index)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addTimeSlot}
                className="mt-3 text-sm text-primary-600 hover:text-primary-700 flex items-center"
              >
                <Plus className="w-4 h-4 mr-1" />
                添加时间段
              </button>
            </div>
            <div className="flex items-center justify-end space-x-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowTimeSlotsModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleSaveTimeSlots}
                className="btn-primary"
                disabled={isSavingTimeSlots}
              >
                {isSavingTimeSlots ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
