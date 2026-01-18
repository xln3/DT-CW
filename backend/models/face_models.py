"""Extended face recognition models."""
from datetime import datetime, timedelta
from database import db
import json


class MemberFace(db.Model):
    """Member face registration status and aggregated embedding."""
    __tablename__ = 'member_faces'

    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False, unique=True)
    
    # Registration status
    status = db.Column(db.String(20), default='no_photo')
    # no_photo, processing, registered, needs_more_data, conflict, suspended
    
    # Aggregated representative embedding (512-dim JSON array)
    representative_embedding = db.Column(db.Text)
    
    # Distinguishability metrics
    distinguishability_score = db.Column(db.Float)  # 1 - max_similarity
    max_similarity = db.Column(db.Float)  # Highest similarity to any other member
    most_similar_member_id = db.Column(db.Integer, db.ForeignKey('members.id'))
    conflict_members = db.Column(db.Text)  # JSON array of conflicting member IDs
    
    # Statistics
    photo_count = db.Column(db.Integer, default=0)
    group_selection_count = db.Column(db.Integer, default=0)
    
    # Timestamps
    last_check_at = db.Column(db.DateTime)
    registered_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    member = db.relationship('Member', foreign_keys=[member_id], backref='face_info')
    photos = db.relationship('MemberPhoto', back_populates='member_face', lazy='dynamic')

    # Status constants
    STATUS_NO_PHOTO = 'no_photo'
    STATUS_PROCESSING = 'processing'
    STATUS_REGISTERED = 'registered'
    STATUS_NEEDS_MORE_DATA = 'needs_more_data'
    STATUS_CONFLICT = 'conflict'
    STATUS_SUSPENDED = 'suspended'

    def get_embedding(self):
        """Parse embedding JSON to numpy-compatible list."""
        if self.representative_embedding:
            return json.loads(self.representative_embedding)
        return None

    def set_embedding(self, embedding_list):
        """Set embedding from list."""
        self.representative_embedding = json.dumps(embedding_list)

    def get_conflict_member_ids(self):
        """Get list of conflicting member IDs."""
        if self.conflict_members:
            return json.loads(self.conflict_members)
        return []

    def to_dict(self):
        return {
            'id': self.id,
            'member_id': self.member_id,
            'status': self.status,
            'distinguishability_score': self.distinguishability_score,
            'max_similarity': self.max_similarity,
            'most_similar_member_id': self.most_similar_member_id,
            'photo_count': self.photo_count,
            'group_selection_count': self.group_selection_count,
            'registered_at': self.registered_at.isoformat() if self.registered_at else None,
            'last_check_at': self.last_check_at.isoformat() if self.last_check_at else None,
        }


