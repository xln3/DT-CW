import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  AlertCircle,
  Settings,
  Upload,
  Download,
  XCircle,
  MapPin,
  Edit2,
  Trash2,
} from 'lucide-react';
import { venuesApi, rehearsalsApi, semestersApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { usePrograms, rehearsalKeys } from '../../hooks';
import { useQueryClient } from '@tanstack/react-query';
import type { VenueScheduleDay, Rehearsal, Semester } from '../../types';
import { DAY_NAMES } from '../../types';

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

  for (let i = startWeekday - 1; i >= 0; i--) {
    days.push({ dateStr: toDateStr(new Date(year, month - 1, -i)), isCurrentMonth: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ dateStr: toDateStr(new Date(year, month - 1, i)), isCurrentMonth: true });
  }
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
const GRID_HEIGHT = ((GRID_END_MIN - GRID_START_MIN) / 60) * HOUR_HEIGHT;

function timeToTop(timeStr: string): number {
  const min = Math.max(parseTimeMinutes(timeStr), GRID_START_MIN);
  return ((min - GRID_START_MIN) / 60) * HOUR_HEIGHT;
}

function timeRangeToPx(startTime: string, endTime: string): number {
  const s = Math.max(parseTimeMinutes(startTime), GRID_START_MIN);
  const e = Math.min(parseTimeMinutes(endTime), GRID_END_MIN);
  return Math.max(0, ((e - s) / 60) * HOUR_HEIGHT);
}

// Build a lookup: dateStr -> Rehearsal[]
function groupRehearsalsByDate(rehearsals: Rehearsal[]): Record<string, Rehearsal[]> {
  const map: Record<string, Rehearsal[]> = {};
  for (const r of rehearsals) {
    const d = r.scheduled_date;
    if (!map[d]) map[d] = [];
    map[d].push(r);
  }
  return map;
}

// --- WeekGrid ---

interface WeekGridProps {
  dates: string[];
  schedule: Record<string, VenueScheduleDay>;
  rehearsalsByDate: Record<string, Rehearsal[]>;
  onRehearsalClick: (r: Rehearsal) => void;
}

function WeekGrid({ dates, schedule, rehearsalsByDate, onRehearsalClick }: WeekGridProps) {
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
              const dayRehearsals = rehearsalsByDate[dateStr] || [];

              return (
                <div
                  key={dateStr}
                  className={`flex-1 border-r last:border-r-0 relative bg-gray-200`}
                >
                  {/* Hour lines */}
                  {hours.map((_, i) => (
                    <div key={i} className="border-b border-gray-300/50" style={{ height: `${HOUR_HEIGHT}px` }} />
                  ))}

                  {/* Today highlight */}
                  {isToday && (
                    <div className="absolute inset-0 bg-primary-50/30 pointer-events-none" />
                  )}

                  {/* Available slots = white blocks on gray bg */}
                  {day?.available_slots?.map((slot, j) => {
                    const top = timeToTop(slot.start_time);
                    const height = timeRangeToPx(slot.start_time, slot.end_time);
                    if (height <= 0) return null;
                    return (
                      <div
                        key={`slot-${j}`}
                        className="absolute left-0 right-0 bg-white"
                        style={{ top: `${top}px`, height: `${height}px` }}
                      />
                    );
                  })}

                  {/* Rehearsal events */}
                  {dayRehearsals.map((rehearsal) => {
                    if (!rehearsal.scheduled_start_time || !rehearsal.scheduled_end_time) return null;
                    if (rehearsal.status === 'cancelled') return null;
                    const top = timeToTop(rehearsal.scheduled_start_time);
                    const height = timeRangeToPx(rehearsal.scheduled_start_time, rehearsal.scheduled_end_time);
                    if (height <= 0) return null;

                    const color = rehearsal.program_color || '#6B7280';
                    return (
                      <div
                        key={`reh-${rehearsal.id}`}
                        className="absolute left-0.5 right-0.5 rounded overflow-hidden cursor-pointer group shadow-sm hover:shadow-md transition-shadow"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          backgroundColor: color,
                        }}
                        onClick={() => onRehearsalClick(rehearsal)}
                        title={`${rehearsal.program_name} ${shortTime(rehearsal.scheduled_start_time!)}-${shortTime(rehearsal.scheduled_end_time!)}`}
                      >
                        <div className="px-1.5 py-0.5 h-full flex flex-col text-white">
                          <span className="text-xs font-semibold truncate leading-tight">
                            {rehearsal.program_name}
                          </span>
                          {height >= 30 && (
                            <span className="text-[10px] text-white/80 leading-tight">
                              {shortTime(rehearsal.scheduled_start_time!)}-{shortTime(rehearsal.scheduled_end_time!)}
                            </span>
                          )}
                          {height >= 50 && rehearsal.teacher_name && (
                            <span className="text-[10px] text-white/70 truncate leading-tight">
                              {rehearsal.teacher_name}
                            </span>
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
  rehearsalsByDate: Record<string, Rehearsal[]>;
  onDayClick: (dateStr: string) => void;
}

function MonthGrid({ year, month, rehearsalsByDate, onDayClick }: MonthGridProps) {
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
          const isToday = day.dateStr === today;
          const dateObj = dateFromStr(day.dateStr);
          const dayRehearsals = (rehearsalsByDate[day.dateStr] || []).filter(r => r.status !== 'cancelled');

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
                {dayRehearsals.slice(0, 3).map((r) => (
                  <div
                    key={r.id}
                    className="text-[10px] px-1 py-0.5 rounded truncate text-white"
                    style={{ backgroundColor: r.program_color || '#6B7280' }}
                  >
                    {r.program_name}
                  </div>
                ))}
                {dayRehearsals.length > 3 && (
                  <div className="text-[10px] text-gray-500 px-1">+{dayRehearsals.length - 3} 更多</div>
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
  rehearsalsByDate: Record<string, Rehearsal[]>;
  onDayClick: (dateStr: string) => void;
}

function SemesterGrid({ semester, rehearsalsByDate, onDayClick }: SemesterGridProps) {
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
                  const d = dateFromStr(dateStr);
                  const dayRehearsals = (rehearsalsByDate[dateStr] || []).filter(r => r.status !== 'cancelled');

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
                      {inSemester && dayRehearsals.map((r) => (
                        <div
                          key={r.id}
                          className="mt-0.5 text-[9px] rounded px-0.5 truncate text-white"
                          style={{ backgroundColor: r.program_color || '#6B7280' }}
                          title={`${r.program_name} ${r.scheduled_start_time ? shortTime(r.scheduled_start_time) : ''}-${r.scheduled_end_time ? shortTime(r.scheduled_end_time) : ''}`}
                        >
                          {r.program_name!.slice(0, 4)}
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
      <div className="flex items-center gap-4 px-4 py-2 border-t text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-2 bg-gray-200 border border-gray-300 rounded" /> 不可用
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-2 bg-white border border-gray-300 rounded" /> 可用时段
        </span>
        <span className="text-gray-400 ml-auto">点击日期查看周视图</span>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function RehearsalHall() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'committee', 'program_manager');
  const canManageVenue = hasRole('admin', 'committee');
  const queryClient = useQueryClient();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [weekStart, setWeekStart] = useState(() => getMondayStr(new Date()));
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [semester, setSemester] = useState<Semester | null>(null);

  // Data state
  const [venueId, setVenueId] = useState<number | null>(null);
  const [venues, setVenues] = useState<{ id: number; name: string; location?: string; is_active: boolean }[]>([]);
  const [showVenueMenu, setShowVenueMenu] = useState(false);
  const [schedule, setSchedule] = useState<Record<string, VenueScheduleDay>>({});
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Program filter
  const [programFilter, setProgramFilter] = useState<number | ''>('');
  const { data: programs = [] } = usePrograms({ status: 'active' });

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    created?: number;
    errors?: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Time slots editing modal
  const [showTimeSlotsModal, setShowTimeSlotsModal] = useState(false);
  const [editingTimeSlots, setEditingTimeSlots] = useState<
    { day_of_week: number; start_time: string; end_time: string; is_available: boolean }[]
  >([]);
  const [isSavingTimeSlots, setIsSavingTimeSlots] = useState(false);

  // Derived
  const weekDates = useMemo(() => getWeekDateStrs(weekStart), [weekStart]);

  // Fetch venue + semester on mount
  useEffect(() => {
    Promise.all([
      venuesApi.list(),
      semestersApi.getCurrent(),
    ]).then(([allVenues, sem]) => {
      setVenues(allVenues);
      const active = allVenues.filter((v) => v.is_active);
      if (active.length > 0) setVenueId(active[0].id);
      if (sem) setSemester(sem);
    }).catch(console.error);
  }, []);

  // Fetch schedule + rehearsals when view/range changes
  useEffect(() => {
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

    const venuePromise = venueId
      ? venuesApi.getSchedule(venueId, startDate, endDate).then((data) => data.schedule)
      : Promise.resolve({} as Record<string, VenueScheduleDay>);

    const rehearsalPromise = rehearsalsApi.list({
      program_id: programFilter || undefined,
      date_from: startDate,
      date_to: endDate,
    });

    Promise.all([venuePromise, rehearsalPromise])
      .then(([sched, rehs]) => {
        setSchedule(sched);
        setRehearsals(rehs);
      })
      .catch((err: any) => {
        setError(err.response?.data?.error || '加载失败');
      })
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, viewMode, weekStart, monthDate.year, monthDate.month, semester?.id, refreshKey, programFilter]);

  // Grouped rehearsals for calendar views
  const rehearsalsByDate = useMemo(() => groupRehearsalsByDate(rehearsals), [rehearsals]);

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

  const handleRehearsalClick = (rehearsal: Rehearsal) => {
    navigate(`/admin/rehearsals/${rehearsal.id}`);
  };

  // Import handlers
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);
    setError('');

    try {
      const result = await rehearsalsApi.importCsv(file);
      setImportResult({
        success: true,
        created: result.created_count,
        errors: result.errors,
      });
      await queryClient.invalidateQueries({ queryKey: rehearsalKeys.lists() });
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      setImportResult({
        success: false,
        errors: [err.response?.data?.error || '导入失败'],
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = () => {
    window.open(rehearsalsApi.downloadTemplate(), '_blank');
  };

  // Time slots modal handlers
  const fetchTimeSlots = async () => {
    if (!venueId) return;
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
    if (!venueId) return;
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

  const handleDeleteVenue = async (id: number) => {
    if (!confirm('确定要删除此场地吗？')) return;
    try {
      await venuesApi.delete(id);
      setVenues(venues.filter((v) => v.id !== id));
      if (venueId === id) {
        const remaining = venues.filter((v) => v.id !== id && v.is_active);
        setVenueId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '删除失败');
    }
  };

  // Format navigation text
  const weekRangeText = (() => {
    const d1 = dateFromStr(weekDates[0]);
    const d2 = dateFromStr(weekDates[6]);
    return `${d1.getMonth() + 1}月${d1.getDate()}日 - ${d2.getMonth() + 1}月${d2.getDate()}日`;
  })();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">排练厅使用时间</h1>
        <div className="flex items-center gap-2 flex-wrap">
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

          {/* Program filter */}
          <select
            className="form-input py-1 text-sm w-32"
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">全部节目</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {canEdit && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".csv"
                className="hidden"
              />
              <button
                onClick={handleDownloadTemplate}
                className="btn-secondary py-1 text-sm"
                title="下载导入模板"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary py-1 text-sm"
                disabled={isImporting}
              >
                <Upload className="w-4 h-4" />
              </button>
              <Link to="/admin/rehearsals/new" className="btn-primary py-1 text-sm">
                <Plus className="w-4 h-4 mr-1" />
                创建排练
              </Link>
            </>
          )}

          {canManageVenue && (
            <>
              {venueId && (
                <button onClick={openTimeSlotsModal} className="btn-secondary py-1 text-sm" title="设置可用时间">
                  <Settings className="w-4 h-4" />
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowVenueMenu(!showVenueMenu)}
                  className="btn-secondary py-1 text-sm"
                  title="场地管理"
                >
                  <MapPin className="w-4 h-4" />
                </button>
                {showVenueMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowVenueMenu(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                      <div className="py-1">
                        <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase border-b">场地管理</div>
                        {venues.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500">暂无场地</div>
                        ) : (
                          venues.map((v) => (
                            <div key={v.id} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{v.name}</div>
                                {v.location && <div className="text-xs text-gray-500 truncate">{v.location}</div>}
                              </div>
                              <div className="flex items-center space-x-1 ml-2">
                                <Link
                                  to={`/admin/venues/${v.id}/edit`}
                                  className="p-1 text-gray-400 hover:text-primary-600"
                                  onClick={() => setShowVenueMenu(false)}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Link>
                                <button
                                  onClick={() => { handleDeleteVenue(v.id); setShowVenueMenu(false); }}
                                  className="p-1 text-gray-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                        <div className="border-t">
                          <Link
                            to="/admin/venues/new"
                            className="flex items-center px-4 py-2 text-sm text-primary-600 hover:bg-gray-50"
                            onClick={() => setShowVenueMenu(false)}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            添加场地
                          </Link>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
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

      {/* Import result */}
      {importResult && (
        <div className={`border rounded-md p-4 ${importResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {importResult.success ? (
                <p className="text-sm text-green-700">
                  成功导入 {importResult.created} 条排练记录
                  {importResult.errors && importResult.errors.length > 0 && (
                    <span className="text-yellow-700">（部分行有错误）</span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-red-700">导入失败</p>
              )}
              {importResult.errors && importResult.errors.length > 0 && (
                <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
                  {importResult.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
            <button onClick={() => setImportResult(null)} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Navigation bar */}
      <div className="card">
        <div className="card-body py-2">
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

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <span className="mt-3 block text-gray-500">加载中...</span>
        </div>
      )}

      {/* View content */}
      {!isLoading && viewMode === 'week' && (
        <WeekGrid
          dates={weekDates}
          schedule={schedule}
          rehearsalsByDate={rehearsalsByDate}
          onRehearsalClick={handleRehearsalClick}
        />
      )}

      {!isLoading && viewMode === 'month' && (
        <MonthGrid
          year={monthDate.year}
          month={monthDate.month}
          rehearsalsByDate={rehearsalsByDate}
          onDayClick={goToWeekOf}
        />
      )}

      {!isLoading && viewMode === 'semester' && semester && (
        <SemesterGrid
          semester={semester}
          rehearsalsByDate={rehearsalsByDate}
          onDayClick={goToWeekOf}
        />
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
                设置本学期每周的可用时间段，这些时间段会显示在周视图上（白色区域）。
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
                        <option key={i} value={i}>{name}</option>
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
