import { useRef } from 'react';
import {
  Camera,
  Upload,
  Loader2,
  AlertCircle,
  Users,
  Image as ImageIcon,
  Check,
  Undo2,
  Send,
  Trash2,
} from 'lucide-react';
import type { FaceMatchStatus } from '../../../../types';
import { MATCH_STATUS_DISPLAY } from '../../../../types';

type PhotoType = 'check_in' | 'check_out';

interface RecognitionData {
  recognition_id: number;
  total_faces: number;
  matched_count: number;
  uncertain_count: number;
  unmatched_count: number;
  photo_url?: string;
}

export interface DetectedFaceData {
  face_id: number;
  face_crop_url: string;
  match_status: FaceMatchStatus;
  matched_member_id: number | null;
  matched_member_name: string | null;
  confidence: number | null;
  annotated_member_id?: number;
  annotated_member_name?: string;
}

export interface RecognitionState {
  isUploading: boolean;
  recognition: RecognitionData | null;
  faces: DetectedFaceData[];
  error: string | null;
}

export interface PendingAnnotation {
  face_id: number;
  photoType: PhotoType;
  member_id: number | null;
  member_name: string | null;
}

interface FaceRecognitionSectionProps {
  canEdit: boolean;
  checkInRecognition: RecognitionState;
  checkOutRecognition: RecognitionState;
  pendingAnnotations: PendingAnnotation[];
  isSubmittingAnnotations: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, photoType: PhotoType) => void;
  onQuickConfirm: (face: DetectedFaceData, photoType: PhotoType) => void;
  onOpenAnnotation: (photoType: PhotoType, face: DetectedFaceData) => void;
  onRemovePendingAnnotation: (faceId: number) => void;
  onClearAllPendingAnnotations: () => void;
  onSubmitAllAnnotations: () => void;
}

function getMatchStatusBadge(status: FaceMatchStatus) {
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
}

function PhotoUploadSection({
  photoType,
  label,
  recognitionState,
  canEdit,
  pendingAnnotations,
  onFileSelect,
  onQuickConfirm,
  onOpenAnnotation,
  onRemovePendingAnnotation,
}: {
  photoType: PhotoType;
  label: string;
  recognitionState: RecognitionState;
  canEdit: boolean;
  pendingAnnotations: PendingAnnotation[];
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, photoType: PhotoType) => void;
  onQuickConfirm: (face: DetectedFaceData, photoType: PhotoType) => void;
  onOpenAnnotation: (photoType: PhotoType, face: DetectedFaceData) => void;
  onRemovePendingAnnotation: (faceId: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { isUploading, recognition, faces, error: recognitionError } = recognitionState;

  const getPendingAnnotation = (faceId: number) =>
    pendingAnnotations.find((p) => p.face_id === faceId);

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
          onChange={(e) => onFileSelect(e, photoType)}
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

          {recognition.photo_url && (
            <div className="relative">
              <img
                src={recognition.photo_url}
                alt={`${label}合照`}
                className="w-full rounded-lg max-h-64 object-contain bg-gray-100"
              />
            </div>
          )}

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
                              onClick={() => onRemovePendingAnnotation(face.face_id)}
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
                                  onClick={() => onQuickConfirm(face, photoType)}
                                  className="flex-1 text-xs py-1 px-2 bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center justify-center"
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  确认
                                </button>
                                <button
                                  onClick={() => onOpenAnnotation(photoType, face)}
                                  className="flex-1 text-xs py-1 px-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                                >
                                  改为
                                </button>
                              </div>
                            )}

                            {canEdit && face.match_status !== 'uncertain' && (
                              <button
                                onClick={() => onOpenAnnotation(photoType, face)}
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
}

export default function FaceRecognitionSection({
  canEdit,
  checkInRecognition,
  checkOutRecognition,
  pendingAnnotations,
  isSubmittingAnnotations,
  onFileSelect,
  onQuickConfirm,
  onOpenAnnotation,
  onRemovePendingAnnotation,
  onClearAllPendingAnnotations,
  onSubmitAllAnnotations,
}: FaceRecognitionSectionProps) {
  return (
    <div className="card">
      <div className="card-body">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Camera className="w-5 h-5 mr-2" />
          人脸识别考勤
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PhotoUploadSection
            photoType="check_in"
            label="课前"
            recognitionState={checkInRecognition}
            canEdit={canEdit}
            pendingAnnotations={pendingAnnotations}
            onFileSelect={onFileSelect}
            onQuickConfirm={onQuickConfirm}
            onOpenAnnotation={onOpenAnnotation}
            onRemovePendingAnnotation={onRemovePendingAnnotation}
          />
          <PhotoUploadSection
            photoType="check_out"
            label="课后"
            recognitionState={checkOutRecognition}
            canEdit={canEdit}
            pendingAnnotations={pendingAnnotations}
            onFileSelect={onFileSelect}
            onQuickConfirm={onQuickConfirm}
            onOpenAnnotation={onOpenAnnotation}
            onRemovePendingAnnotation={onRemovePendingAnnotation}
          />
        </div>

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
                  onClick={onClearAllPendingAnnotations}
                  disabled={isSubmittingAnnotations}
                  className="flex items-center px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  清空全部
                </button>
                <button
                  onClick={onSubmitAllAnnotations}
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

            <div className="mt-3 text-sm text-orange-700">
              <p>待提交标注列表：</p>
              <ul className="mt-1 ml-4 list-disc">
                {pendingAnnotations.map((p) => (
                  <li key={p.face_id}>
                    人脸 #{p.face_id} → {p.member_name || '非成员'}
                    <button
                      onClick={() => onRemovePendingAnnotation(p.face_id)}
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
  );
}
