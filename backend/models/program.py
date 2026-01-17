"""Program and ProgramMember models."""
from datetime import datetime, date, time as time_type
from database import db


class Program(db.Model):
    """Performance program model."""
    __tablename__ = 'programs'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50))  # dance/choir/drama/orchestra/etc.
    description = db.Column(db.Text)
    display_color = db.Column(db.String(20), default='#3498DB')  # Color for schedule display
    semester_id = db.Column(db.Integer, db.ForeignKey('semesters.id'))
    status = db.Column(db.String(20), default='active')  # active/completed/cancelled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    semester = db.relationship('Semester', back_populates='programs')
    members = db.relationship('ProgramMember', back_populates='program', lazy='dynamic',
                              cascade='all, delete-orphan')
    rehearsals = db.relationship('Rehearsal', back_populates='program', lazy='dynamic',
                                 cascade='all, delete-orphan')
    managers = db.relationship('UserProgram', backref='program', lazy='dynamic',
                               cascade='all, delete-orphan')

    # Category constants
    CATEGORY_DANCE = 'dance'
    CATEGORY_CHOIR = 'choir'
    CATEGORY_DRAMA = 'drama'
    CATEGORY_ORCHESTRA = 'orchestra'
    CATEGORY_OTHER = 'other'

    CATEGORIES = [
        ('dance', '舞蹈'),
        ('choir', '合唱'),
        ('drama', '话剧'),
        ('orchestra', '器乐'),
        ('other', '其他'),
    ]

    STATUS_ACTIVE = 'active'
    STATUS_COMPLETED = 'completed'
    STATUS_CANCELLED = 'cancelled'

    def to_dict(self, include_members=False, include_rehearsals=False):
        """Convert to dictionary."""
        # Import here to avoid circular imports
        from models.rehearsal import Rehearsal

        # Count total rehearsals (excluding cancelled)
        total_rehearsals = self.rehearsals.filter(
            Rehearsal.status != 'cancelled'
        ).count()

        # Count completed rehearsals (time has passed)
        now = datetime.now()
        today = now.date()
        current_time = now.time()

        completed_count = 0
        for rehearsal in self.rehearsals.filter(Rehearsal.status != 'cancelled'):
            if rehearsal.scheduled_date < today:
                # Past date - completed
                completed_count += 1
            elif rehearsal.scheduled_date == today and rehearsal.scheduled_end_time:
                # Today - check if end time has passed
                if rehearsal.scheduled_end_time <= current_time:
                    completed_count += 1

        data = {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'description': self.description,
            'display_color': self.display_color,
            'semester_id': self.semester_id,
            'status': self.status,
            'member_count': self.members.filter_by(status='active').count(),
            'rehearsal_count': total_rehearsals,
            'completed_rehearsal_count': completed_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_members:
            data['members'] = [
                pm.to_dict() for pm in self.members.filter_by(status='active')
            ]
        if include_rehearsals:
            data['rehearsals'] = [r.to_dict() for r in self.rehearsals.order_by(db.desc('scheduled_date'))]
        return data

    def get_active_members(self):
        """Get all active members of this program."""
        return [pm.member for pm in self.members.filter_by(status='active')]


class ProgramMember(db.Model):
    """Association between programs and members."""
    __tablename__ = 'program_members'

    id = db.Column(db.Integer, primary_key=True)
    program_id = db.Column(db.Integer, db.ForeignKey('programs.id'), nullable=False)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    role = db.Column(db.String(50))  # lead/ensemble/substitute (deprecated, kept for compatibility)
    is_leader = db.Column(db.Boolean, default=False)  # Program leader flag
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    left_at = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='active')  # active/left

    # Relationships
    program = db.relationship('Program', back_populates='members')
    member = db.relationship('Member', back_populates='program_memberships')

    __table_args__ = (
        db.UniqueConstraint('program_id', 'member_id', name='unique_program_member'),
    )

    ROLE_LEAD = 'lead'
    ROLE_ENSEMBLE = 'ensemble'
    ROLE_SUBSTITUTE = 'substitute'

    ROLES = [
        ('lead', '主演'),
        ('ensemble', '群演'),
        ('substitute', '替补'),
    ]

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'program_id': self.program_id,
            'member_id': self.member_id,
            'member': self.member.to_dict() if self.member else None,
            'role': self.role,
            'is_leader': self.is_leader or False,
            'joined_at': self.joined_at.isoformat() if self.joined_at else None,
            'left_at': self.left_at.isoformat() if self.left_at else None,
            'status': self.status,
        }
