"""
Face registration service.

Supports two registration methods:
1. Upload personal photos
2. Select self from group photos

Registration is validated by distinguishability check, not by
photo count or quality score.
"""

import logging
from datetime import datetime
from typing import Dict, Optional, List
import json

from database import db
from ..config import FaceRecognitionConfig
from ..core.feature_extractor import get_feature_extractor
from ..core.distinguishability_checker import DistinguishabilityChecker, DistinguishabilityStatus
from ..core.embedding_aggregator import EmbeddingAggregator

logger = logging.getLogger(__name__)


class RegistrationService:
    """
    Handles member face registration.
    
    Key principle: Registration success is determined by distinguishability,
    not by number of photos or quality scores.
    """
    
    def __init__(self, db_session=None):
        """
        Initialize registration service.
        
        Args:
            db_session: SQLAlchemy session (uses default if None)
        """
        self.db = db_session or db.session
        self.extractor = get_feature_extractor()
        self.checker = DistinguishabilityChecker(self.db)
    
    def upload_photo(
        self,
        member_id: int,
        photo_data: bytes,
        photo_url: str
    ) -> Dict:
        """
        Process an uploaded personal photo.
        
        Args:
            member_id: Member's ID
            photo_data: Photo binary data
            photo_url: URL where photo is stored
            
        Returns:
            Registration result with status
        """
        from models.face_models import MemberFace, MemberPhoto
        
        # 1. Extract embedding with validation
        embedding, message, metadata = self.extractor.extract_embedding_with_validation(
            photo_data, require_single_face=True
        )
        
        if embedding is None:
            return {
                'success': False,
                'error': message,
                'metadata': metadata
            }
        
        # 2. Save photo record
        photo = MemberPhoto(
            member_id=member_id,
            photo_url=photo_url,
            source_type='upload',
            face_detected=True,
            face_count=metadata.get('face_count', 1),
            quality_score=metadata.get('quality_score'),
            is_valid=True
        )
        photo.set_embedding(embedding)
        self.db.add(photo)
        
        # 3. Update aggregated embedding
        member_face = self._get_or_create_member_face(member_id)
        aggregated_embedding = self._update_aggregated_embedding(member_id)
        
        # 4. Check distinguishability
        check_result = self.checker.check(member_id, aggregated_embedding)
        
        # 5. Update member face status
        member_face.representative_embedding = json.dumps(aggregated_embedding)
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
        else:  # CONFLICT
            member_face.status = 'conflict'
            member_face.conflict_members = json.dumps(
                [s['member_id'] for s in check_result.similar_members]
            )
        
        self.db.commit()
        
        # 6. Build response
        return {
            'success': True,
            'photo_id': photo.id,
            'registration_status': member_face.status,
            'distinguishability': {
                'status': check_result.status.value,
                'max_similarity': check_result.max_similarity,
                'most_similar_to': check_result.most_similar_member_name,
                'similar_members': check_result.similar_members[:3]
            },
            'recommendation': check_result.recommendation,
            'message': self._get_status_message(check_result)
        }
    
    def get_member_status(self, member_id: int) -> Dict:
        """
        Get member's face registration status.
        
        Args:
            member_id: Member's ID
            
        Returns:
            Status information
        """
        from models.face_models import MemberFace
        from models import Member
        
        member = self.db.query(Member).get(member_id)
        if not member:
            return {'error': '成员不存在'}
        
        face = self.db.query(MemberFace).filter_by(member_id=member_id).first()
        
        if not face:
            return {
                'member_id': member_id,
                'member_name': member.name,
                'status': 'no_photo',
                'photo_count': 0,
                'group_selection_count': 0,
                'can_be_recognized': False
            }
        
        return {
            'member_id': member_id,
            'member_name': member.name,
            'status': face.status,
            'photo_count': face.photo_count or 0,
            'group_selection_count': face.group_selection_count or 0,
            'distinguishability_score': face.distinguishability_score,
            'max_similarity': face.max_similarity,
            'most_similar_member_id': face.most_similar_member_id,
            'registered_at': face.registered_at.isoformat() if face.registered_at else None,
            'can_be_recognized': face.status == 'registered'
        }
    
    def get_member_photos(self, member_id: int) -> List[Dict]:
        """Get all photos for a member."""
        from models.face_models import MemberPhoto
        
        photos = self.db.query(MemberPhoto).filter(
            MemberPhoto.member_id == member_id,
            MemberPhoto.is_valid == True
        ).order_by(MemberPhoto.created_at.desc()).all()
        
        return [p.to_dict() for p in photos]
    
    def delete_photo(self, member_id: int, photo_id: int) -> Dict:
        """
        Delete a member's photo and recalculate embedding.
        
        Args:
            member_id: Member's ID
            photo_id: Photo ID to delete
            
        Returns:
            Updated status
        """
        from models.face_models import MemberPhoto, MemberFace
        
        photo = self.db.query(MemberPhoto).filter_by(
            id=photo_id, member_id=member_id
        ).first()
        
        if not photo:
            return {'success': False, 'error': '照片不存在'}
        
        # Mark as invalid instead of deleting
        photo.is_valid = False
        
        # Check if any valid photos remain
        valid_count = self._count_valid_photos(member_id)
        
        member_face = self.db.query(MemberFace).filter_by(member_id=member_id).first()
        
        if valid_count == 0:
            # No photos left, reset status
            if member_face:
                member_face.status = 'no_photo'
                member_face.representative_embedding = None
                member_face.photo_count = 0
        else:
            # Recalculate embedding and check distinguishability
            aggregated = self._update_aggregated_embedding(member_id)
            check_result = self.checker.check(member_id, aggregated)
            
            member_face.representative_embedding = json.dumps(aggregated)
            member_face.photo_count = valid_count
            member_face.distinguishability_score = 1.0 - check_result.max_similarity
            member_face.max_similarity = check_result.max_similarity
            member_face.last_check_at = datetime.utcnow()
            
            if check_result.status == DistinguishabilityStatus.DISTINGUISHABLE:
                member_face.status = 'registered'
            elif check_result.status == DistinguishabilityStatus.BORDERLINE:
                member_face.status = 'needs_more_data'
            else:
                member_face.status = 'conflict'
        
        self.db.commit()
        
        return {
            'success': True,
            'remaining_photos': valid_count,
            'status': member_face.status if member_face else 'no_photo'
        }
    
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
        """Calculate aggregated embedding from all valid photos."""
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
        
        # Use weighted aggregation
        return EmbeddingAggregator.aggregate(
            embeddings, quality_scores, method='weighted'
        )
    
    def _count_valid_photos(self, member_id: int) -> int:
        """Count valid photos for a member."""
        from models.face_models import MemberPhoto
        
        return self.db.query(MemberPhoto).filter(
            MemberPhoto.member_id == member_id,
            MemberPhoto.is_valid == True
        ).count()
    
    def _get_status_message(self, result) -> str:
        """Generate user-friendly status message."""
        if result.status == DistinguishabilityStatus.DISTINGUISHABLE:
            return "✅ 人脸注册成功！系统可以准确识别您"
        elif result.status == DistinguishabilityStatus.BORDERLINE:
            return (
                f"⚠️ 已保存，但与 {result.most_similar_member_name} 相似度较高。"
                f"建议继续补充不同角度的照片"
            )
        else:
            return (
                f"❌ 与 {result.most_similar_member_name} 相似度过高，"
                f"暂时无法注册。请补充更多照片或联系管理员"
            )
