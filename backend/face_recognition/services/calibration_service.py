"""
Calibration service for face recognition improvement.

Key design:
- Triggered by error history, not proactive for all members
- Analyzes recognition errors to identify problematic members
- Generates targeted calibration tasks
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import json
import secrets

from database import db
from ..config import FaceRecognitionConfig

logger = logging.getLogger(__name__)


class CalibrationService:
    """
    Manages calibration tasks based on recognition error history.
    
    Flow:
    1. Recognition errors are recorded
    2. Periodic analysis identifies members with issues
    3. Targeted calibration tasks are generated
    4. Members complete tasks to improve their embeddings
    """
    
    def __init__(self, db_session=None):
        """
        Initialize service.
        
        Args:
            db_session: SQLAlchemy session
        """
        self.db = db_session or db.session
        self.error_threshold = FaceRecognitionConfig.ERROR_COUNT_THRESHOLD
        self.confusion_threshold = FaceRecognitionConfig.CONFUSION_COUNT_THRESHOLD
        self.analysis_days = FaceRecognitionConfig.ANALYSIS_PERIOD_DAYS
    
    # ==========================================
    # Error Analysis
    # ==========================================
    
    def analyze_errors(self) -> Dict:
        """
        Analyze recognition errors and generate calibration tasks.
        
        This should be run periodically (daily/weekly).
        
        Returns:
            Analysis summary
        """
        from models.face_models import (
            RecognitionError, ConfusionPair, CalibrationTask, MemberFace
        )
        from models import Member
        
        period_start = datetime.utcnow() - timedelta(days=self.analysis_days)
        
        results = {
            'analyzed_at': datetime.utcnow().isoformat(),
            'period_days': self.analysis_days,
            'problem_members': [],
            'confusion_pairs': [],
            'tasks_created': 0
        }
        
        # 1. Find members with frequent errors
        problem_members = self._find_problem_members(period_start)
        results['problem_members'] = problem_members
        
        # 2. Find confusion pairs
        confusion_pairs = self._find_confusion_pairs(period_start)
        results['confusion_pairs'] = confusion_pairs
        
        # 3. Generate calibration tasks
        for member_data in problem_members:
            member_id = member_data['member_id']
            
            # Find if member is involved in any confusion pairs
            member_confusions = [
                cp for cp in confusion_pairs
                if member_id in (cp['member_a_id'], cp['member_b_id'])
            ]
            
            tasks = self._generate_tasks_for_member(
                member_data, member_confusions
            )
            results['tasks_created'] += len(tasks)
        
        return results
    
    def _find_problem_members(self, since: datetime) -> List[Dict]:
        """Find members with frequent recognition errors."""
        from models.face_models import RecognitionError
        from models import Member
        from sqlalchemy import func
        
        # Count errors per member
        error_counts = self.db.query(
            RecognitionError.actual_member_id.label('member_id'),
            func.count(RecognitionError.id).label('error_count'),
            func.sum(
                (RecognitionError.error_type == 'false_negative').cast(db.Integer)
            ).label('fn_count'),
            func.sum(
                (RecognitionError.error_type == 'false_positive').cast(db.Integer)
            ).label('fp_count'),
            func.sum(
                (RecognitionError.error_type == 'misidentification').cast(db.Integer)
            ).label('mis_count')
        ).filter(
            RecognitionError.created_at >= since,
            RecognitionError.actual_member_id.isnot(None)
        ).group_by(
            RecognitionError.actual_member_id
        ).having(
            func.count(RecognitionError.id) >= self.error_threshold
        ).all()
        
        results = []
        for row in error_counts:
            member = self.db.query(Member).get(row.member_id)
            if member:
                results.append({
                    'member_id': row.member_id,
                    'member_name': member.name,
                    'error_count': row.error_count,
                    'false_negative_count': row.fn_count or 0,
                    'false_positive_count': row.fp_count or 0,
                    'misidentification_count': row.mis_count or 0
                })
        
        return results
    
    def _find_confusion_pairs(self, since: datetime) -> List[Dict]:
        """Find frequently confused member pairs."""
        from models.face_models import RecognitionError, ConfusionPair
        from models import Member
        from sqlalchemy import func, and_, or_
        
        # Find misidentification patterns
        confusion_counts = self.db.query(
            func.least(
                RecognitionError.predicted_member_id,
                RecognitionError.actual_member_id
            ).label('member_a_id'),
            func.greatest(
                RecognitionError.predicted_member_id,
                RecognitionError.actual_member_id
            ).label('member_b_id'),
            func.count(RecognitionError.id).label('confusion_count')
        ).filter(
            RecognitionError.created_at >= since,
            RecognitionError.error_type == 'misidentification',
            RecognitionError.predicted_member_id.isnot(None),
            RecognitionError.actual_member_id.isnot(None)
        ).group_by(
            'member_a_id', 'member_b_id'
        ).having(
            func.count(RecognitionError.id) >= self.confusion_threshold
        ).all()
        
        results = []
        for row in confusion_counts:
            member_a = self.db.query(Member).get(row.member_a_id)
            member_b = self.db.query(Member).get(row.member_b_id)
            
            if member_a and member_b:
                # Update or create ConfusionPair record
                pair = self.db.query(ConfusionPair).filter(
                    ConfusionPair.member_a_id == row.member_a_id,
                    ConfusionPair.member_b_id == row.member_b_id
                ).first()
                
                if not pair:
                    pair = ConfusionPair(
                        member_a_id=row.member_a_id,
                        member_b_id=row.member_b_id
                    )
                    self.db.add(pair)
                
                pair.confusion_count = row.confusion_count
                pair.last_confusion_at = datetime.utcnow()
                
                results.append({
                    'pair_id': pair.id if pair.id else None,
                    'member_a_id': row.member_a_id,
                    'member_a_name': member_a.name,
                    'member_b_id': row.member_b_id,
                    'member_b_name': member_b.name,
                    'confusion_count': row.confusion_count
                })
        
        self.db.commit()
        return results
    
    def _generate_tasks_for_member(
        self,
        member_data: Dict,
        confusions: List[Dict]
    ) -> List[Dict]:
        """Generate calibration tasks for a problem member."""
        from models.face_models import CalibrationTask, MemberFace
        
        member_id = member_data['member_id']
        tasks_created = []
        
        # Get member's current face status
        face = self.db.query(MemberFace).filter_by(member_id=member_id).first()
        photo_count = face.photo_count if face else 0
        
        # Rule 1: Few photos -> upload more
        if photo_count < 3:
            task = self._create_task_if_not_exists(
                member_id=member_id,
                task_type='upload_photo',
                reason=f"当前仅有{photo_count}张照片，建议补充更多照片以提高识别准确率",
                priority=8
            )
            if task:
                tasks_created.append(task)
        
        # Rule 2: Has confusion pair -> nine-grid challenge
        if confusions:
            worst = max(confusions, key=lambda x: x['confusion_count'])
            other_id = (
                worst['member_b_id'] 
                if worst['member_a_id'] == member_id 
                else worst['member_a_id']
            )
            other_name = (
                worst['member_b_name']
                if worst['member_a_id'] == member_id
                else worst['member_a_name']
            )
            
            task = self._create_task_if_not_exists(
                member_id=member_id,
                task_type='resolve_confusion',
                reason=f"系统经常将您与 {other_name} 混淆，请完成校准以帮助系统区分",
                priority=7,
                confusion_pair_id=worst.get('pair_id')
            )
            if task:
                tasks_created.append(task)
        
        # Rule 3: Many false negatives -> confirm in photos
        if member_data.get('false_negative_count', 0) >= 2:
            task = self._create_task_if_not_exists(
                member_id=member_id,
                task_type='confirm_in_photo',
                reason="系统多次未能识别出您，请帮助确认您在合照中的位置",
                priority=6
            )
            if task:
                tasks_created.append(task)
        
        return tasks_created
    
    def _create_task_if_not_exists(
        self,
        member_id: int,
        task_type: str,
        reason: str,
        priority: int,
        **kwargs
    ) -> Optional[Dict]:
        """Create task if no pending task of same type exists."""
        from models.face_models import CalibrationTask
        
        # Check for existing pending task
        existing = self.db.query(CalibrationTask).filter(
            CalibrationTask.member_id == member_id,
            CalibrationTask.task_type == task_type,
            CalibrationTask.status.in_(['pending', 'notified', 'in_progress'])
        ).first()
        
        if existing:
            return None
        
        task = CalibrationTask.create_task(
            member_id=member_id,
            task_type=task_type,
            reason=reason,
            priority=priority,
            **kwargs
        )
        self.db.add(task)
        self.db.commit()
        
        return {
            'task_id': task.id,
            'task_type': task_type,
            'priority': priority
        }
    
    # ==========================================
    # Task Management
    # ==========================================
    
    def get_member_tasks(self, member_id: int) -> List[Dict]:
        """Get pending calibration tasks for a member."""
        from models.face_models import CalibrationTask
        
        tasks = self.db.query(CalibrationTask).filter(
            CalibrationTask.member_id == member_id,
            CalibrationTask.status.in_(['pending', 'notified']),
            CalibrationTask.expires_at > datetime.utcnow()
        ).order_by(
            CalibrationTask.priority.desc()
        ).all()
        
        return [t.to_dict() for t in tasks]
    
    def start_task(self, task_id: int, member_id: int) -> Dict:
        """Mark a task as started."""
        from models.face_models import CalibrationTask
        
        task = self.db.query(CalibrationTask).filter_by(
            id=task_id,
            member_id=member_id
        ).first()
        
        if not task:
            return {'success': False, 'error': '任务不存在'}
        
        if task.status not in ['pending', 'notified']:
            return {'success': False, 'error': '任务状态不正确'}
        
        task.status = 'in_progress'
        task.started_at = datetime.utcnow()
        self.db.commit()
        
        return {'success': True, 'task': task.to_dict()}
    
    def complete_task(
        self, 
        task_id: int, 
        member_id: int,
        result: Dict = None
    ) -> Dict:
        """Mark a task as completed."""
        from models.face_models import CalibrationTask
        
        task = self.db.query(CalibrationTask).filter_by(
            id=task_id,
            member_id=member_id
        ).first()
        
        if not task:
            return {'success': False, 'error': '任务不存在'}
        
        task.status = 'completed'
        task.completed_at = datetime.utcnow()
        if result:
            task.result = json.dumps(result)
        
        self.db.commit()
        
        return {'success': True}
    
    def skip_task(self, task_id: int, member_id: int) -> Dict:
        """Skip a task."""
        from models.face_models import CalibrationTask
        
        task = self.db.query(CalibrationTask).filter_by(
            id=task_id,
            member_id=member_id
        ).first()
        
        if not task:
            return {'success': False, 'error': '任务不存在'}
        
        task.status = 'skipped'
        self.db.commit()
        
        return {'success': True}
    
    # ==========================================
    # Nine-Grid Challenge
    # ==========================================
    
    def generate_challenge(
        self,
        member_id: int,
        task_id: Optional[int] = None,
        focused_member_id: Optional[int] = None,
        difficulty: str = 'medium'
    ) -> Dict:
        """
        Generate a nine-grid calibration challenge.
        
        Args:
            member_id: Target member
            task_id: Associated task (optional)
            focused_member_id: Specific member to include in confusion samples
            difficulty: easy/medium/hard
            
        Returns:
            Challenge data with image grid
        """
        from models.face_models import (
            CalibrationChallenge, MemberFace, MemberPhoto
        )
        from models import Member
        
        # Get target member's photos
        target_photos = self.db.query(MemberPhoto).filter(
            MemberPhoto.member_id == member_id,
            MemberPhoto.is_valid == True
        ).all()
        
        if not target_photos:
            return {'success': False, 'error': '您还没有上传照片'}
        
        target_photo = target_photos[0]
        target_embedding = target_photo.get_embedding()
        
        if not target_embedding:
            return {'success': False, 'error': '照片特征提取失败'}
        
        # Get confusion samples
        confusing_samples = self._get_confusing_samples(
            member_id=member_id,
            target_embedding=target_embedding,
            focused_member_id=focused_member_id,
            difficulty=difficulty,
            count=8
        )
        
        if len(confusing_samples) < 4:
            return {
                'success': False, 
                'error': '成员数量不足，无法生成校准挑战'
            }
        
        # Build 9-grid
        import random
        target_position = random.randint(1, 9)
        
        images = []
        confusing_data = []
        conf_index = 0
        
        for pos in range(1, 10):
            if pos == target_position:
                images.append({
                    'position': pos,
                    'image_url': target_photo.photo_url
                })
            else:
                if conf_index < len(confusing_samples):
                    sample = confusing_samples[conf_index]
                    images.append({
                        'position': pos,
                        'image_url': sample['photo_url']
                    })
                    confusing_data.append({
                        'member_id': sample['member_id'],
                        'photo_id': sample['photo_id'],
                        'similarity': sample['similarity'],
                        'position': pos
                    })
                    conf_index += 1
        
        # Create challenge record
        challenge = CalibrationChallenge(
            member_id=member_id,
            task_id=task_id,
            challenge_token=secrets.token_urlsafe(32),
            target_photo_id=target_photo.id,
            target_position=target_position,
            difficulty=difficulty,
            focused_member_id=focused_member_id,
            status='pending',
            expires_at=datetime.utcnow() + timedelta(
                seconds=FaceRecognitionConfig.CHALLENGE_EXPIRE_SECONDS
            )
        )
        challenge.set_confusing_data(confusing_data)
        
        self.db.add(challenge)
        self.db.commit()
        
        return {
            'success': True,
            'challenge_token': challenge.challenge_token,
            'images': images,
            'expires_at': challenge.expires_at.isoformat()
        }
    
    def verify_challenge(
        self,
        member_id: int,
        challenge_token: str,
        selected_position: int
    ) -> Dict:
        """
        Verify a challenge answer.
        
        Args:
            member_id: Member who answered
            challenge_token: Challenge token
            selected_position: Position selected (1-9)
            
        Returns:
            Verification result
        """
        from models.face_models import CalibrationChallenge, CalibrationTask
        
        challenge = self.db.query(CalibrationChallenge).filter_by(
            challenge_token=challenge_token,
            member_id=member_id
        ).first()
        
        if not challenge:
            return {'success': False, 'error': '挑战不存在'}
        
        if challenge.status != 'pending':
            return {'success': False, 'error': '挑战已完成或过期'}
        
        if datetime.utcnow() > challenge.expires_at:
            challenge.status = 'expired'
            self.db.commit()
            return {'success': False, 'error': '挑战已过期'}
        
        # Check answer
        is_correct = (selected_position == challenge.target_position)
        
        challenge.status = 'answered'
        challenge.selected_position = selected_position
        challenge.is_correct = is_correct
        challenge.answered_at = datetime.utcnow()
        
        # Update associated task if exists
        if challenge.task_id:
            task = self.db.query(CalibrationTask).get(challenge.task_id)
            if task and is_correct:
                # Simple completion - in production, might require multiple correct answers
                task.status = 'completed'
                task.completed_at = datetime.utcnow()
        
        self.db.commit()
        
        result = {
            'success': True,
            'is_correct': is_correct,
            'correct_position': challenge.target_position if not is_correct else None
        }
        
        if is_correct:
            result['message'] = "✅ 回答正确！"
        else:
            result['message'] = f"❌ 回答错误，正确位置是 {challenge.target_position}"
        
        return result
    
    def _get_confusing_samples(
        self,
        member_id: int,
        target_embedding: List[float],
        focused_member_id: Optional[int],
        difficulty: str,
        count: int
    ) -> List[Dict]:
        """Get confusing samples for nine-grid challenge."""
        from models.face_models import MemberPhoto, MemberFace
        from models import Member
        import numpy as np
        
        min_sim, max_sim = FaceRecognitionConfig.get_difficulty_range(difficulty)
        
        # Get all other members' photos
        other_photos = self.db.query(MemberPhoto, Member).join(
            Member, MemberPhoto.member_id == Member.id
        ).filter(
            MemberPhoto.member_id != member_id,
            MemberPhoto.is_valid == True,
            MemberPhoto.embedding_json.isnot(None),
            Member.status == 'active'
        ).all()
        
        target_arr = np.array(target_embedding, dtype=np.float32)
        candidates = []
        
        for photo, member in other_photos:
            embedding = photo.get_embedding()
            if not embedding:
                continue
            
            other_arr = np.array(embedding, dtype=np.float32)
            sim = float(np.dot(target_arr, other_arr) / (
                np.linalg.norm(target_arr) * np.linalg.norm(other_arr)
            ))
            
            # Check if in difficulty range
            if min_sim <= sim <= max_sim:
                candidates.append({
                    'member_id': member.id,
                    'photo_id': photo.id,
                    'photo_url': photo.photo_url,
                    'similarity': sim,
                    'is_focused': member.id == focused_member_id
                })
        
        # Prioritize focused member if specified
        if focused_member_id:
            focused = [c for c in candidates if c['is_focused']]
            others = [c for c in candidates if not c['is_focused']]
            
            import random
            random.shuffle(others)
            
            # Include focused member + random others
            result = focused[:1] + others[:count-1]
        else:
            import random
            random.shuffle(candidates)
            result = candidates[:count]
        
        return result
    
    # ==========================================
    # Statistics
    # ==========================================
    
    def get_error_statistics(self) -> Dict:
        """Get overall recognition error statistics."""
        from models.face_models import RecognitionError, ConfusionPair
        from sqlalchemy import func
        
        period_start = datetime.utcnow() - timedelta(days=self.analysis_days)
        
        # Error counts by type
        error_stats = self.db.query(
            RecognitionError.error_type,
            func.count(RecognitionError.id)
        ).filter(
            RecognitionError.created_at >= period_start
        ).group_by(RecognitionError.error_type).all()
        
        # Confusion pair stats
        active_pairs = self.db.query(ConfusionPair).filter(
            ConfusionPair.calibration_status.in_(['pending', 'in_progress'])
        ).count()
        
        return {
            'period_days': self.analysis_days,
            'error_counts': {e[0]: e[1] for e in error_stats},
            'total_errors': sum(e[1] for e in error_stats),
            'active_confusion_pairs': active_pairs
        }
