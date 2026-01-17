import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Users,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  Check,
  X,
  FileText,
  Upload,
  Camera,
  Loader2,
  Image as ImageIcon,
  UserCheck,
  UserX,
  Undo2,
  Send,
  Trash2,
} from 'lucide-react';
import { rehearsalsApi, faceRecognitionApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { Rehearsal, Attendance, AttendanceStatus, FaceMatchStatus } from '../../../types';
import { ATTENDANCE_STATUS_DISPLAY, MATCH_STATUS_DISPLAY } from '../../../types';

type PhotoType = 'check_in' | 'check_out';

// Match backend response format
interface RecognitionData {
  recognition_id: number;
  total_faces: number;
  matched_count: number;
  uncertain_count: number;
  unmatched_count: number;
  photo_url?: string;
}

interface DetectedFaceData {
  face_id: number;
  face_crop_url: string;
  match_status: FaceMatchStatus;
  matched_member_id: number | null;
  matched_member_name: string | null;
  confidence: number | null;
  annotated_member_id?: number;
  annotated_member_name?: string;
}

interface RecognitionState {
  isUploading: boolean;
  recognition: RecognitionData | null;
  faces: DetectedFaceData[];
  error: string | null;
}

// Pending annotation waiting for confirmation
interface PendingAnnotation {
  face_id: number;
  photoType: PhotoType;
  member_id: number | null;
  member_name: string | null;
}

export default function RehearsalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'committee', 'program_manager');

  const [rehearsal, setRehearsal] = useState<Rehearsal | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingAttendance, setEditingAttendance] = useState<number | null>(null);
  const [leaveForm, setLeaveForm] = useState({
    has_leave: false,
    leave_type: 'full' as 'full' | 'late' | 'early',
    leave_reason: '',
  });

  // Face recognition state
  const [checkInRecognition, setCheckInRecognition] = useState<RecognitionState>({
    isUploading: false,
    recognition: null,
    faces: [],
    error: null,
  });
  const [checkOutRecognition, setCheckOutRecognition] = useState<RecognitionState>({
    isUploading: false,
    recognition: null,
    faces: [],
    error: null,
  });
  const [activeAnnotation, setActiveAnnotation] = useState<{
    photoType: PhotoType;
    face: DetectedFaceData;
  } | null>(null);
  const [programMembers, setProgramMembers] = useState<{ id: number; name: string }[]>([]);

  // Pending annotations (staged but not yet submitted)
  const [pendingAnnotations, setPendingAnnotations] = useState<PendingAnnotation[]>([]);
  const [isSubmittingAnnotations, setIsSubmittingAnnotations] = useState(false);

  const checkInInputRef = useRef<HTMLInputElement>(null);
  const checkOutInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [rehearsalData, attendanceData] = await Promise.all([
        rehearsalsApi.get(Number(id)),
        rehearsalsApi.getAttendance(Number(id)),
      ]);
      setRehearsal(rehearsalData);
      setAttendance(attendanceData);

      // Extract program members from attendance
      setProgramMembers(attendanceData.map(a => ({
        id: a.member_id,
        name: a.member_name || `Member ${a.member_id}`,
      })));
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateLeave = async (memberId: number) => {
    try {
      const updated = await rehearsalsApi.updateAttendance(Number(id), memberId, {
        has_leave: leaveForm.has_leave,
        leave_type: leaveForm.has_leave ? leaveForm.leave_type : undefined,
        leave_reason: leaveForm.has_leave ? leaveForm.leave_reason : undefined,
      });
      setAttendance(
        attendance.map((a) => (a.member_id === memberId ? updated : a))
      );
      setEditingAttendance(null);
    } catch (err: any) {
      setError(err.response?.data?.error || '更新失败');
    }
  };

  const startEditLeave = (att: Attendance) => {
    setEditingAttendance(att.member_id);
    setLeaveForm({
      has_leave: att.has_leave,
      leave_type: (att.leave_type as 'full' | 'late' | 'early') || 'full',
      leave_reason: att.leave_reason || '',
    });
  };

  const handlePhotoUpload = async (file: File, photoType: PhotoType) => {
    if (!rehearsal) return;

    const setState = photoType === 'check_in' ? setCheckInRecognition : setCheckOutRecognition;

    setState(prev => ({ ...prev, isUploading: true, error: null }));

    try {
      const result = await faceRecognitionApi.recognizePhoto(
        file,
        rehearsal.id,
        rehearsal.program_id,
        photoType
      );

      console.log('Recognition result:', result);

      // Transform backend response to match our state format
      const recognition: RecognitionData = {
        recognition_id: result.recognition_id,
        total_faces: result.total_faces,
        matched_count: result.matched_count,
        uncertain_count: result.uncertain_count,
        unmatched_count: result.unmatched_count,
      };

      const faces: DetectedFaceData[] = (result.faces || []).map(f => ({
        face_id: f.face_id,
        face_crop_url: f.face_crop_url,
        match_status: f.match_status as FaceMatchStatus,
        matched_member_id: f.matched_member_id,
        matched_member_name: f.matched_member_name,
        confidence: f.confidence,
      }));

      setState({
        isUploading: false,
        recognition,
        faces,
        error: null,
      });

      // Refresh attendance to reflect detection updates
      const updatedAttendance = await rehearsalsApi.getAttendance(Number(id));
      setAttendance(updatedAttendance);
    } catch (err: any) {
      console.error('Recognition error:', err);
      const errorMsg = err.response?.data?.error
        || err.response?.data?.message
        || err.message
        || '识别失败';
      setState(prev => ({
        ...prev,
        isUploading: false,
        error: errorMsg,
      }));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, photoType: PhotoType) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePhotoUpload(file, photoType);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  // Stage an annotation (don't submit yet)
  const handleStageAnnotation = (face: DetectedFaceData, memberId: number | null, photoType?: PhotoType) => {
    const type = photoType || activeAnnotation?.photoType;
    if (!type) return;

    const memberName = memberId
      ? programMembers.find(m => m.id === memberId)?.name || null
      : null;

    // Remove any existing pending annotation for this face
    setPendingAnnotations(prev => {
      const filtered = prev.filter(p => p.face_id !== face.face_id);
      return [...filtered, {
        face_id: face.face_id,
        photoType: type,
        member_id: memberId,
        member_name: memberName,
      }];
    });

    setActiveAnnotation(null);
  };

  // Quick confirm for uncertain faces (confirm the system's guess)
  const handleQuickConfirm = (face: DetectedFaceData, photoType: PhotoType) => {
    if (!face.matched_member_id) return;
    handleStageAnnotation(face, face.matched_member_id, photoType);
  };

  // Remove a pending annotation
  const handleRemovePendingAnnotation = (faceId: number) => {
    setPendingAnnotations(prev => prev.filter(p => p.face_id !== faceId));
  };

  // Clear all pending annotations
  const handleClearAllPendingAnnotations = () => {
    setPendingAnnotations([]);
  };

  // Submit all pending annotations
  const handleSubmitAllAnnotations = async () => {
    if (pendingAnnotations.length === 0) return;

    setIsSubmittingAnnotations(true);
    setError('');

    try {
      // Submit all annotations
      for (const annotation of pendingAnnotations) {
        await faceRecognitionApi.annotateFace(
          annotation.face_id,
          annotation.member_id,
          'correct'
        );
      }

      // Update local state for both check-in and check-out
      const updateFaces = (prev: RecognitionState, photoType: PhotoType): RecognitionState => ({
        ...prev,
        faces: prev.faces.map(f => {
          const pending = pendingAnnotations.find(
            p => p.face_id === f.face_id && p.photoType === photoType
          );
          if (pending) {
            return {
              ...f,
              annotated_member_id: pending.member_id ?? undefined,
              annotated_member_name: pending.member_name ?? undefined,
              match_status: 'manual' as FaceMatchStatus,
            };
          }
          return f;
        }),
      });

      setCheckInRecognition(prev => updateFaces(prev, 'check_in'));
      setCheckOutRecognition(prev => updateFaces(prev, 'check_out'));

      // Clear pending annotations
      setPendingAnnotations([]);

      // Refresh attendance
      const updatedAttendance = await rehearsalsApi.getAttendance(Number(id));
      setAttendance(updatedAttendance);
    } catch (err: any) {
      setError(err.response?.data?.error || '提交标注失败');
    } finally {
      setIsSubmittingAnnotations(false);
    }
  };

  // Get pending annotation for a face (if any)
  const getPendingAnnotation = (faceId: number): PendingAnnotation | undefined => {
    return pendingAnnotations.find(p => p.face_id === faceId);
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    const colors: Record<string, string> = {
      normal: 'bg-green-100 text-green-800',
      late: 'bg-yellow-100 text-yellow-800',
      early_leave: 'bg-yellow-100 text-yellow-800',
      absent: 'bg-red-100 text-red-800',
      leave_absent: 'bg-blue-100 text-blue-800',
      leave_late: 'bg-blue-100 text-blue-800',
      leave_early: 'bg-blue-100 text-blue-800',
    };
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}
      >
        {ATTENDANCE_STATUS_DISPLAY[status] || status}
      </span>
    );
  };

  const getDetectionIcon = (detected: boolean) => {
    return detected ? (
      <Check className="w-4 h-4 text-green-600" />
    ) : (
      <X className="w-4 h-4 text-red-600" />
    );
  };

  const getMatchStatusBadge = (status: FaceMatchStatus) => {
    const colors: Record<string, string> = {
      confirmed: 'bg-green-100 text-green-800',
      uncertain: 'bg-yellow-100 text-yellow-800',
      unmatched: 'bg-red-100 text-red-800',
      manual: 'bg-blue-100 text-blue-800',
      self_annotated: 'bg-purple-100 text-purple-800',
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded ${colors[status]}`}>
        {MATCH_STATUS_DISPLAY[status]}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!rehearsal) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">排练不存在或已被删除</p>
        <button
          onClick={() => navigate('/admin/rehearsals')}
          className="mt-4 btn-primary"
        >
          返回排练列表
        </button>
      </div>
    );
  }

  const stats = {
    total: attendance.length,
    normal: attendance.filter((a) => a.status === 'normal').length,
    late: attendance.filter((a) => ['late', 'leave_late'].includes(a.status)).length,
    absent: attendance.filter((a) =>
      ['absent', 'early_leave', 'leave_absent', 'leave_early'].includes(a.status)
    ).length,
    leave: attendance.filter((a) => a.has_leave).length,
  };

  const renderPhotoUploadSection = (
    photoType: PhotoType,
    label: string,
    recognitionState: RecognitionState,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    const { isUploading, recognition, faces, error: recognitionError } = recognitionState;

    return (
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-900 flex items-center">
            <Camera className="w-5 h-5 mr-2 text-gray-500" />
            {label}合照
          </h4>
          {canEdit && (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="btn-secondary text-sm py-1.5 px-3 flex items-center"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  识别中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-1.5" />
                  上传并识别
                </>
              )}
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e, photoType)}
          />
        </div>

        {recognitionError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 flex items-start">
            <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-700">{recognitionError}</span>
          </div>
        )}

        {recognition && (
          <div className="space-y-4">
            {/* Recognition Stats */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-gray-50 rounded p-2">
                <p className="text-lg font-semibold">{recognition.total_faces}</p>
                <p className="text-xs text-gray-500">检测人脸</p>
              </div>
              <div className="bg-green-50 rounded p-2">
                <p className="text-lg font-semibold text-green-600">{recognition.matched_count}</p>
                <p className="text-xs text-gray-500">已匹配</p>
              </div>
              <div className="bg-yellow-50 rounded p-2">
                <p className="text-lg font-semibold text-yellow-600">{recognition.uncertain_count}</p>
                <p className="text-xs text-gray-500">待确认</p>
              </div>
              <div className="bg-red-50 rounded p-2">
                <p className="text-lg font-semibold text-red-600">{recognition.unmatched_count}</p>
                <p className="text-xs text-gray-500">未识别</p>
              </div>
            </div>

            {/* Photo Preview */}
            {recognition.photo_url && (
              <div className="relative">
                <img
                  src={recognition.photo_url}
                  alt={`${label}合照`}
                  className="w-full rounded-lg max-h-64 object-contain bg-gray-100"
                />
              </div>
            )}

            {/* Detected Faces */}
            {faces.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">检测到的人脸</h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {faces.map((face) => {
                    const pending = getPendingAnnotation(face.face_id);
                    const hasPending = !!pending;

                    return (
                      <div
                        key={face.face_id}
                        className={`relative border-2 rounded-lg p-2 ${
                          hasPending
                            ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-200'
                            : face.match_status === 'uncertain' || face.match_status === 'unmatched'
                              ? 'border-yellow-300 bg-yellow-50'
                              : 'border-gray-200'
                        }`}
                      >
                        {/* Pending badge */}
                        {hasPending && (
                          <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                            待提交
                          </div>
                        )}

                        {face.face_crop_url ? (
                          <img
                            src={face.face_crop_url}
                            alt="人脸"
                            className="w-full aspect-square object-cover rounded"
                          />
                        ) : (
                          <div className="w-full aspect-square bg-gray-200 rounded flex items-center justify-center">
                            <Users className="w-8 h-8 text-gray-400" />
                          </div>
                        )}

                        <div className="mt-2 space-y-1">
                          {hasPending ? (
                            <>
                              <span className="px-2 py-0.5 text-xs rounded bg-orange-100 text-orange-800">
                                待确认
                              </span>
                              <p className="text-sm font-medium truncate text-orange-700">
                                {pending.member_name || '非成员'}
                              </p>
                              <button
                                onClick={() => handleRemovePendingAnnotation(face.face_id)}
                                className="w-full mt-1 text-xs py-1 px-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center justify-center"
                              >
                                <Undo2 className="w-3 h-3 mr-1" />
                                撤销
                              </button>
                            </>
                          ) : (
                            <>
                              {getMatchStatusBadge(face.match_status)}

                              {face.match_status === 'confirmed' || face.match_status === 'manual' ? (
                                <p className="text-sm font-medium truncate">
                                  {face.annotated_member_name || face.matched_member_name || '已识别'}
                                </p>
                              ) : face.match_status === 'uncertain' ? (
                                <p className="text-sm text-yellow-700 truncate">
                                  可能是: {face.matched_member_name}
                                  {face.confidence && (
                                    <span className="text-xs ml-1">
                                      ({Math.round(face.confidence * 100)}%)
                                    </span>
                                  )}
                                </p>
                              ) : (
                                <p className="text-sm text-gray-500">未识别</p>
                              )}

                              {canEdit && face.match_status === 'uncertain' && face.matched_member_id && (
                                <div className="flex gap-1 mt-1">
                                  <button
                                    onClick={() => handleQuickConfirm(face, photoType)}
                                    className="flex-1 text-xs py-1 px-2 bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center justify-center"
                                  >
                                    <Check className="w-3 h-3 mr-1" />
                                    确认
                                  </button>
                                  <button
                                    onClick={() => setActiveAnnotation({ photoType, face })}
                                    className="flex-1 text-xs py-1 px-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                                  >
                                    改为
                                  </button>
                                </div>
                              )}

                              {canEdit && face.match_status !== 'uncertain' && (
                                <button
                                  onClick={() => setActiveAnnotation({ photoType, face })}
                                  className={`w-full mt-1 text-xs py-1 px-2 rounded ${
                                    face.match_status === 'confirmed' || face.match_status === 'manual'
                                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                                  }`}
                                >
                                  {face.match_status === 'confirmed' || face.match_status === 'manual'
                                    ? '修改'
                                    : '手动标注'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {!recognition && !isUploading && (
          <div className="text-center py-8 text-gray-500">
            <ImageIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>尚未上传{label}合照</p>
            {canEdit && (
              <p className="text-sm mt-1">点击上方按钮上传照片并进行人脸识别</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/admin/rehearsals')}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {rehearsal.program_name} - 排练详情
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {rehearsal.scheduled_date}
              {rehearsal.scheduled_start_time &&
                ` ${rehearsal.scheduled_start_time}`}
              {rehearsal.scheduled_end_time &&
                ` - ${rehearsal.scheduled_end_time}`}
            </p>
          </div>
        </div>
        {canEdit && (
          <Link to={`/admin/rehearsals/${id}/edit`} className="btn-primary">
            <Edit2 className="w-4 h-4 mr-2" />
            编辑
          </Link>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">日期</p>
                <p className="text-lg font-semibold text-gray-900">
                  {rehearsal.scheduled_date}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">时间</p>
                <p className="text-lg font-semibold text-gray-900">
                  {rehearsal.scheduled_start_time || '-'} -{' '}
                  {rehearsal.scheduled_end_time || '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <MapPin className="w-8 h-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">地点</p>
                <p className="text-lg font-semibold text-gray-900">
                  {rehearsal.location || '未指定'}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">教师</p>
                <p className="text-lg font-semibold text-gray-900">
                  {rehearsal.teacher_name || '未指定'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Face Recognition Section */}
      <div className="card">
        <div className="card-body">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Camera className="w-5 h-5 mr-2" />
            人脸识别考勤
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderPhotoUploadSection('check_in', '课前', checkInRecognition, checkInInputRef)}
            {renderPhotoUploadSection('check_out', '课后', checkOutRecognition, checkOutInputRef)}
          </div>

          {/* Pending Annotations Actions */}
          {pendingAnnotations.length > 0 && (
            <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-orange-500 mr-2" />
                  <span className="text-sm font-medium text-orange-800">
                    您有 {pendingAnnotations.length} 个待提交的标注
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleClearAllPendingAnnotations}
                    disabled={isSubmittingAnnotations}
                    className="flex items-center px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    清空全部
                  </button>
                  <button
                    onClick={handleSubmitAllAnnotations}
                    disabled={isSubmittingAnnotations}
                    className="flex items-center px-4 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    {isSubmittingAnnotations ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        提交中...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-1.5" />
                        提交修改
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Pending annotations summary */}
              <div className="mt-3 text-sm text-orange-700">
                <p>待提交标注列表：</p>
                <ul className="mt-1 ml-4 list-disc">
                  {pendingAnnotations.map((p) => (
                    <li key={p.face_id}>
                      人脸 #{p.face_id} → {p.member_name || '非成员'}
                      <button
                        onClick={() => handleRemovePendingAnnotation(p.face_id)}
                        className="ml-2 text-orange-500 hover:text-orange-700 underline"
                      >
                        撤销
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attendance Stats */}
      <div className="card">
        <div className="card-body">
          <h3 className="text-lg font-medium text-gray-900 mb-4">考勤统计</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">应到人数</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-600">{stats.normal}</p>
              <p className="text-sm text-gray-500">正常出勤</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-3xl font-bold text-yellow-600">{stats.late}</p>
              <p className="text-sm text-gray-500">迟到</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-3xl font-bold text-red-600">{stats.absent}</p>
              <p className="text-sm text-gray-500">缺勤/早退</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">{stats.leave}</p>
              <p className="text-sm text-gray-500">请假</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {rehearsal.notes && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-start">
              <FileText className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-gray-900">备注</h3>
                <p className="mt-1 text-gray-600 whitespace-pre-wrap">
                  {rehearsal.notes}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Table */}
      <div className="card">
        <div className="card-body">
          <h3 className="text-lg font-medium text-gray-900 mb-4">考勤详情</h3>

          {attendance.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              暂无考勤数据。请先为节目添加成员，考勤记录将自动创建。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      姓名
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      课前
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      课后
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      请假
                    </th>
                    {canEdit && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendance.map((att) => (
                    <tr key={att.member_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">
                          {att.member_name}
                        </span>
                        {att.manual_override && (
                          <span className="ml-2 text-xs text-orange-600">
                            (已手动调整)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getDetectionIcon(att.detected_before)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getDetectionIcon(att.detected_after)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(att.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingAttendance === att.member_id ? (
                          <div className="flex items-center space-x-2">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={leaveForm.has_leave}
                                onChange={(e) =>
                                  setLeaveForm((prev) => ({
                                    ...prev,
                                    has_leave: e.target.checked,
                                  }))
                                }
                                className="mr-2"
                              />
                              请假
                            </label>
                            {leaveForm.has_leave && (
                              <>
                                <select
                                  value={leaveForm.leave_type}
                                  onChange={(e) =>
                                    setLeaveForm((prev) => ({
                                      ...prev,
                                      leave_type: e.target.value as 'full' | 'late' | 'early',
                                    }))
                                  }
                                  className="form-input py-1 text-sm w-20"
                                >
                                  <option value="full">全程</option>
                                  <option value="late">迟到</option>
                                  <option value="early">早退</option>
                                </select>
                                <input
                                  type="text"
                                  value={leaveForm.leave_reason}
                                  onChange={(e) =>
                                    setLeaveForm((prev) => ({
                                      ...prev,
                                      leave_reason: e.target.value,
                                    }))
                                  }
                                  placeholder="原因"
                                  className="form-input py-1 text-sm w-24"
                                />
                              </>
                            )}
                            <button
                              onClick={() => handleUpdateLeave(att.member_id)}
                              className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingAttendance(null)}
                              className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">
                            {att.has_leave ? (
                              <>
                                {att.leave_type === 'full'
                                  ? '全程请假'
                                  : att.leave_type === 'late'
                                    ? '迟到请假'
                                    : '早退请假'}
                                {att.leave_reason && ` (${att.leave_reason})`}
                              </>
                            ) : (
                              '-'
                            )}
                          </span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          {editingAttendance !== att.member_id && (
                            <button
                              onClick={() => startEditLeave(att)}
                              className="text-primary-600 hover:text-primary-700"
                            >
                              编辑请假
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Annotation Modal */}
      {activeAnnotation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b">
              <h3 className="text-lg font-medium">手动标注人脸</h3>
              <p className="text-sm text-gray-500 mt-1">
                选择成员后将暂存，您可以继续标注其他人脸，最后统一提交
              </p>
            </div>

            <div className="p-4">
              {/* Face preview */}
              <div className="flex justify-center mb-4">
                {activeAnnotation.face.face_crop_url ? (
                  <img
                    src={activeAnnotation.face.face_crop_url}
                    alt="待标注人脸"
                    className="w-24 h-24 object-cover rounded-lg border"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                    <Users className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Member selection */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {programMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleStageAnnotation(activeAnnotation.face, member.id)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center"
                  >
                    <UserCheck className="w-4 h-4 mr-2 text-gray-400" />
                    {member.name}
                  </button>
                ))}
                <button
                  onClick={() => handleStageAnnotation(activeAnnotation.face, null)}
                  className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 rounded flex items-center"
                >
                  <UserX className="w-4 h-4 mr-2" />
                  不是节目成员
                </button>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setActiveAnnotation(null)}
                className="w-full btn-secondary"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