class MemberPhoto(db.Model):
    """Individual photos uploaded or selected by members."""
    __tablename__ = 'member_photos'

    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    member_face_id = db.Column(db.Integer, db.ForeignKey('member_faces.id'))
    
    # Photo info
    photo_url = db.Column(db.String(500), nullable=False)
    photo_hash = db.Column(db.String(64))  # For deduplication
    
    # Source info
    source_type = db.Column(db.String(20), default='upload')  # upload, group_photo
    source_recognition_id = db.Column(db.Integer)  # If from group photo
    source_detected_face_id = db.Column(db.Integer)  # If from group photo
    is_self_annotated = db.Column(db.Boolean, default=False)
    
    # Face detection result
    face_detected = db.Column(db.Boolean, default=False)
    face_count = db.Column(db.Integer, default=0)
    face_location = db.Column(db.Text)  # JSON: {top, right, bottom, left}
    
    # Embedding (512-dim, stored as binary for efficiency)
    embedding = db.Column(db.LargeBinary)
    embedding_json = db.Column(db.Text)  # Alternative JSON storage
    
    # Quality metrics
    quality_score = db.Column(db.Float)
    blur_score = db.Column(db.Float)
    brightness_score = db.Column(db.Float)
    
    # Status
    is_primary = db.Column(db.Boolean, default=False)
    is_valid = db.Column(db.Boolean, default=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    member = db.relationship('Member', backref='photos')
    member_face = db.relationship('MemberFace', back_populates='photos')

    SOURCE_UPLOAD = 'upload'
    SOURCE_GROUP_PHOTO = 'group_photo'

    def get_embedding(self):
        """Get embedding as list."""
        if self.embedding_json:
            return json.loads(self.embedding_json)
        return None

    def set_embedding(self, embedding_list):
        """Set embedding from list."""
        self.embedding_json = json.dumps(embedding_list)

    def to_dict(self):
        return {
            'id': self.id,
            'member_id': self.member_id,
            'photo_url': self.photo_url,
            'source_type': self.source_type,
            'is_self_annotated': self.is_self_annotated,
            'face_detected': self.face_detected,
            'quality_score': self.quality_score,
            'is_primary': self.is_primary,
            'is_valid': self.is_valid,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class PhotoRecognition(db.Model):
    """Group photo recognition task."""
    __tablename__ = 'photo_recognitions'

    id = db.Column(db.Integer, primary_key=True)
    rehearsal_id = db.Column(db.Integer, db.ForeignKey('rehearsals.id'), nullable=False)
    photo_type = db.Column(db.String(20), nullable=False)  # check_in, check_out
    photo_url = db.Column(db.String(500), nullable=False)
    
    # Program scope for matching
    program_id = db.Column(db.Integer, db.ForeignKey('programs.id'), nullable=False)
    
    # Detection stats
    total_faces = db.Column(db.Integer, default=0)
    matched_faces = db.Column(db.Integer, default=0)
    uncertain_faces = db.Column(db.Integer, default=0)
    unmatched_faces = db.Column(db.Integer, default=0)
    
    # Processing status
    status = db.Column(db.String(20), default='pending')  # pending, processing, completed, failed
    error_message = db.Column(db.Text)
    
    # Timing
    detection_time_ms = db.Column(db.Integer)
    matching_time_ms = db.Column(db.Integer)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)

    # Relationships
    rehearsal = db.relationship('Rehearsal', back_populates='photo_recognitions')
    program = db.relationship('Program', backref='photo_recognitions')
    detected_faces = db.relationship('DetectedFace', back_populates='recognition', lazy='dynamic',
                                     cascade='all, delete-orphan')

    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'

    PHOTO_TYPE_CHECK_IN = 'check_in'
    PHOTO_TYPE_CHECK_OUT = 'check_out'

    def to_dict(self, include_faces=False):
        data = {
            'id': self.id,
            'rehearsal_id': self.rehearsal_id,
            'photo_type': self.photo_type,
            'photo_url': self.photo_url,
            'program_id': self.program_id,
            'total_faces': self.total_faces,
            'matched_faces': self.matched_faces,
            'uncertain_faces': self.uncertain_faces,
            'unmatched_faces': self.unmatched_faces,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }
        if include_faces:
            data['faces'] = [f.to_dict() for f in self.detected_faces]
        return data


class DetectedFace(db.Model):
    """Individual face detected in a group photo."""
    __tablename__ = 'detected_faces'

    id = db.Column(db.Integer, primary_key=True)
    recognition_id = db.Column(db.Integer, db.ForeignKey('photo_recognitions.id'), nullable=False)
    
    # Face image
    face_crop_url = db.Column(db.String(500), nullable=False)
    
    # Embedding
    embedding = db.Column(db.LargeBinary)
    embedding_json = db.Column(db.Text)
    
    # Match result
    matched_member_id = db.Column(db.Integer, db.ForeignKey('members.id'))
    match_confidence = db.Column(db.Float)
    match_status = db.Column(db.String(20), default='unmatched')
    # confirmed, uncertain, unmatched, manual, self_annotated
    
    # Top candidates
    top_candidates = db.Column(db.Text)  # JSON: [{member_id, name, similarity}, ...]
    
    # Annotation info
    annotated_member_id = db.Column(db.Integer, db.ForeignKey('members.id'))
    annotated_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    annotated_at = db.Column(db.DateTime)
    annotation_type = db.Column(db.String(20))  # system, admin, self
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    recognition = db.relationship('PhotoRecognition', back_populates='detected_faces')
    matched_member = db.relationship('Member', foreign_keys=[matched_member_id], backref='matched_faces')
    annotated_member = db.relationship('Member', foreign_keys=[annotated_member_id], backref='annotated_faces')

    MATCH_STATUS_CONFIRMED = 'confirmed'
    MATCH_STATUS_UNCERTAIN = 'uncertain'
    MATCH_STATUS_UNMATCHED = 'unmatched'
    MATCH_STATUS_MANUAL = 'manual'
    MATCH_STATUS_SELF_ANNOTATED = 'self_annotated'

    def get_top_candidates(self):
        if self.top_candidates:
            return json.loads(self.top_candidates)
        return []

    def set_top_candidates(self, candidates):
        self.top_candidates = json.dumps(candidates)

    def to_dict(self):
        return {
            'id': self.id,
            'recognition_id': self.recognition_id,
            'face_crop_url': self.face_crop_url,
            'matched_member_id': self.matched_member_id,
            'matched_member_name': self.matched_member.name if self.matched_member else None,
            'match_confidence': self.match_confidence,
            'match_status': self.match_status,
            'top_candidates': self.get_top_candidates(),
            'annotated_member_id': self.annotated_member_id,
            'annotated_member_name': self.annotated_member.name if self.annotated_member else None,
            'annotation_type': self.annotation_type,
            'annotated_at': self.annotated_at.isoformat() if self.annotated_at else None,
        }


class RecognitionError(db.Model):
    """Record of recognition errors for analysis."""
    __tablename__ = 'recognition_errors'

    id = db.Column(db.Integer, primary_key=True)
    rehearsal_id = db.Column(db.Integer, db.ForeignKey('rehearsals.id'), nullable=False)
    photo_type = db.Column(db.String(20), nullable=False)
    detected_face_id = db.Column(db.Integer, db.ForeignKey('detected_faces.id'), nullable=False)
    
    # Error type
    error_type = db.Column(db.String(30), nullable=False)
    # false_positive, false_negative, misidentification
    
    # Error details
    predicted_member_id = db.Column(db.Integer, db.ForeignKey('members.id'))
    predicted_confidence = db.Column(db.Float)
    actual_member_id = db.Column(db.Integer, db.ForeignKey('members.id'))
    
    # Correction info
    corrected_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    corrected_at = db.Column(db.DateTime, nullable=False)
    
    # Analysis flag
    is_analyzed = db.Column(db.Boolean, default=False)
    analyzed_at = db.Column(db.DateTime)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    rehearsal = db.relationship('Rehearsal', back_populates='recognition_errors')

    # Error type constants
    ERROR_FALSE_POSITIVE = 'false_positive'
    ERROR_FALSE_NEGATIVE = 'false_negative'
    ERROR_MISIDENTIFICATION = 'misidentification'


class ConfusionPair(db.Model):
    """Record of frequently confused member pairs."""
    __tablename__ = 'confusion_pairs'

    id = db.Column(db.Integer, primary_key=True)
    member_a_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    member_b_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    
    # Statistics
    confusion_count = db.Column(db.Integer, default=1)
    embedding_similarity = db.Column(db.Float)
    last_confusion_at = db.Column(db.DateTime)
    
    # Calibration status
    calibration_status = db.Column(db.String(20), default='pending')
    # pending, in_progress, resolved, unresolvable
    calibration_attempts = db.Column(db.Integer, default=0)
    last_calibration_at = db.Column(db.DateTime)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    member_a = db.relationship('Member', foreign_keys=[member_a_id], backref='confusion_pairs_a')
    member_b = db.relationship('Member', foreign_keys=[member_b_id], backref='confusion_pairs_b')

    __table_args__ = (
        db.UniqueConstraint('member_a_id', 'member_b_id', name='unique_confusion_pair'),
    )


class CalibrationTask(db.Model):
    """Calibration task pushed to members."""
    __tablename__ = 'calibration_tasks'

    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    
    # Task type
    task_type = db.Column(db.String(30), nullable=False)
    # upload_photo, nine_grid_challenge, confirm_in_photo, resolve_confusion
    
    # Task details
    reason = db.Column(db.Text)
    confusion_pair_id = db.Column(db.Integer, db.ForeignKey('confusion_pairs.id'))
    target_rehearsal_id = db.Column(db.Integer, db.ForeignKey('rehearsals.id'))
    target_recognition_id = db.Column(db.Integer, db.ForeignKey('photo_recognitions.id'))
    
    # Status
    status = db.Column(db.String(20), default='pending')
    # pending, notified, in_progress, completed, expired, skipped
    priority = db.Column(db.Integer, default=5)  # 1-10, 10 highest
    
    # Result
    result = db.Column(db.Text)  # JSON
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    notified_at = db.Column(db.DateTime)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    expires_at = db.Column(db.DateTime)

    # Relationships
    member = db.relationship('Member', backref='calibration_tasks')

    TASK_UPLOAD_PHOTO = 'upload_photo'
    TASK_NINE_GRID = 'nine_grid_challenge'
    TASK_CONFIRM_IN_PHOTO = 'confirm_in_photo'
    TASK_RESOLVE_CONFUSION = 'resolve_confusion'

    STATUS_PENDING = 'pending'
    STATUS_NOTIFIED = 'notified'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_COMPLETED = 'completed'
    STATUS_EXPIRED = 'expired'
    STATUS_SKIPPED = 'skipped'

    @classmethod
    def create_task(cls, member_id, task_type, reason, priority=5, expires_days=7, **kwargs):
        """Factory method to create a calibration task."""
        task = cls(
            member_id=member_id,
            task_type=task_type,
            reason=reason,
            priority=priority,
            expires_at=datetime.utcnow() + timedelta(days=expires_days),
            **kwargs
        )
        return task

    def to_dict(self):
        return {
            'id': self.id,
            'member_id': self.member_id,
            'task_type': self.task_type,
            'reason': self.reason,
            'status': self.status,
            'priority': self.priority,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
        }


class CalibrationChallenge(db.Model):
    """Nine-grid calibration challenge record."""
    __tablename__ = 'calibration_challenges'

    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    task_id = db.Column(db.Integer, db.ForeignKey('calibration_tasks.id'))
    
    # Challenge content
    challenge_token = db.Column(db.String(64), unique=True, nullable=False)
    target_photo_id = db.Column(db.Integer, db.ForeignKey('member_photos.id'), nullable=False)
    target_position = db.Column(db.Integer, nullable=False)  # 1-9
    
    # Confusing samples
    confusing_data = db.Column(db.Text)  # JSON: [{member_id, photo_id, similarity, position}, ...]
    
    # Difficulty
    difficulty = db.Column(db.String(20), default='medium')  # easy, medium, hard, focused
    avg_similarity = db.Column(db.Float)
    focused_member_id = db.Column(db.Integer, db.ForeignKey('members.id'))  # For confusion-focused challenges
    
    # Result
    status = db.Column(db.String(20), default='pending')  # pending, answered, expired
    selected_position = db.Column(db.Integer)
    is_correct = db.Column(db.Boolean)
    response_time_ms = db.Column(db.Integer)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    answered_at = db.Column(db.DateTime)
    expires_at = db.Column(db.DateTime)

    # Relationships
    member = db.relationship('Member', foreign_keys=[member_id], backref='calibration_challenges')

    def get_confusing_data(self):
        if self.confusing_data:
            return json.loads(self.confusing_data)
        return []

    def set_confusing_data(self, data):
        self.confusing_data = json.dumps(data)

    def to_dict(self):
        return {
            'challenge_token': self.challenge_token,
            'difficulty': self.difficulty,
            'status': self.status,
            'is_correct': self.is_correct,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
        }
