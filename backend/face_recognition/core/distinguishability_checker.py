"""
Distinguishability checker for face registration validation.

Ensures that a member's embedding can be reliably distinguished
from all other registered members.
"""

import logging
from typing import List, Dict, Optional, Tuple
from enum import Enum
from dataclasses import dataclass
import numpy as np

from ..config import FaceRecognitionConfig

logger = logging.getLogger(__name__)


class DistinguishabilityStatus(Enum):
    """Registration eligibility status."""
    DISTINGUISHABLE = 'distinguishable'      # Can register
    BORDERLINE = 'borderline'                # Needs more data
    CONFLICT = 'conflict'                    # Cannot reliably distinguish


@dataclass
class DistinguishabilityResult:
    """Result of distinguishability check."""
    status: DistinguishabilityStatus
    max_similarity: float
    most_similar_member_id: Optional[int]
    most_similar_member_name: Optional[str]
    similar_members: List[Dict]
    recommendation: str


class DistinguishabilityChecker:
    """
    Checks if a member's face embedding is distinguishable from others.
    
    This is the key validation for registration - we only allow registration
    if the member can be reliably distinguished from all other members.
    """
    
    def __init__(self, db_session):
        """
        Initialize checker.
        
        Args:
            db_session: SQLAlchemy database session
        """
        self.db = db_session
        self.threshold_distinguishable = FaceRecognitionConfig.DISTINGUISHABLE_THRESHOLD
        self.threshold_borderline = FaceRecognitionConfig.BORDERLINE_THRESHOLD
    
    def check(
        self, 
        member_id: int,
        embedding: List[float]
    ) -> DistinguishabilityResult:
        """
        Check if the embedding is distinguishable from all other members.
        
        Args:
            member_id: Current member's ID (to exclude from comparison)
            embedding: 512-dim embedding as list
            
        Returns:
            DistinguishabilityResult with status and details
        """
        from models.face_models import MemberFace
        from models import Member
        
        # Convert to numpy
        embedding_arr = np.array(embedding, dtype=np.float32)
        
        # Get all other members with registered embeddings
        other_faces = self.db.query(MemberFace, Member).join(
            Member, MemberFace.member_id == Member.id
        ).filter(
            MemberFace.member_id != member_id,
            MemberFace.representative_embedding.isnot(None),
            Member.status == 'active'
        ).all()
        
        if not other_faces:
            # First member to register
            return DistinguishabilityResult(
                status=DistinguishabilityStatus.DISTINGUISHABLE,
                max_similarity=0.0,
                most_similar_member_id=None,
                most_similar_member_name=None,
                similar_members=[],
                recommendation="您是第一个注册的成员，已成功注册"
            )
        
        # Calculate similarity with each member
        similarities = []
        for face, member in other_faces:
            other_embedding = face.get_embedding()
            if other_embedding is None:
                continue
            
            other_arr = np.array(other_embedding, dtype=np.float32)
            sim = self._cosine_similarity(embedding_arr, other_arr)
            
            similarities.append({
                'member_id': member.id,
                'member_name': member.name,
                'similarity': float(sim)
            })
        
        if not similarities:
            return DistinguishabilityResult(
                status=DistinguishabilityStatus.DISTINGUISHABLE,
                max_similarity=0.0,
                most_similar_member_id=None,
                most_similar_member_name=None,
                similar_members=[],
                recommendation="其他成员尚未注册人脸，已成功注册"
            )
        
        # Sort by similarity
        similarities.sort(key=lambda x: x['similarity'], reverse=True)
        max_sim = similarities[0]['similarity']
        most_similar = similarities[0]
        
        # Filter high-similarity members
        high_similarity = [
            s for s in similarities 
            if s['similarity'] >= self.threshold_distinguishable
        ]
        
        # Determine status
        if max_sim < self.threshold_distinguishable:
            status = DistinguishabilityStatus.DISTINGUISHABLE
            recommendation = "特征向量可区分，注册成功"
        elif max_sim < self.threshold_borderline:
            status = DistinguishabilityStatus.BORDERLINE
            recommendation = (
                f"与 {most_similar['member_name']} 相似度较高 ({max_sim:.2f})，"
                f"建议补充更多不同角度的照片以提高区分度"
            )
        else:
            status = DistinguishabilityStatus.CONFLICT
            recommendation = (
                f"与 {most_similar['member_name']} 相似度过高 ({max_sim:.2f})，"
                f"无法可靠区分。请补充更多清晰照片，或联系管理员处理"
            )
        
        return DistinguishabilityResult(
            status=status,
            max_similarity=max_sim,
            most_similar_member_id=most_similar['member_id'],
            most_similar_member_name=most_similar['member_name'],
            similar_members=high_similarity,
            recommendation=recommendation
        )
    
    def check_all_members(self) -> List[Dict]:
        """
        Check distinguishability for all registered members.
        
        Useful for system health checks and finding problematic pairs.
        
        Returns:
            List of members with distinguishability issues
        """
        from models.face_models import MemberFace
        from models import Member
        
        # Get all members with embeddings
        all_faces = self.db.query(MemberFace, Member).join(
            Member, MemberFace.member_id == Member.id
        ).filter(
            MemberFace.representative_embedding.isnot(None),
            Member.status == 'active'
        ).all()
        
        issues = []
        
        for face, member in all_faces:
            embedding = face.get_embedding()
            if embedding is None:
                continue
            
            result = self.check(member.id, embedding)
            
            if result.status != DistinguishabilityStatus.DISTINGUISHABLE:
                issues.append({
                    'member_id': member.id,
                    'member_name': member.name,
                    'status': result.status.value,
                    'max_similarity': result.max_similarity,
                    'most_similar_to': result.most_similar_member_name,
                    'similar_members': result.similar_members,
                })
        
        return issues
    
    @staticmethod
    def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors."""
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
