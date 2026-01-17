import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { venuesApi } from '../../../services/api';
import type { VenueForm as VenueFormType } from '../../../types';

export default function VenueForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState<VenueFormType>({
    name: '',
    location: '',
    capacity: undefined,
    equipment: '',
    is_active: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit && id) {
      fetchVenue(parseInt(id));
    }
  }, [id]);

  const fetchVenue = async (venueId: number) => {
    setIsLoading(true);
    setError('');
    try {
      const venue = await venuesApi.get(venueId);
      setFormData({
        name: venue.name,
        location: venue.location || '',
        capacity: venue.capacity,
        equipment: venue.equipment || '',
        is_active: venue.is_active,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      if (isEdit && id) {
        await venuesApi.update(parseInt(id), formData);
      } else {
        await venuesApi.create(formData);
      }
      navigate('/admin/venues');
    } catch (err: any) {
      setError(err.response?.data?.error || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <span className="mt-3 block text-gray-500">加载中...</span>
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold text-gray-900">
              {isEdit ? '编辑场地' : '添加场地'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {isEdit ? '修改场地信息' : '创建新的排练场地'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <div className="card-body space-y-6">
          <div>
            <label className="form-label">
              场地名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="如：大排练厅"
              required
            />
          </div>

          <div>
            <label className="form-label">位置描述</label>
            <input
              type="text"
              className="form-input"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="如：艺术楼 3 楼"
            />
          </div>

          <div>
            <label className="form-label">容纳人数</label>
            <input
              type="number"
              className="form-input w-40"
              value={formData.capacity || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  capacity: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              placeholder="如：50"
              min="0"
            />
          </div>

          <div>
            <label className="form-label">设备描述</label>
            <textarea
              className="form-input"
              rows={3}
              value={formData.equipment}
              onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
              placeholder="如：音响系统、投影仪、镜子墙等"
            />
          </div>

          {isEdit && (
            <div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <span className="ml-2 text-sm text-gray-700">启用场地</span>
              </label>
              <p className="mt-1 text-xs text-gray-500">停用的场地将不能被预订</p>
            </div>
          )}

          <div className="flex items-center justify-end space-x-4 pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate('/admin/venues')}
              className="btn-secondary"
            >
              取消
            </button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  保存
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
