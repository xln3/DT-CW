import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, AlertCircle, Calendar, MapPin, Users } from 'lucide-react';
import { venuesApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { Venue } from '../../../types';

export default function VenueList() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'committee');

  const fetchVenues = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await venuesApi.list({
        is_active: showInactive ? undefined : true,
      });
      setVenues(data);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVenues();
  }, [showInactive]);

  const handleDelete = async (id: number) => {
    try {
      await venuesApi.delete(id);
      setVenues(venues.filter((v) => v.id !== id));
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.response?.data?.error || '删除失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">场地管理</h1>
          <p className="mt-1 text-sm text-gray-500">管理艺术团所有排练场地</p>
        </div>
        {canEdit && (
          <Link to="/admin/venues/new" className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            添加场地
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="form-checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              <span className="ml-2 text-sm text-gray-600">显示已停用场地</span>
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Venue Cards */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <span className="mt-3 block text-gray-500">加载中...</span>
        </div>
      ) : venues.length === 0 ? (
        <div className="text-center py-12 text-gray-500">暂无场地数据</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <div
              key={venue.id}
              className={`card hover:shadow-md transition-shadow ${
                !venue.is_active ? 'opacity-60' : ''
              }`}
            >
              <div className="card-body">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{venue.name}</h3>
                    {!venue.is_active && (
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 mt-1">
                        已停用
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center space-x-1">
                      <Link
                        to={`/admin/venues/${venue.id}/edit`}
                        className="p-2 text-gray-400 hover:text-primary-600"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      {deleteConfirm === venue.id ? (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleDelete(venue.id)}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            确认
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(venue.id)}
                          className="p-2 text-gray-400 hover:text-red-600"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  {venue.location && (
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                      {venue.location}
                    </div>
                  )}
                  {venue.capacity && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="w-4 h-4 mr-2 text-gray-400" />
                      容纳 {venue.capacity} 人
                    </div>
                  )}
                  {venue.equipment && (
                    <p className="text-sm text-gray-500 line-clamp-2">{venue.equipment}</p>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <Link
                    to={`/admin/venues/${venue.id}/schedule`}
                    className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
                  >
                    <Calendar className="w-4 h-4 mr-1" />
                    查看时间表
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && venues.length > 0 && (
        <div className="text-sm text-gray-500">共 {venues.length} 个场地</div>
      )}
    </div>
  );
}
