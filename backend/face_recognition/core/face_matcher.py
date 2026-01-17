"""
Face matcher for group photo recognition.

Key feature: Program-scoped matching - only matches against
members of the specific program, not the entire troupe.
"""

import logging
from typing import List, Dict, Set, Optional
import numpy as np

from ..config import FaceRecognitionConfig

logger = logging.getLogger(__name__)


class FaceMatcher:
    """
    Matches detected faces against registered member embeddings.
    
    Supports program-scoped matching for better accuracy and performance.
    """
    
    def __init__(self, db_session):
        """
        Initialize matcher.
        
        Args:
            db_session: SQLAlchemy database session
        """
        self.db = db_session
        self.threshold_confirmed = FaceRecognitionConfig.MATCH_THRESHOLD_CONFIRMED
        self.threshold_uncertain = FaceRecognitionConfig.MATCH_THRESHOLD_UNCERTAIN
    
    def match_faces_in_program(
        self,
        detected_embeddings: List[List[float]],
        program_id: int
    ) -> List[Dict]:
        """
        Match detected faces against program members only.
        
        Args:
            detected_embeddings: List of 512-dim embeddings from detected faces
            program_id: Program ID to scope the matching
            
        Returns:
            List of match results for each detected face
        """
        # Get program members with embeddings
        program_members = self._get_program_members_with_embeddings(program_id)
        
        if not program_members:
            logger.warning(f"No registered members found for program {program_id}")
            return [
                {
                    'face_index': i,
                    'match_status': 'unmatched',
                    'reason': 'no_registered_members'
                }
                for i in range(len(detected_embeddings))
            ]
        
        # Track used members to avoid duplicate matches
        used_member_ids: Set[int] = set()
        results = []
        
        for i, embedding in enumerate(detected_embeddings):
            embedding_arr = np.array(embedding, dtype=np.float32)
            
            # Calculate similarity with all available program members
            similarities = []
            for member in program_members:
                if member['member_id'] in used_member_ids:
                    continue  # Skip already matched members
                
                member_embedding = np.array(member['embedding'], dtype=np.float32)
                sim = self._cosine_similarity(embedding_arr, member_embedding)
                
                # Apply confidence weighting if available
                confidence = member.get('confidence', 1.0)
                weighted_sim = sim * (0.8 + 0.2 * confidence)
                
                similarities.append({
                    'member_id': member['member_id'],
                    'member_name': member['name'],
                    'raw_similarity': float(sim),
                    'weighted_similarity': float(weighted_sim),
                    'face_status': member['face_status'],
                })
            
            # Sort by weighted similarity
            similarities.sort(key=lambda x: x['weighted_similarity'], reverse=True)
            
            # Determine match status
            if similarities:
                best = similarities[0]
                raw_sim = best['raw_similarity']
                
                if raw_sim >= self.threshold_confirmed:
                    status = 'confirmed'
                    used_member_ids.add(best['member_id'])
                elif raw_sim >= self.threshold_uncertain:
                    status = 'uncertain'
                else:
                    status = 'unmatched'
                
                result = {
                    'face_index': i,
                    'match_status': status,
                    'matched_member_id': best['member_id'] if status != 'unmatched' else None,
                    'matched_member_name': best['member_name'] if status != 'unmatched' else None,
                    'confidence': raw_sim,
                    'top_candidates': [
                        {
                            'member_id': s['member_id'],
                            'member_name': s['member_name'],
                            'similarity': s['raw_similarity']
                        }
                        for s in similarities[:3]
                    ]
                }
            else:
                result = {
                    'face_index': i,
                    'match_status': 'unmatched',
                    'reason': 'no_available_candidates'
                }
            
            results.append(result)
        
        return results
    
    def match_single_face(
        self,
        embedding: List[float],
        program_id: Optional[int] = None
    ) -> Dict:
        """
        Match a single face embedding.
        
        Args:
            embedding: 512-dim embedding
            program_id: Optional program ID to scope matching
            
        Returns:
            Match result with top candidates
        """
        if program_id:
            members = self._get_program_members_with_embeddings(program_id)
        else:
            members = self._get_all_members_with_embeddings()
        
        if not members:
            return {
                'match_status': 'unmatched',
                'reason': 'no_registered_members'
            }
        
        embedding_arr = np.array(embedding, dtype=np.float32)
        
        similarities = []
        for member in members:
            member_embedding = np.array(member['embedding'], dtype=np.float32)
            sim = self._cosine_similarity(embedding_arr, member_embedding)
            
            similarities.append({
                'member_id': member['member_id'],
                'member_name': member['name'],
                'similarity': float(sim)
            })
        
        similarities.sort(key=lambda x: x['similarity'], reverse=True)
        
        best = similarities[0]
        sim = best['similarity']
        
        if sim >= self.threshold_confirmed:
            status = 'confirmed'
        elif sim >= self.threshold_uncertain:
            status = 'uncertain'
        else:
            status = 'unmatched'
        
        return {
            'match_status': status,
            'matched_member_id': best['member_id'] if status != 'unmatched' else None,
            'matched_member_name': best['member_name'] if status != 'unmatched' else None,
            'confidence': sim,
            'top_candidates': similarities[:5]
        }
    
    def _get_program_members_with_embeddings(self, program_id: int) -> List[Dict]:
        """Get members of a program with their embeddings."""
        from models import Member, Program, ProgramMember
        from models.face_models import MemberFace
        
        # Query program members with face data
        results = self.db.query(
            Member, MemberFace
        ).join(
            ProgramMember, Member.id == ProgramMember.member_id
        ).outerjoin(
            MemberFace, Member.id == MemberFace.member_id
        ).filter(
            ProgramMember.program_id == program_id,
            ProgramMember.status == 'active',
            Member.status == 'active'
        ).all()
        
        members = []
        for member, face in results:
            if face is None or face.representative_embedding is None:
                continue
            
            embedding = face.get_embedding()
            if embedding is None:
                continue
            
            members.append({
                'member_id': member.id,
                'name': member.name,
                'embedding': embedding,
                'face_status': face.status,
                'confidence': face.distinguishability_score or 1.0
            })
        
        return members
    
    def _get_all_members_with_embeddings(self) -> List[Dict]:
        """Get all members with embeddings."""
        from models import Member
        from models.face_models import MemberFace
        
        results = self.db.query(Member, MemberFace).outerjoin(
            MemberFace, Member.id == MemberFace.member_id
        ).filter(
            Member.status == 'active',
            MemberFace.representative_embedding.isnot(None)
        ).all()
        
        members = []
        for member, face in results:
            embedding = face.get_embedding()
            if embedding is None:
                continue
            
            members.append({
                'member_id': member.id,
                'name': member.name,
                'embedding': embedding,
                'face_status': face.status,
                'confidence': face.distinguishability_score or 1.0
            })
        
        return members
    
    @staticmethod
    def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        """Calculate cosine similarity."""
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
