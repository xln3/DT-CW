"""
Group photo selection service.

Allows members to register their face by selecting themselves
from existing group photos (rehearsal check-in/out photos).
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional
import json

from database import db
from ..config import FaceRecognitionConfig
from ..core.distinguishability_checker import DistinguishabilityChecker, DistinguishabilityStatus
from ..core.embedding_aggregator import EmbeddingAggregator

logger = logging.getLogger(__name__)


class GroupSelectionService:
    """
    Handles face registration via group photo selection.
    
    Members can select their face from existing group photos
    instead of uploading individual photos.
    """
    
    def __init__(self, db_session=None):
        """
        Initialize service.
        
        Args:
            db_session: SQLAlchemy session
        """
        self.db = db_session or db.session
        self.checker = DistinguishabilityChecker(self.db)
    
    def get_selectable_photos(self, member_id: int) -> List[Dict]:
        """
        Get group photos that the member can select from.
        
        Returns photos from rehearsals of programs the member belongs to.
        
        Args:
            member_id: Member's ID
            
        Returns:
            List of selectable group photos
        """
        from models import Program, ProgramMember, Rehearsal
        from models.face_models import PhotoRecognition, DetectedFace
        
        # Get member's programs
        member_programs = self.db.query(ProgramMember).filter(
            ProgramMember.member_id == member_id,
            ProgramMember.status == 'active'
        ).all()
        
        program_ids = [mp.program_id for mp in member_programs]
        
        if not program_ids:
            return []
        
        # Get photo recognitions from these programs
        recognitions = self.db.query(
            PhotoRecognition, Rehearsal, Program
        ).join(
            Rehearsal, PhotoRecognition.rehearsal_id == Rehearsal.id
        ).join(
            Program, Rehearsal.program_id == Program.id
        ).filter(
            Rehearsal.program_id.in_(program_ids),
            PhotoRecognition.status == 'completed'
        ).order_by(Rehearsal.scheduled_date.desc()).limit(20).all()
        
        result = []
        for recognition, rehearsal, program in recognitions:
            # Count available faces (not yet annotated)
            available_count = self.db.query(DetectedFace).filter(
                DetectedFace.recognition_id == recognition.id,
                DetectedFace.annotated_member_id.is_(None)
            ).count()
            
            # Check if member already selected in this photo
            my_selection = self.db.query(DetectedFace).filter(
                DetectedFace.recognition_id == recognition.id,
                DetectedFace.annotated_member_id == member_id
            ).first()
            
            result.append({
                'recognition_id': recognition.id,
                'date': rehearsal.scheduled_date.isoformat(),
                'program_id': program.id,
                'program_name': program.name,
                'photo_type': recognition.photo_type,
                'photo_url': recognition.photo_url,
                'total_faces': recognition.total_faces,
                'available_faces': available_count,
                'already_selected': my_selection is not None
            })
        
        return result
    
    def get_photo_faces(
        self, 
        recognition_id: int, 
        current_member_id: int
    ) -> Dict:
        """
        Get all faces in a group photo for selection.
        
        Only returns cropped face images, no position info.
        
        Args:
            recognition_id: Photo recognition ID
            current_member_id: Current member's ID
            
        Returns:
            Photo info and list of faces
        """
        from models.face_models import PhotoRecognition, DetectedFace
        from models import Member, Rehearsal
        
        recognition = self.db.query(PhotoRecognition).get(recognition_id)
        if not recognition:
            return {'error': '照片不存在'}
        
        rehearsal = self.db.query(Rehearsal).get(recognition.rehearsal_id)
        
        # Get all detected faces
        faces = self.db.query(DetectedFace).filter(
            DetectedFace.recognition_id == recognition_id
        ).all()
        
        face_list = []
        for face in faces:
            if face.annotated_member_id is None:
                is_available = True
                annotated_by_name = None
                is_mine = False
            elif face.annotated_member_id == current_member_id:
                is_available = False
                annotated_by_name = "我"
                is_mine = True
            else:
                is_available = False
                annotator = self.db.query(Member).get(face.annotated_member_id)
                annotated_by_name = annotator.name if annotator else "未知"
                is_mine = False
            
            face_list.append({
                'face_id': face.id,
                'crop_url': face.face_crop_url,
                'is_available': is_available,
                'annotated_by_name': annotated_by_name,
                'is_mine': is_mine
            })
        
        return {
            'recognition_id': recognition_id,
            'date': rehearsal.scheduled_date.isoformat() if rehearsal else None,
            'program_name': recognition.program.name if recognition.program else None,
            'photo_type': recognition.photo_type,
            'faces': face_list
        }
    
    def select_myself(
        self, 
        face_id: int, 
        member_id: int
    ) -> Dict:
        """
        Member selects a face as themselves.
        
        This adds the face's embedding to the member's face data
        and triggers distinguishability check.
        
        Args:
            face_id: Detected face ID
            member_id: Member's ID
            
        Returns:
            Selection result with registration status
        """
        from models.face_models import (
            DetectedFace, MemberFace, MemberPhoto, PhotoRecognition
        )
        from models import Attendance
        
        # 1. Get the detected face
        face = self.db.query(DetectedFace).get(face_id)
        if not face:
            return {'success': False, 'error': '人脸不存在'}
        
        # 2. Check if already annotated
        if face.annotated_member_id is not None:
            if face.annotated_member_id == member_id:
                return {'success': False, 'error': '您已标注过这张人脸'}
            else:
                return {'success': False, 'error': '该人脸已被其他人标注'}
        
        # 3. Check if member already annotated in this photo
        existing = self.db.query(DetectedFace).filter(
            DetectedFace.recognition_id == face.recognition_id,
            DetectedFace.annotated_member_id == member_id
        ).first()
        if existing:
            return {'success': False, 'error': '您已在此照片中标注过，不能重复标注'}
        
        # 4. Get embedding
        embedding = None
        if face.embedding_json:
            embedding = json.loads(face.embedding_json)
        
        if embedding is None:
            return {'success': False, 'error': '该人脸特征提取失败，无法标注'}
        
        # 5. Update face annotation
        face.annotated_member_id = member_id
        face.annotated_by = member_id
        face.annotated_at = datetime.utcnow()
        face.annotation_type = 'self'
        face.match_status = 'self_annotated'
        
        # 6. Create member photo record
        photo = MemberPhoto(
            member_id=member_id,
            photo_url=face.face_crop_url,
            source_type='group_photo',
            source_recognition_id=face.recognition_id,
            source_detected_face_id=face.id,
            is_self_annotated=True,
            face_detected=True,
            face_count=1,
            quality_score=0.7,  # Default for group photo crops
            is_valid=True
        )
        photo.set_embedding(embedding)
        self.db.add(photo)
        
        # 7. Update member face status
        member_face = self._get_or_create_member_face(member_id)
        
        try:
            aggregated = self._update_aggregated_embedding(member_id)
            check_result = self.checker.check(member_id, aggregated)
            
            member_face.representative_embedding = json.dumps(aggregated)
            member_face.group_selection_count = (member_face.group_selection_count or 0) + 1
            member_face.photo_count = self._count_valid_photos(member_id)
            member_face.distinguishability_score = 1.0 - check_result.max_similarity
            member_face.max_similarity = check_result.max_similarity
            member_face.most_similar_member_id = check_result.most_similar_member_id
            member_face.last_check_at = datetime.utcnow()
            
            if check_result.status == DistinguishabilityStatus.DISTINGUISHABLE:
                member_face.status = 'registered'
                if member_face.registered_at is None:
                    member_face.registered_at = datetime.utcnow()
            elif check_result.status == DistinguishabilityStatus.BORDERLINE:
                member_face.status = 'needs_more_data'
                member_face.conflict_members = json.dumps(
                    [s['member_id'] for s in check_result.similar_members]
                )
            else:
                member_face.status = 'conflict'
                member_face.conflict_members = json.dumps(
                    [s['member_id'] for s in check_result.similar_members]
                )
        except ValueError as e:
            # First photo, just save it
            member_face.status = 'processing'
            check_result = None
        
        # 8. Update attendance if this is a rehearsal photo
        recognition = self.db.query(PhotoRecognition).get(face.recognition_id)
        if recognition and recognition.rehearsal_id:
            self._update_attendance(
                rehearsal_id=recognition.rehearsal_id,
                member_id=member_id,
                photo_type=recognition.photo_type
            )
        
        self.db.commit()
        
        # 9. Build response
        response = {
            'success': True,
            'face_id': face_id,
            'registration_status': member_face.status,
            'photo_count': member_face.photo_count,
            'group_selection_count': member_face.group_selection_count
        }
        
        if check_result:
            response['distinguishability'] = {
                'status': check_result.status.value,
                'max_similarity': check_result.max_similarity,
                'most_similar_to': check_result.most_similar_member_name
            }
            response['message'] = self._get_status_message(check_result)
        else:
            response['message'] = "照片已保存，请继续添加更多照片"
        
        return response
    
    def _get_or_create_member_face(self, member_id: int):
        """Get or create MemberFace record."""
        from models.face_models import MemberFace
        
        face = self.db.query(MemberFace).filter_by(member_id=member_id).first()
        
        if not face:
            face = MemberFace(member_id=member_id, status='processing')
            self.db.add(face)
            self.db.flush()
        
        return face
    
    def _update_aggregated_embedding(self, member_id: int) -> List[float]:
        """Calculate aggregated embedding."""
        from models.face_models import MemberPhoto
        
        photos = self.db.query(MemberPhoto).filter(
            MemberPhoto.member_id == member_id,
            MemberPhoto.is_valid == True,
            MemberPhoto.embedding_json.isnot(None)
        ).all()
        
        if not photos:
            raise ValueError("No valid photos found")
        
        embeddings = []
        quality_scores = []
        
        for photo in photos:
            embedding = photo.get_embedding()
            if embedding:
                embeddings.append(embedding)
                quality_scores.append(photo.quality_score or 0.5)
        
        if not embeddings:
            raise ValueError("No valid embeddings found")
        
        return EmbeddingAggregator.aggregate(
            embeddings, quality_scores, method='weighted'
        )
    
    def _count_valid_photos(self, member_id: int) -> int:
        """Count valid photos."""
        from models.face_models import MemberPhoto
        
        return self.db.query(MemberPhoto).filter(
            MemberPhoto.member_id == member_id,
            MemberPhoto.is_valid == True
        ).count()
    
    def _update_attendance(
        self, 
        rehearsal_id: int, 
        member_id: int, 
        photo_type: str
    ):
        """Update attendance record based on self-annotation."""
        from models import Attendance
        
        attendance = self.db.query(Attendance).filter_by(
            rehearsal_id=rehearsal_id,
            member_id=member_id
        ).first()
        
        if not attendance:
            attendance = Attendance(
                rehearsal_id=rehearsal_id,
                member_id=member_id
            )
            self.db.add(attendance)
        
        if photo_type == 'check_in':
            attendance.detected_before = True
        else:
            attendance.detected_after = True
        
        attendance.calculate_status()
    
    def _get_status_message(self, result) -> str:
        """Generate user-friendly message."""
        if result.status == DistinguishabilityStatus.DISTINGUISHABLE:
            return "✅ 标注成功！您的人脸已可被系统识别"
        elif result.status == DistinguishabilityStatus.BORDERLINE:
            return (
                f"⚠️ 已保存，但与 {result.most_similar_member_name} 相似度较高。"
                f"建议继续在其他照片中标注自己"
            )
        else:
            return (
                f"❌ 与 {result.most_similar_member_name} 相似度过高，"
                f"请继续添加更多照片或联系管理员"
            )
