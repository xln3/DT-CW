import React, { useState, useEffect } from 'react';
import type { CalendarEvent, EventType, Program } from '../../../types';
import { calendarApi, programsApi } from '../../../services/api';
import { Calendar, Clock, MapPin, AlertCircle, Bell, Repeat, X } from 'lucide-react';

interface EventFormProps {
  event?: CalendarEvent;
  onSave: () => void;
  onCancel: () => void;
}

const EventForm: React.FC<EventFormProps> = ({ event, onSave, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);

  const [formData, setFormData] = useState({
    event_type_id: event?.event_type.id || 0,
    title: event?.title || '',
    description: event?.description || '',
    program_id: event?.program?.id || undefined,
    start_date: event?.start_date || new Date().toISOString().split('T')[0],
    end_date: event?.end_date || '',
    start_time: event?.start_time || '',
    end_time: event?.end_time || '',
    is_all_day: event?.is_all_day || false,
    location: event?.location || '',
    is_recurring: event?.is_recurring || false,
    recurrence_rule: event?.recurrence_rule || '',
    reminder_minutes: event?.reminder_minutes || 30,
    notify_members: event?.notify_members || false,
  });

  useEffect(() => {
    loadEventTypes();
    loadPrograms();
  }, []);

  const loadEventTypes = async () => {
    try {
      const types = await calendarApi.getEventTypes();
      setEventTypes(types);
      if (!event && types.length > 0) {
        setFormData(prev => ({ ...prev, event_type_id: types[0].id }));
      }
    } catch (err) {
      console.error('Load event types error:', err);
    }
  };

  const loadPrograms = async () => {
    try {
      const data = await programsApi.list();
      setPrograms(data);
    } catch (err) {
      console.error('Load programs error:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const submitData = {
        ...formData,
        program_id: formData.program_id || undefined,
        end_date: formData.end_date || undefined,
        start_time: formData.is_all_day ? undefined : formData.start_time || undefined,
        end_time: formData.is_all_day ? undefined : formData.end_time || undefined,
        recurrence_rule: formData.is_recurring ? formData.recurrence_rule : undefined,
      };

      if (event) {
        await calendarApi.update(event.id, submitData);
      } else {
        await calendarApi.create(submitData);
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.error || '保存失败');
      console.error('Save event error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {event ? '编辑事件' : '创建事件'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              事件类型 *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {eventTypes.map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleChange('event_type_id', type.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.event_type_id === type.id
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{type.icon}</span>
                    <span className="font-medium" style={{ color: type.color }}>
                      {type.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              标题 *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="form-input"
              placeholder="输入事件标题"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="form-input"
              rows={3}
              placeholder="输入事件描述（可选）"
            />
          </div>

          {/* Program */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              关联节目
            </label>
            <select
              value={formData.program_id || ''}
              onChange={(e) => handleChange('program_id', e.target.value ? Number(e.target.value) : undefined)}
              className="form-input"
            >
              <option value="">无关联节目</option>
              {programs.map(program => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                开始日期 *
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
                className="form-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                结束日期
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => handleChange('end_date', e.target.value)}
                className="form-input"
                min={formData.start_date}
              />
            </div>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_all_day"
              checked={formData.is_all_day}
              onChange={(e) => handleChange('is_all_day', e.target.checked)}
              className="h-4 w-4 text-primary-600 rounded border-gray-300"
            />
            <label htmlFor="is_all_day" className="ml-2 text-sm text-gray-700">
              全天事件
            </label>
          </div>

          {/* Time Range (if not all day) */}
          {!formData.is_all_day && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="inline h-4 w-4 mr-1" />
                  开始时间
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => handleChange('start_time', e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="inline h-4 w-4 mr-1" />
                  结束时间
                </label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => handleChange('end_time', e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="inline h-4 w-4 mr-1" />
              地点
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              className="form-input"
              placeholder="输入地点（可选）"
            />
          </div>

          {/* Recurring */}
          <div>
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                id="is_recurring"
                checked={formData.is_recurring}
                onChange={(e) => handleChange('is_recurring', e.target.checked)}
                className="h-4 w-4 text-primary-600 rounded border-gray-300"
              />
              <label htmlFor="is_recurring" className="ml-2 text-sm text-gray-700">
                <Repeat className="inline h-4 w-4 mr-1" />
                重复事件
              </label>
            </div>
            {formData.is_recurring && (
              <input
                type="text"
                value={formData.recurrence_rule}
                onChange={(e) => handleChange('recurrence_rule', e.target.value)}
                className="form-input"
                placeholder="例如: FREQ=WEEKLY;BYDAY=MO,WE,FR"
              />
            )}
          </div>

          {/* Reminder */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Bell className="inline h-4 w-4 mr-1" />
              提醒时间（分钟）
            </label>
            <select
              value={formData.reminder_minutes}
              onChange={(e) => handleChange('reminder_minutes', Number(e.target.value))}
              className="form-input"
            >
              <option value={0}>无提醒</option>
              <option value={15}>15分钟前</option>
              <option value={30}>30分钟前</option>
              <option value={60}>1小时前</option>
              <option value={1440}>1天前</option>
            </select>
          </div>

          {/* Notify Members */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="notify_members"
              checked={formData.notify_members}
              onChange={(e) => handleChange('notify_members', e.target.checked)}
              className="h-4 w-4 text-primary-600 rounded border-gray-300"
            />
            <label htmlFor="notify_members" className="ml-2 text-sm text-gray-700">
              通知相关成员
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? '保存中...' : event ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventForm;
