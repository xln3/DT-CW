"""Attendance model."""
from datetime import datetime
from database import db


class Attendance(db.Model):
    """Attendance record model."""
    __tablename__ = 'attendance'

    id = db.Column(db.Integer, primary_key=True)
    rehearsal_id = db.Column(db.Integer, db.ForeignKey('rehearsals.id'), nullable=False)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)

    # Detection results
    detected_before = db.Column(db.Boolean, default=False)
    detected_after = db.Column(db.Boolean, default=False)
    before_annotation_id = db.Column(db.Integer, db.ForeignKey('face_annotations.id'))
    after_annotation_id = db.Column(db.Integer, db.ForeignKey('face_annotations.id'))

    # Leave information
    has_leave = db.Column(db.Boolean, default=False)
    leave_type = db.Column(db.String(20))  # full/late/early
    leave_reason = db.Column(db.Text)

    # Calculated status
    status = db.Column(db.String(20))  # normal/late/early_leave/absent/leave_absent/leave_late/leave_early

    # Manual override
    manual_override = db.Column(db.Boolean, default=False)
    override_reason = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    rehearsal = db.relationship('Rehearsal', back_populates='attendance_records')
    member = db.relationship('Member', back_populates='attendance_records')

    __table_args__ = (
        db.UniqueConstraint('rehearsal_id', 'member_id', name='unique_rehearsal_member'),
    )

    # Status constants
    STATUS_NORMAL = 'normal'           # Present both before and after
    STATUS_LATE = 'late'               # Only detected after
    STATUS_EARLY_LEAVE = 'early_leave' # Only detected before
    STATUS_ABSENT = 'absent'           # Not detected at all
    STATUS_LEAVE_ABSENT = 'leave_absent'   # Has leave, fully excused
    STATUS_LEAVE_LATE = 'leave_late'       # Has late leave
    STATUS_LEAVE_EARLY = 'leave_early'     # Has early leave

    # Leave type constants
    LEAVE_FULL = 'full'    # Full day leave
    LEAVE_LATE = 'late'    # Late arrival (excused)
    LEAVE_EARLY = 'early'  # Early departure (excused)

    def calculate_status(self):
        """Calculate attendance status based on detection and leave."""
        if self.has_leave:
            if self.leave_type == self.LEAVE_FULL:
                self.status = self.STATUS_LEAVE_ABSENT
            elif self.leave_type == self.LEAVE_LATE:
                self.status = self.STATUS_LEAVE_LATE
            elif self.leave_type == self.LEAVE_EARLY:
                self.status = self.STATUS_LEAVE_EARLY
        else:
            if self.detected_before and self.detected_after:
                self.status = self.STATUS_NORMAL
            elif not self.detected_before and self.detected_after:
                self.status = self.STATUS_LATE
            elif self.detected_before and not self.detected_after:
                self.status = self.STATUS_EARLY_LEAVE
            else:
                self.status = self.STATUS_ABSENT

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'rehearsal_id': self.rehearsal_id,
            'member_id': self.member_id,
            'member_name': self.member.name if self.member else None,
            'detected_before': self.detected_before,
            'detected_after': self.detected_after,
            'has_leave': self.has_leave,
            'leave_type': self.leave_type,
            'leave_reason': self.leave_reason,
            'status': self.status,
            'manual_override': self.manual_override,
            'override_reason': self.override_reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def get_status_display(cls, status: str) -> str:
        """Get display name for status."""
        status_map = {
            cls.STATUS_NORMAL: '正常',
            cls.STATUS_LATE: '迟到',
            cls.STATUS_EARLY_LEAVE: '早退',
            cls.STATUS_ABSENT: '缺勤',
            cls.STATUS_LEAVE_ABSENT: '请假',
            cls.STATUS_LEAVE_LATE: '迟到(已请假)',
            cls.STATUS_LEAVE_EARLY: '早退(已请假)',
        }
        return status_map.get(status, status)
