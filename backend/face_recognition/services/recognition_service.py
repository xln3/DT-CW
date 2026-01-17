"""
Group photo recognition service.

Recognizes faces in group photos and matches them to program members.
Key feature: Program-scoped matching for better accuracy.
"""

import logging
import time
from datetime import datetime
from typing import Dict, List, Optional
import json
import os
import uuid

from database import db
from ..config import FaceRecognitionConfig
from ..core.feature_extractor import get_feature_extractor
from ..core.face_matcher import FaceMatcher

logger = logging.getLogger(__name__)


class RecognitionService:
    """
    Handles group photo face recognition.
    
    Key features:
    - Program-scoped matching (only matches against program members)
    - Automatic attendance update
    - Error recording for calibration triggers
    """
    
    def __init__(self, db_session=None):
        """
        Initialize service.
        
        Args:
            db_session: SQLAlchemy session
        """
        self.db = db_session or db.session
        self.extractor = get_feature_extractor()
        self.matcher = FaceMatcher(self.db)
    
    def recognize_group_photo(
        self,
        photo_data: bytes,
        rehearsal_id: int,
        photo_type: str,
        program_id: int,
        photo_url: str = None,
        save_crops: bool = True
    ) -> Dict:
        """
        Recognize faces in a group photo.
        
        Args:
            photo_data: Photo binary data
            rehearsal_id: Rehearsal ID
            photo_type: 'check_in' or 'check_out'
            program_id: Program ID for scoped matching
            photo_url: URL where original photo is stored
            save_crops: Whether to save face crops
            
        Returns:
            Recognition results with matched members
        """
        from models.face_models import PhotoRecognition, DetectedFace
        from models import Attendance, ProgramMember
        
        start_time = time.time()
        
        # 1. Create recognition record
        recognition = PhotoRecognition(
            rehearsal_id=rehearsal_id,
            photo_type=photo_type,
            photo_url=photo_url or '',
            program_id=program_id,
            status='processing'
        )
        self.db.add(recognition)
        self.db.flush()
        
        try:
            # 2. Detect faces
            detection_start = time.time()
            detected_faces = self.extractor.detect_faces(photo_data)
            detection_time = int((time.time() - detection_start) * 1000)
            
            if not detected_faces:
                recognition.status = 'completed'
                recognition.total_faces = 0
                recognition.detection_time_ms = detection_time
                self.db.commit()
                
                return {
                    'success': True,
                    'recognition_id': recognition.id,
                    'total_faces': 0,
                    'message': '未检测到人脸',
                    'faces': [],
                    'attendance_summary': {}
                }
            
            # 3. Save detected faces
            embeddings = []
            face_records = []
            
            for i, face_data in enumerate(detected_faces):
                face_crop_url = self._save_face_crop(
                    face_data.get('face_crop'),
                    recognition.id,
                    i
                ) if save_crops else f'face_{recognition.id}_{i}.jpg'
                
                face_record = DetectedFace(
                    recognition_id=recognition.id,
                    face_crop_url=face_crop_url,
                    match_status='unmatched'
                )
                face_record.embedding_json = json.dumps(face_data['embedding'])
                
                self.db.add(face_record)
                face_records.append(face_record)
                embeddings.append(face_data['embedding'])
            
            self.db.flush()
            
            # 4. Match faces against program members
            matching_start = time.time()
            match_results = self.matcher.match_faces_in_program(embeddings, program_id)
            matching_time = int((time.time() - matching_start) * 1000)
            
            # 5. Update face records with match results
            matched_count = 0
            uncertain_count = 0
            unmatched_count = 0
            
            for face_record, result in zip(face_records, match_results):
                face_record.match_status = result['match_status']
                face_record.matched_member_id = result.get('matched_member_id')
                face_record.match_confidence = result.get('confidence')
                
                if 'top_candidates' in result:
                    face_record.set_top_candidates(result['top_candidates'])
                
                if result['match_status'] == 'confirmed':
                    matched_count += 1
                elif result['match_status'] == 'uncertain':
                    uncertain_count += 1
                else:
                    unmatched_count += 1
            
            # 6. Update recognition record
            recognition.status = 'completed'
            recognition.total_faces = len(detected_faces)
            recognition.matched_faces = matched_count
            recognition.uncertain_faces = uncertain_count
            recognition.unmatched_faces = unmatched_count
            recognition.detection_time_ms = detection_time
            recognition.matching_time_ms = matching_time
            recognition.completed_at = datetime.utcnow()
            
            # 7. Update attendance records
            attendance_summary = self._update_attendance_records(
                rehearsal_id=rehearsal_id,
                program_id=program_id,
                photo_type=photo_type,
                match_results=match_results
            )
            
            self.db.commit()
            
            total_time = int((time.time() - start_time) * 1000)
            
            # 8. Build response
            return {
                'success': True,
                'recognition_id': recognition.id,
                'program_id': program_id,
                'total_faces': len(detected_faces),
                'matched_count': matched_count,
                'uncertain_count': uncertain_count,
                'unmatched_count': unmatched_count,
                'faces': [
                    {
                        'face_id': face.id,
                        'face_crop_url': face.face_crop_url,
                        'match_status': face.match_status,
                        'matched_member_id': face.matched_member_id,
                        'matched_member_name': (
                            face.matched_member.name 
                            if face.matched_member else None
                        ),
                        'confidence': face.match_confidence,
                        'top_candidates': face.get_top_candidates()
                    }
                    for face in face_records
                ],
                'attendance_summary': attendance_summary,
                'timing': {
                    'detection_ms': detection_time,
                    'matching_ms': matching_time,
                    'total_ms': total_time
                }
            }
            
        except Exception as e:
            recognition.status = 'failed'
            recognition.error_message = str(e)
            self.db.commit()
            
            logger.error(f"Recognition failed: {e}")
            raise
    
    def annotate_face(
        self,
        detected_face_id: int,
        member_id: Optional[int],
        annotated_by: int,
        feedback_type: str = 'correct'
    ) -> Dict:
        """
        Manually annotate or correct a detected face.

        This method also updates the member's face embedding if a member is
        specified, allowing the system to learn from manual corrections.

        Args:
            detected_face_id: Face ID to annotate
            member_id: Member ID (None if not a member)
            annotated_by: User ID who made the annotation
            feedback_type: 'correct', 'incorrect', 'unknown'

        Returns:
            Annotation result with optional registration status update
        """
        from models.face_models import DetectedFace, RecognitionError, MemberPhoto, MemberFace
        from ..core.distinguishability_checker import DistinguishabilityChecker, DistinguishabilityStatus
        from ..core.embedding_aggregator import EmbeddingAggregator

        face = self.db.query(DetectedFace).get(detected_face_id)
        if not face:
            return {'success': False, 'error': '人脸不存在'}

        # Record error if this is a correction
        if face.matched_member_id != member_id and face.match_status == 'confirmed':
            error = RecognitionError(
                rehearsal_id=face.recognition.rehearsal_id,
                photo_type=face.recognition.photo_type,
                detected_face_id=face.id,
                error_type='misidentification' if member_id else 'false_positive',
                predicted_member_id=face.matched_member_id,
                predicted_confidence=face.match_confidence,
                actual_member_id=member_id,
                corrected_by=annotated_by,
                corrected_at=datetime.utcnow()
            )
            self.db.add(error)

        # Update face annotation
        old_matched_id = face.matched_member_id
        old_annotated_id = face.annotated_member_id
        old_match_status = face.match_status

        face.annotated_member_id = member_id
        face.annotated_by = annotated_by
        face.annotated_at = datetime.utcnow()
        face.annotation_type = 'admin'
        face.match_status = 'manual'

        # Update attendance
        # For manual annotation, we need to:
        # 1. Remove detection from old annotated member (if any)
        # 2. Add detection to new annotated member (if any)
        # Note: For uncertain/unmatched faces, matched_member_id was never
        # added to attendance, so we only care about annotated_member_id
        if old_match_status == 'confirmed' and old_matched_id:
            # Face was auto-confirmed, need to remove from old matched member
            self._fix_attendance(
                face.recognition,
                old_matched_id,
                member_id
            )
        elif old_annotated_id:
            # Face was previously manually annotated, update from old to new
            if old_annotated_id != member_id:
                self._fix_attendance(
                    face.recognition,
                    old_annotated_id,
                    member_id
                )
        else:
            # Face was uncertain/unmatched and never in attendance, just add new
            self._fix_attendance(
                face.recognition,
                None,  # No old member to remove
                member_id
            )

        result = {
            'success': True,
            'face_id': face.id,
            'annotated_member_id': member_id
        }

        # Learn from annotation: add face embedding to member's data
        if member_id and face.embedding_json:
            embedding = json.loads(face.embedding_json)

            # Check if this face was already added to member's photos
            existing_photo = self.db.query(MemberPhoto).filter_by(
                source_detected_face_id=face.id,
                member_id=member_id
            ).first()

            if not existing_photo:
                # Create MemberPhoto record
                photo = MemberPhoto(
                    member_id=member_id,
                    photo_url=face.face_crop_url,
                    source_type='group_photo',
                    source_recognition_id=face.recognition_id,
                    source_detected_face_id=face.id,
                    is_self_annotated=False,
                    face_detected=True,
                    face_count=1,
                    quality_score=0.7,  # Default for group photo crops
                    is_valid=True
                )
                photo.set_embedding(embedding)
                self.db.add(photo)

                # Update member's aggregated embedding
                member_face = self.db.query(MemberFace).filter_by(member_id=member_id).first()
                if not member_face:
                    member_face = MemberFace(member_id=member_id, status='processing')
                    self.db.add(member_face)
                    self.db.flush()

                try:
                    aggregated = self._aggregate_member_embedding(member_id)
                    checker = DistinguishabilityChecker(self.db)
                    check_result = checker.check(member_id, aggregated)

                    member_face.representative_embedding = json.dumps(aggregated)
                    member_face.photo_count = self._count_member_photos(member_id)
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
                    else:
                        member_face.status = 'conflict'

                    result['embedding_updated'] = True
                    result['registration_status'] = member_face.status
                    result['distinguishability_score'] = member_face.distinguishability_score

                except Exception as e:
                    logger.warning(f"Failed to update embedding for member {member_id}: {e}")
                    result['embedding_updated'] = False

        self.db.commit()

        return result

    def _aggregate_member_embedding(self, member_id: int) -> List[float]:
        """Calculate aggregated embedding from all valid photos."""
        from models.face_models import MemberPhoto
        from ..core.embedding_aggregator import EmbeddingAggregator

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

    def _count_member_photos(self, member_id: int) -> int:
        """Count valid photos for a member."""
        from models.face_models import MemberPhoto

        return self.db.query(MemberPhoto).filter(
            MemberPhoto.member_id == member_id,
            MemberPhoto.is_valid == True
        ).count()
    
    def get_recognition_result(self, recognition_id: int) -> Dict:
        """Get recognition result details."""
        from models.face_models import PhotoRecognition
        
        recognition = self.db.query(PhotoRecognition).get(recognition_id)
        if not recognition:
            return {'error': '识别记录不存在'}
        
        return recognition.to_dict(include_faces=True)
    
    def _update_attendance_records(
        self,
        rehearsal_id: int,
        program_id: int,
        photo_type: str,
        match_results: List[Dict]
    ) -> Dict:
        """Update attendance based on recognition results."""
        from models import Attendance, ProgramMember
        
        # Get matched member IDs
        matched_ids = {
            r['matched_member_id'] 
            for r in match_results 
            if r.get('matched_member_id') and r['match_status'] == 'confirmed'
        }
        
        # Get all program members
        program_members = self.db.query(ProgramMember).filter(
            ProgramMember.program_id == program_id,
            ProgramMember.status == 'active'
        ).all()
        
        detected = []
        not_detected = []
        
        for pm in program_members:
            # Get or create attendance
            attendance = self.db.query(Attendance).filter_by(
                rehearsal_id=rehearsal_id,
                member_id=pm.member_id
            ).first()
            
            if not attendance:
                attendance = Attendance(
                    rehearsal_id=rehearsal_id,
                    member_id=pm.member_id
                )
                self.db.add(attendance)
            
            # Update detection flag
            is_detected = pm.member_id in matched_ids
            
            if photo_type == 'check_in':
                attendance.detected_before = is_detected
            else:
                attendance.detected_after = is_detected
            
            attendance.calculate_status()
            
            if is_detected:
                detected.append(pm.member_id)
            else:
                not_detected.append(pm.member_id)
        
        return {
            'detected': detected,
            'not_detected': not_detected,
            'total_members': len(program_members)
        }
    
    def _fix_attendance(
        self,
        recognition,
        old_member_id: Optional[int],
        new_member_id: Optional[int]
    ):
        """Fix attendance when annotation is corrected."""
        from models import Attendance
        
        # Remove old detection
        if old_member_id:
            old_attendance = self.db.query(Attendance).filter_by(
                rehearsal_id=recognition.rehearsal_id,
                member_id=old_member_id
            ).first()
            
            if old_attendance:
                if recognition.photo_type == 'check_in':
                    old_attendance.detected_before = False
                else:
                    old_attendance.detected_after = False
                old_attendance.calculate_status()
        
        # Add new detection
        if new_member_id:
            new_attendance = self.db.query(Attendance).filter_by(
                rehearsal_id=recognition.rehearsal_id,
                member_id=new_member_id
            ).first()
            
            if not new_attendance:
                new_attendance = Attendance(
                    rehearsal_id=recognition.rehearsal_id,
                    member_id=new_member_id
                )
                self.db.add(new_attendance)
            
            if recognition.photo_type == 'check_in':
                new_attendance.detected_before = True
            else:
                new_attendance.detected_after = True
            new_attendance.calculate_status()
    
    def _save_face_crop(
        self,
        face_crop_data: bytes,
        recognition_id: int,
        face_index: int
    ) -> str:
        """
        Save face crop image to disk.

        Args:
            face_crop_data: JPEG image bytes
            recognition_id: Recognition ID for organizing files
            face_index: Index of the face in the photo

        Returns:
            URL path to access the saved image
        """
        from flask import current_app

        if not face_crop_data or len(face_crop_data) < 100:
            # Invalid or placeholder data (mock mode)
            return ''

        # Create directory
        upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        face_crop_dir = os.path.join(upload_folder, 'face_crops', str(recognition_id))
        os.makedirs(face_crop_dir, exist_ok=True)

        # Generate filename
        filename = f"{face_index}_{uuid.uuid4().hex[:8]}.jpg"
        filepath = os.path.join(face_crop_dir, filename)

        # Save file
        try:
            with open(filepath, 'wb') as f:
                f.write(face_crop_data)
            return f"/uploads/face_crops/{recognition_id}/{filename}"
        except Exception as e:
            logger.error(f"Failed to save face crop: {e}")
            return ''
