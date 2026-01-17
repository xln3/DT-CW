import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  AlertCircle,
  Settings,
  Clock,
} from 'lucide-react';
import { venuesApi, bookingsApi, programsApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { Venue, VenueScheduleDay, VenueTimeSlot, VenueBooking, Program } from '../../../types';
import { DAY_NAMES } from '../../../types';

export default function VenueSchedule() {
  const navigate = useNavigate();
  const { id } = useParams();
  const venueId = parseInt(id || '0');

  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'committee');

  const [venue, setVenue] = useState<Venue | null>(null);
  const [schedule, setSchedule] = useState<Record<string, VenueScheduleDay>>({});
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return monday.toISOString().split('T')[0];
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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

  const fetchSchedule = async () => {
    setIsLoading(true);
    setError('');
    try {
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);

      const data = await venuesApi.getSchedule(
        venueId,
        startDate,
        endDate.toISOString().split('T')[0]
      );
      setVenue(data.venue);
      setSchedule(data.schedule);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPrograms = async () => {
    try {
      const data = await programsApi.list({ status: 'active' });
      setPrograms(data);
    } catch (err) {
      console.error('Failed to load programs', err);
    }
  };

  const fetchTimeSlots = async () => {
    try {
      const timeSlots = await venuesApi.getTimeSlots(venueId);
      setEditingTimeSlots(
        timeSlots.map((ts) => ({
          day_of_week: ts.day_of_week,
          start_time: ts.start_time,
          end_time: ts.end_time,
          is_available: ts.is_available,
        }))
      );
    } catch (err) {
      console.error('Failed to load time slots', err);
    }
  };

  useEffect(() => {
    if (venueId) {
      fetchSchedule();
      fetchPrograms();
    }
  }, [venueId, startDate]);

  const navigateWeek = (direction: number) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + direction * 7);
    setStartDate(date.toISOString().split('T')[0]);
  };

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
      fetchSchedule();
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
      fetchSchedule();
    } catch (err: any) {
      setError(err.response?.data?.error || '取消失败');
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

  const updateTimeSlot = (
    index: number,
    field: string,
    value: string | number | boolean
  ) => {
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
      fetchSchedule();
    } catch (err: any) {
      setError(err.response?.data?.error || '保存失败');
    } finally {
      setIsSavingTimeSlots(false);
    }
  };

  const getWeekDates = () => {
    const dates = [];
    const current = new Date(startDate);
    for (let i = 0; i < 7; i++) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  if (isLoading && !venue) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <span className="mt-3 block text-gray-500">加载中...</span>
      </div>
    );
  }

  const weekDates = getWeekDates();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/admin/venues')}
            className="mr-4 p-2 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{venue?.name} - 时间表</h1>
            <p className="mt-1 text-sm text-gray-500">{venue?.location}</p>
          </div>
        </div>
        {canEdit && (
          <button onClick={openTimeSlotsModal} className="btn-secondary">
            <Settings className="w-4 h-4 mr-2" />
            设置可用时间
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Week Navigation */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <span className="font-medium">
                {weekDates[0].toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                {' - '}
                {weekDates[6].toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
              </span>
            </div>
            <button
              onClick={() => navigateWeek(1)}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                {weekDates.map((date, i) => {
                  const dateStr = date.toISOString().split('T')[0];
                  const isToday = dateStr === new Date().toISOString().split('T')[0];
                  return (
                    <th
                      key={i}
                      className={`p-3 text-center border-b min-w-[140px] ${
                        isToday ? 'bg-primary-50' : ''
                      }`}
                    >
                      <div className="text-xs text-gray-500">{DAY_NAMES[i]}</div>
                      <div className={`font-medium ${isToday ? 'text-primary-600' : ''}`}>
                        {date.getMonth() + 1}/{date.getDate()}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                {weekDates.map((date, i) => {
                  const dateStr = date.toISOString().split('T')[0];
                  const daySchedule = schedule[dateStr];

                  return (
                    <td key={i} className="p-2 border-b align-top min-h-[200px]">
                      <div className="space-y-2">
                        {/* Available slots */}
                        {daySchedule?.available_slots?.map((slot, j) => (
                          <div
                            key={`slot-${j}`}
                            className="p-2 bg-green-50 border border-green-200 rounded text-xs cursor-pointer hover:bg-green-100"
                            onClick={() => canEdit && openBookingModal(dateStr, slot)}
                          >
                            <div className="flex items-center text-green-700">
                              <Clock className="w-3 h-3 mr-1" />
                              {slot.start_time} - {slot.end_time}
                            </div>
                            <div className="text-green-600 mt-1">可预订</div>
                          </div>
                        ))}

                        {/* Bookings */}
                        {daySchedule?.bookings?.map((booking: VenueBooking) => (
                          <div
                            key={`booking-${booking.id}`}
                            className="p-2 bg-blue-50 border border-blue-200 rounded text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center text-blue-700">
                                <Clock className="w-3 h-3 mr-1" />
                                {booking.start_time} - {booking.end_time}
                              </div>
                              {canEdit && (
                                <button
                                  onClick={() => handleCancelBooking(booking.id)}
                                  className="text-gray-400 hover:text-red-500"
                                  title="取消预订"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <div className="text-blue-800 font-medium mt-1">
                              {booking.program?.name || '预订'}
                            </div>
                            {booking.notes && (
                              <div className="text-gray-500 mt-1 line-clamp-1">
                                {booking.notes}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Add booking button */}
                        {canEdit && (
                          <button
                            onClick={() => openBookingModal(dateStr)}
                            className="w-full p-2 border-2 border-dashed border-gray-200 rounded text-gray-400 hover:border-primary-300 hover:text-primary-600 text-xs flex items-center justify-center"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            添加预订
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">
                创建预订 - {new Date(selectedDate).toLocaleDateString('zh-CN')}
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
