import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit2, AlertCircle, FileText } from 'lucide-react';
import { rehearsalsApi, faceRecognitionApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import type { Rehearsal, Attendance, FaceMatchStatus } from '../../../types';
import RehearsalInfoCards from './components/RehearsalInfoCards';
import FaceRecognitionSection from './components/FaceRecognitionSection';
import type { RecognitionState, DetectedFaceData, PendingAnnotation } from './components/FaceRecognitionSection';
import AttendanceTable from './components/AttendanceTable';
import AnnotationModal from './components/AnnotationModal';

type PhotoType = 'check_in' | 'check_out';

const EMPTY_RECOGNITION: RecognitionState = {
  isUploading: false,
  recognition: null,
  faces: [],
  error: null,
};

export default function RehearsalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'committee', 'program_manager');

  const [rehearsal, setRehearsal] = useState<Rehearsal | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Face recognition state
  const [checkInRecognition, setCheckInRecognition] = useState<RecognitionState>(EMPTY_RECOGNITION);
  const [checkOutRecognition, setCheckOutRecognition] = useState<RecognitionState>(EMPTY_RECOGNITION);
  const [activeAnnotation, setActiveAnnotation] = useState<{
    photoType: PhotoType;
    face: DetectedFaceData;
  } | null>(null);
  const [programMembers, setProgramMembers] = useState<{ id: number; name: string }[]>([]);
  const [pendingAnnotations, setPendingAnnotations] = useState<PendingAnnotation[]>([]);
  const [isSubmittingAnnotations, setIsSubmittingAnnotations] = useState(false);

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

      setProgramMembers(attendanceData.map(a => ({
        id: a.member_id,
        name: a.member_name || `Member ${a.member_id}`,
      })));

      // Load saved recognition results
      try {
        const recognitions = await faceRecognitionApi.getRehearsalRecognitions(Number(id));

        if (recognitions.check_in) {
          setCheckInRecognition({
            isUploading: false,
            recognition: {
              recognition_id: recognitions.check_in.recognition_id,
              total_faces: recognitions.check_in.total_faces,
              matched_count: recognitions.check_in.matched_count,
              uncertain_count: recognitions.check_in.uncertain_count,
              unmatched_count: recognitions.check_in.unmatched_count,
              photo_url: recognitions.check_in.photo_url,
            },
            faces: recognitions.check_in.faces.map(f => ({
              face_id: f.face_id,
              face_crop_url: f.face_crop_url,
              match_status: f.match_status as FaceMatchStatus,
              matched_member_id: f.matched_member_id,
              matched_member_name: f.matched_member_name,
              confidence: f.confidence,
              annotated_member_id: f.annotated_member_id,
              annotated_member_name: f.annotated_member_name,
            })),
            error: null,
          });
        }

        if (recognitions.check_out) {
          setCheckOutRecognition({
            isUploading: false,
            recognition: {
              recognition_id: recognitions.check_out.recognition_id,
              total_faces: recognitions.check_out.total_faces,
              matched_count: recognitions.check_out.matched_count,
              uncertain_count: recognitions.check_out.uncertain_count,
              unmatched_count: recognitions.check_out.unmatched_count,
              photo_url: recognitions.check_out.photo_url,
            },
            faces: recognitions.check_out.faces.map(f => ({
              face_id: f.face_id,
              face_crop_url: f.face_crop_url,
              match_status: f.match_status as FaceMatchStatus,
              matched_member_id: f.matched_member_id,
              matched_member_name: f.matched_member_name,
              confidence: f.confidence,
              annotated_member_id: f.annotated_member_id,
              annotated_member_name: f.annotated_member_name,
            })),
            error: null,
          });
        }
      } catch {
        // Ignore errors loading recognition results - they may not exist
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Face recognition handlers ---

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

      setState({
        isUploading: false,
        recognition: {
          recognition_id: result.recognition_id,
          total_faces: result.total_faces,
          matched_count: result.matched_count,
          uncertain_count: result.uncertain_count,
          unmatched_count: result.unmatched_count,
        },
        faces: (result.faces || []).map(f => ({
          face_id: f.face_id,
          face_crop_url: f.face_crop_url,
          match_status: f.match_status as FaceMatchStatus,
          matched_member_id: f.matched_member_id,
          matched_member_name: f.matched_member_name,
          confidence: f.confidence,
        })),
        error: null,
      });

      const updatedAttendance = await rehearsalsApi.getAttendance(Number(id));
      setAttendance(updatedAttendance);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error
        || err.response?.data?.message
        || err.message
        || '识别失败';
      setState(prev => ({ ...prev, isUploading: false, error: errorMsg }));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, photoType: PhotoType) => {
    const file = e.target.files?.[0];
    if (file) handlePhotoUpload(file, photoType);
    e.target.value = '';
  };

  const handleStageAnnotation = (face: DetectedFaceData, memberId: number | null, photoType?: PhotoType) => {
    const type = photoType || activeAnnotation?.photoType;
    if (!type) return;

    const memberName = memberId
      ? programMembers.find(m => m.id === memberId)?.name || null
      : null;

    setPendingAnnotations(prev => {
      const filtered = prev.filter(p => p.face_id !== face.face_id);
      return [...filtered, { face_id: face.face_id, photoType: type, member_id: memberId, member_name: memberName }];
    });
    setActiveAnnotation(null);
  };

  const handleQuickConfirm = (face: DetectedFaceData, photoType: PhotoType) => {
    if (!face.matched_member_id) return;
    handleStageAnnotation(face, face.matched_member_id, photoType);
  };

  const handleSubmitAllAnnotations = async () => {
    if (pendingAnnotations.length === 0) return;

    setIsSubmittingAnnotations(true);
    setError('');

    try {
      for (const annotation of pendingAnnotations) {
        await faceRecognitionApi.annotateFace(annotation.face_id, annotation.member_id, 'correct');
      }

      const updateFaces = (prev: RecognitionState, photoType: PhotoType): RecognitionState => ({
        ...prev,
        faces: prev.faces.map(f => {
          const pending = pendingAnnotations.find(p => p.face_id === f.face_id && p.photoType === photoType);
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
      setPendingAnnotations([]);

      const updatedAttendance = await rehearsalsApi.getAttendance(Number(id));
      setAttendance(updatedAttendance);
    } catch (err: any) {
      setError(err.response?.data?.error || '提交标注失败');
    } finally {
      setIsSubmittingAnnotations(false);
    }
  };

  // --- Attendance update handler ---

  const handleUpdateAttendance = async (memberId: number, data: Record<string, unknown>) => {
    const updated = await rehearsalsApi.updateAttendance(Number(id), memberId, data);
    setAttendance(prev => prev.map(a => (a.member_id === memberId ? updated : a)));
  };

  // --- Render ---

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
        <button onClick={() => navigate('/admin/rehearsals')} className="mt-4 btn-primary">
          返回排练列表
        </button>
      </div>
    );
  }

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
              {rehearsal.scheduled_start_time && ` ${rehearsal.scheduled_start_time}`}
              {rehearsal.scheduled_end_time && ` - ${rehearsal.scheduled_end_time}`}
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
      <RehearsalInfoCards rehearsal={rehearsal} />

      {/* Face Recognition */}
      <FaceRecognitionSection
        canEdit={canEdit}
        checkInRecognition={checkInRecognition}
        checkOutRecognition={checkOutRecognition}
        pendingAnnotations={pendingAnnotations}
        isSubmittingAnnotations={isSubmittingAnnotations}
        onFileSelect={handleFileSelect}
        onQuickConfirm={handleQuickConfirm}
        onOpenAnnotation={(photoType, face) => setActiveAnnotation({ photoType, face })}
        onRemovePendingAnnotation={(faceId) =>
          setPendingAnnotations(prev => prev.filter(p => p.face_id !== faceId))
        }
        onClearAllPendingAnnotations={() => setPendingAnnotations([])}
        onSubmitAllAnnotations={handleSubmitAllAnnotations}
      />

      {/* Attendance Exclusion Notice */}
      {!rehearsal.counts_towards_attendance && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-500 mr-3 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">此排练不计入考勤率统计</h3>
              {rehearsal.exclusion_reason && (
                <p className="mt-1 text-sm text-yellow-700">
                  原因: {rehearsal.exclusion_reason}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {rehearsal.notes && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-start">
              <FileText className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-gray-900">备注</h3>
                <p className="mt-1 text-gray-600 whitespace-pre-wrap">{rehearsal.notes}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Stats + Table */}
      <AttendanceTable
        attendance={attendance}
        canEdit={canEdit}
        onUpdate={handleUpdateAttendance}
      />

      {/* Annotation Modal */}
      {activeAnnotation && (
        <AnnotationModal
          face={activeAnnotation.face}
          programMembers={programMembers}
          onAnnotate={(memberId) => handleStageAnnotation(activeAnnotation.face, memberId)}
          onClose={() => setActiveAnnotation(null)}
        />
      )}
    </div>
  );
}
