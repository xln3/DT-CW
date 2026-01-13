"""Semester model."""
from datetime import datetime
from database import db


class Semester(db.Model):
    """Semester configuration."""
    __tablename__ = 'semesters'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)  # e.g., '2024-2025学年第一学期'
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    is_current = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    programs = db.relationship('Program', back_populates='semester', lazy='dynamic')

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'is_current': self.is_current,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    @classmethod
    def get_current(cls):
        """Get current semester."""
        return cls.query.filter_by(is_current=True).first()

    @classmethod
    def set_current(cls, semester_id: int):
        """Set a semester as current (and unset others)."""
        cls.query.update({'is_current': False})
        semester = cls.query.get(semester_id)
        if semester:
            semester.is_current = True
            db.session.commit()
        return semester
