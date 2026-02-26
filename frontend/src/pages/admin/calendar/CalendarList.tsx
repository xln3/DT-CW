import React, { useState, useEffect } from 'react';
import type { CalendarEvent, EventType } from '../../../types';
import { calendarApi } from '../../../services/api';
import EventForm from './EventForm';
import { Calendar, Plus, Edit, Trash2, Send, AlertCircle, Filter, X } from 'lucide-react';

const CalendarList: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>();

  // Filters
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    event_type_id: undefined as number | undefined,
    status: 'active' as string,
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadEventTypes();
    loadEvents();
  }, []);

  useEffect(() => {
    loadEvents();
  }, [filters]);

  const loadEventTypes = async () => {
    try {
      const types = await calendarApi.getEventTypes();
      setEventTypes(types);
    } catch (err) {
      console.error('Load event types error:', err);
    }
  };

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await calendarApi.list(filters);
      setEvents(data);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
      console.error('Load events error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingEvent(undefined);
    setShowForm(true);
  };

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个事件吗？')) return;

    try {
      await calendarApi.delete(id);
      loadEvents();
    } catch (err: any) {
      alert(err.response?.data?.error || '删除失败');
      console.error('Delete event error:', err);
    }
  };

  const handleSendNotification = async (event: CalendarEvent) => {
    if (!confirm(`确定要发送通知给相关成员吗？\n\n事件: ${event.title}`)) return;

    try {
      await calendarApi.sendNotification(event.id);
      alert('通知已发送');
      loadEvents();
    } catch (err: any) {
      alert(err.response?.data?.error || '发送失败');
      console.error('Send notification error:', err);
    }
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingEvent(undefined);
    loadEvents();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingEvent(undefined);
  };

  const handleFilterChange = (field: string, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      start_date: '',
      end_date: '',
      event_type_id: undefined,
      status: 'active',
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  };

  const formatTime = (event: CalendarEvent) => {
    if (event.is_all_day) return '全天';
    if (event.start_time) {
      const end = event.end_time ? ` - ${event.end_time.slice(0, 5)}` : '';
      return `${event.start_time.slice(0, 5)}${end}`;
    }
    return '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">队历管理</h1>
          <p className="text-sm text-gray-600 mt-1">管理艺术团的演出、排练和其他活动</p>
        </div>
        <button onClick={handleCreate} className="btn-primary">
          <Plus className="h-5 w-5 mr-2" />
          创建事件
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <span className="font-medium text-gray-900">筛选</span>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            {showFilters ? '收起' : '展开'}
          </button>
        </div>

        {showFilters && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  开始日期
                </label>
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  结束日期
                </label>
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Event Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  事件类型
                </label>
                <select
                  value={filters.event_type_id || ''}
                  onChange={(e) => handleFilterChange('event_type_id', e.target.value ? Number(e.target.value) : undefined)}
                  className="form-input"
                >
                  <option value="">全部类型</option>
                  {eventTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.icon} {type.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  状态
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="form-input"
                >
                  <option value="active">进行中</option>
                  <option value="cancelled">已取消</option>
                  <option value="completed">已完成</option>
                  <option value="">全部状态</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={clearFilters} className="btn-secondary text-sm">
                <X className="h-4 w-4 mr-1" />
                清除筛选
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Events List */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">加载中...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">暂无事件</p>
            <button onClick={handleCreate} className="btn-primary mt-4">
              <Plus className="h-5 w-5 mr-2" />
              创建第一个事件
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {events.map((event) => (
              <div key={event.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-2xl">{event.event_type.icon}</span>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {event.title}
                      </h3>
                      <span
                        className="text-xs px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: event.event_type.color + '20',
                          color: event.event_type.color,
                        }}
                      >
                        {event.event_type.name}
                      </span>
                      {event.status === 'cancelled' && (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">
                          已取消
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-gray-600 mb-3">
                      <div>
                        <Calendar className="inline h-4 w-4 mr-2" />
                        {formatDate(event.start_date)}
                        {event.end_date && event.end_date !== event.start_date && (
                          <> - {formatDate(event.end_date)}</>
                        )}
                        {!event.is_all_day && event.start_time && (
                          <> · {formatTime(event)}</>
                        )}
                      </div>
                      {event.location && (
                        <div>
                          📍 {event.location}
                        </div>
                      )}
                      {event.program && (
                        <div>
                          🎭 {event.program.name}
                        </div>
                      )}
                      {event.is_recurring && (
                        <div className="text-primary-600">
                          🔁 重复事件
                        </div>
                      )}
                    </div>

                    {event.description && (
                      <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                        {event.description}
                      </p>
                    )}

                    {event.notify_members && (
                      <div className="flex items-center space-x-2 text-xs">
                        {event.notification_sent ? (
                          <span className="text-green-600">✓ 通知已发送</span>
                        ) : (
                          <span className="text-amber-600">⏳ 待发送通知</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {event.notify_members && !event.notification_sent && (
                      <button
                        onClick={() => handleSendNotification(event)}
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                        title="发送通知"
                      >
                        <Send className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(event)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                      title="编辑"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="删除"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event Form Modal */}
      {showForm && (
        <EventForm
          event={editingEvent}
          onSave={handleFormSave}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  );
};

export default CalendarList;
