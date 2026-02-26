import { UserCheck, UserX, Users } from 'lucide-react';

interface DetectedFaceData {
  face_id: number;
  face_crop_url: string;
  matched_member_id: number | null;
  matched_member_name: string | null;
}

interface AnnotationModalProps {
  face: DetectedFaceData;
  programMembers: { id: number; name: string }[];
  onAnnotate: (memberId: number | null) => void;
  onClose: () => void;
}

export default function AnnotationModal({
  face,
  programMembers,
  onAnnotate,
  onClose,
}: AnnotationModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium">手动标注人脸</h3>
          <p className="text-sm text-gray-500 mt-1">
            选择成员后将暂存，您可以继续标注其他人脸，最后统一提交
          </p>
        </div>

        <div className="p-4">
          <div className="flex justify-center mb-4">
            {face.face_crop_url ? (
              <img
                src={face.face_crop_url}
                alt="待标注人脸"
                className="w-24 h-24 object-cover rounded-lg border"
              />
            ) : (
              <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {programMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => onAnnotate(member.id)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center"
              >
                <UserCheck className="w-4 h-4 mr-2 text-gray-400" />
                {member.name}
              </button>
            ))}
            <button
              onClick={() => onAnnotate(null)}
              className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 rounded flex items-center"
            >
              <UserX className="w-4 h-4 mr-2" />
              不是节目成员
            </button>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50">
          <button onClick={onClose} className="w-full btn-secondary">
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
