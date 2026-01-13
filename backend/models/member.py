"""Member model."""
from datetime import datetime
from database import db


class Member(db.Model):
    """Team member model."""
    __tablename__ = 'members'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    student_id = db.Column(db.String(50))  # Student ID (optional)
    phone = db.Column(db.String(20))
    gender = db.Column(db.String(10))
    department = db.Column(db.String(100))  # Department/Faculty
    grade = db.Column(db.String(20))  # Grade/Year
    status = db.Column(db.String(20), default='active')  # active/inactive
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    program_memberships = db.relationship('ProgramMember', back_populates='member', lazy='dynamic')
    face_vectors = db.relationship('FaceVector', back_populates='member', lazy='dynamic')
    attendance_records = db.relationship('Attendance', back_populates='member', lazy='dynamic')

    STATUS_ACTIVE = 'active'
    STATUS_INACTIVE = 'inactive'

    def to_dict(self, include_programs=False):
        """Convert to dictionary."""
        data = {
            'id': self.id,
            'name': self.name,
            'student_id': self.student_id,
            'phone': self.phone,
            'gender': self.gender,
            'department': self.department,
            'grade': self.grade,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_programs:
            data['programs'] = [
                pm.program.to_dict() for pm in self.program_memberships.filter_by(status='active')
            ]
        return data

    def get_active_programs(self):
        """Get all active programs this member belongs to."""
        return [pm.program for pm in self.program_memberships.filter_by(status='active')]
