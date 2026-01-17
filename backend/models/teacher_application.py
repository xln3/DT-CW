"""Teacher entry application and payment models."""
from datetime import datetime
from decimal import Decimal
from database import db


class TeacherEntryApplication(db.Model):
    """Teacher entry application (for campus access)."""
    __tablename__ = 'teacher_entry_applications'

    id = db.Column(db.Integer, primary_key=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=False)
    rehearsal_id = db.Column(db.Integer, db.ForeignKey('rehearsals.id'), nullable=True)
    entry_date = db.Column(db.Date, nullable=False)
    entry_time = db.Column(db.Time)
    exit_time = db.Column(db.Time)
    purpose = db.Column(db.String(200))  # class/rehearsal/other
    status = db.Column(db.String(20), default='pending')  # pending/approved/rejected/completed
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text)

    # Relationships
    teacher = db.relationship('Teacher', backref=db.backref('entry_applications', lazy='dynamic'))
    rehearsal = db.relationship('Rehearsal')
    creator = db.relationship('User', foreign_keys=[created_by])
    approver = db.relationship('User', foreign_keys=[approved_by])

    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_COMPLETED = 'completed'

    PURPOSE_CLASS = 'class'
    PURPOSE_REHEARSAL = 'rehearsal'
    PURPOSE_OTHER = 'other'

    PURPOSES = [
        ('class', '上课'),
        ('rehearsal', '排练'),
        ('other', '其他'),
    ]

    def to_dict(self, include_teacher=False, include_rehearsal=False):
        """Convert to dictionary."""
        data = {
            'id': self.id,
            'teacher_id': self.teacher_id,
            'teacher_name': self.teacher.name if self.teacher else None,
            'rehearsal_id': self.rehearsal_id,
            'entry_date': self.entry_date.isoformat() if self.entry_date else None,
            'entry_time': self.entry_time.strftime('%H:%M') if self.entry_time else None,
            'exit_time': self.exit_time.strftime('%H:%M') if self.exit_time else None,
            'purpose': self.purpose,
            'status': self.status,
            'created_by': self.created_by,
            'created_by_name': self.creator.username if self.creator else None,
            'approved_by': self.approved_by,
            'approved_by_name': self.approver.username if self.approver else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'notes': self.notes,
        }
        if include_teacher and self.teacher:
            data['teacher'] = self.teacher.to_dict()
        if include_rehearsal and self.rehearsal:
            data['rehearsal'] = {
                'id': self.rehearsal.id,
                'program_name': self.rehearsal.program.name if self.rehearsal.program else None,
                'scheduled_date': self.rehearsal.scheduled_date.isoformat() if self.rehearsal.scheduled_date else None,
            }
        return data


class PaymentSource(db.Model):
    """Payment source (艺教/队费/其他)."""
    __tablename__ = 'payment_sources'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class TeacherPayment(db.Model):
    """Teacher payment record (manual entry, supports multiple sources)."""
    __tablename__ = 'teacher_payments'

    id = db.Column(db.Integer, primary_key=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=False)
    semester_id = db.Column(db.Integer, db.ForeignKey('semesters.id'), nullable=True)
    description = db.Column(db.String(200), nullable=False)  # e.g., "3月份课时费"
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending/processing/paid
    scheduled_date = db.Column(db.Date)  # planned payment date
    actual_date = db.Column(db.Date)  # actual payment date
    reference_number = db.Column(db.String(100))  # transfer reference
    notes = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    teacher = db.relationship('Teacher', backref=db.backref('payments', lazy='dynamic'))
    semester = db.relationship('Semester')
    creator = db.relationship('User')
    source_details = db.relationship('PaymentSourceDetail', back_populates='payment',
                                     lazy='dynamic', cascade='all, delete-orphan')

    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_PAID = 'paid'

    def to_dict(self, include_sources=True):
        """Convert to dictionary."""
        data = {
            'id': self.id,
            'teacher_id': self.teacher_id,
            'teacher_name': self.teacher.name if self.teacher else None,
            'semester_id': self.semester_id,
            'semester_name': self.semester.name if self.semester else None,
            'description': self.description,
            'total_amount': float(self.total_amount) if self.total_amount else 0,
            'status': self.status,
            'scheduled_date': self.scheduled_date.isoformat() if self.scheduled_date else None,
            'actual_date': self.actual_date.isoformat() if self.actual_date else None,
            'reference_number': self.reference_number,
            'notes': self.notes,
            'created_by': self.created_by,
            'created_by_name': self.creator.username if self.creator else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_sources:
            data['sources'] = [sd.to_dict() for sd in self.source_details]
        return data


class PaymentSourceDetail(db.Model):
    """Payment source detail (supports multiple sources per payment)."""
    __tablename__ = 'payment_source_details'

    id = db.Column(db.Integer, primary_key=True)
    payment_id = db.Column(db.Integer, db.ForeignKey('teacher_payments.id'), nullable=False)
    source_id = db.Column(db.Integer, db.ForeignKey('payment_sources.id'), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    notes = db.Column(db.Text)

    # Relationships
    payment = db.relationship('TeacherPayment', back_populates='source_details')
    source = db.relationship('PaymentSource')

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'payment_id': self.payment_id,
            'source_id': self.source_id,
            'source_name': self.source.name if self.source else None,
            'amount': float(self.amount) if self.amount else 0,
            'notes': self.notes,
        }
