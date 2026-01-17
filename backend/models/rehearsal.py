"""Rehearsal model."""
from datetime import datetime
from database import db
import json


class Rehearsal(db.Model):
    """Rehearsal session model."""
    __tablename__ = 'rehearsals'

    id = db.Column(db.Integer, primary_key=True)
    program_id = db.Column(db.Integer, db.ForeignKey('programs.id'), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('teachers.id'))
    scheduled_date = db.Column(db.Date, nullable=False)
    scheduled_start_time = db.Column(db.Time)
    scheduled_end_time = db.Column(db.Time)
    location = db.Column(db.String(100))

    # Status: scheduled/completed/cancelled
    status = db.Column(db.String(20), default='scheduled')

    # Photos
    before_photo_path = db.Column(db.String(255))
    after_photo_path = db.Column(db.String(255))
    before_photo_status = db.Column(db.String(20), default='pending')  # pending/uploaded/processed
    after_photo_status = db.Column(db.String(20), default='pending')

    # Videos (JSON array of video links/paths)
    videos = db.Column(db.Text)

    # Attendance calculation settings
    counts_towards_attendance = db.Column(db.Boolean, default=True)  # Whether this rehearsal counts towards attendance rate
    exclusion_reason = db.Column(db.Text)  # Reason for excluding from attendance calculation

    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    program = db.relationship('Program', back_populates='rehearsals')
    teacher = db.relationship('Teacher', back_populates='rehearsals')
    attendance_records = db.relationship('Attendance', back_populates='rehearsal', lazy='dynamic',
                                         cascade='all, delete-orphan')
    face_annotations = db.relationship('FaceAnnotation', back_populates='rehearsal', lazy='dynamic',
                                       cascade='all, delete-orphan')
    # Face recognition related - cascade delete when rehearsal is deleted
    photo_recognitions = db.relationship('PhotoRecognition', back_populates='rehearsal', lazy='dynamic',
                                         cascade='all, delete-orphan')
    recognition_errors = db.relationship('RecognitionError', back_populates='rehearsal', lazy='dynamic',
                                         cascade='all, delete-orphan')

    # Rehearsal status constants
    STATUS_SCHEDULED = 'scheduled'
    STATUS_COMPLETED = 'completed'
    STATUS_CANCELLED = 'cancelled'

    # Rehearsal status constants
    STATUS_SCHEDULED = 'scheduled'
    STATUS_COMPLETED = 'completed'
    STATUS_CANCELLED = 'cancelled'

    PHOTO_STATUS_PENDING = 'pending'
    PHOTO_STATUS_UPLOADED = 'uploaded'
    PHOTO_STATUS_PROCESSED = 'processed'

    def get_videos(self) -> list:
        """Parse videos JSON array."""
        if self.videos:
            return json.loads(self.videos)
        return []

    def set_videos(self, video_list: list):
        """Set videos as JSON array."""
        self.videos = json.dumps(video_list, ensure_ascii=False)

    def to_dict(self, include_attendance=False):
        """Convert to dictionary."""
        data = {
            'id': self.id,
            'program_id': self.program_id,
            'program_name': self.program.name if self.program else None,
            'teacher_id': self.teacher_id,
            'teacher_name': self.teacher.name if self.teacher else None,
            'scheduled_date': self.scheduled_date.isoformat() if self.scheduled_date else None,
            'scheduled_start_time': self.scheduled_start_time.isoformat() if self.scheduled_start_time else None,
            'scheduled_end_time': self.scheduled_end_time.isoformat() if self.scheduled_end_time else None,
            'location': self.location,
            'status': self.status or 'scheduled',
            'before_photo_path': self.before_photo_path,
            'after_photo_path': self.after_photo_path,
            'before_photo_status': self.before_photo_status,
            'after_photo_status': self.after_photo_status,
            'videos': self.get_videos(),
            'counts_towards_attendance': self.counts_towards_attendance if self.counts_towards_attendance is not None else True,
            'exclusion_reason': self.exclusion_reason,
            'notes': self.notes,
            'attendance_count': self.attendance_records.count(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_attendance:
            data['attendance'] = [a.to_dict() for a in self.attendance_records]
        return data
