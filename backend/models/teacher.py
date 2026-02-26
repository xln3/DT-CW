"""Teacher model."""
from datetime import datetime
from database import db


class Teacher(db.Model):
    """Teacher/instructor model."""
    __tablename__ = 'teachers'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    phone = db.Column(db.String(20))
    id_card_last4 = db.Column(db.String(4))  # Last 4 digits of ID card (for payroll)
    bank_account = db.Column(db.String(50))  # Bank account (stored encrypted)
    specialty = db.Column(db.String(100))  # Specialty/expertise
    status = db.Column(db.String(20), default='active')  # active/inactive
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    rehearsals = db.relationship('Rehearsal', back_populates='teacher', lazy='dynamic')
    program_associations = db.relationship('ProgramTeacher', back_populates='teacher', lazy='select')

    STATUS_ACTIVE = 'active'
    STATUS_INACTIVE = 'inactive'

    def to_dict(self, include_sensitive=False):
        """Convert to dictionary."""
        data = {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'specialty': self.specialty,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_sensitive:
            data['id_card_last4'] = self.id_card_last4
            data['bank_account'] = self.bank_account
        return data
