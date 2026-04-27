"""Venue and booking models."""
from datetime import datetime
from database import db


class Venue(db.Model):
    """Venue/rehearsal room model."""
    __tablename__ = 'venues'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200))
    capacity = db.Column(db.Integer)
    equipment = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    time_slots = db.relationship('VenueTimeSlot', back_populates='venue', lazy='dynamic',
                                 cascade='all, delete-orphan')
    bookings = db.relationship('VenueBooking', back_populates='venue', lazy='dynamic',
                               cascade='all, delete-orphan')

    def to_dict(self, include_time_slots=False):
        """Convert to dictionary."""
        data = {
            'id': self.id,
            'name': self.name,
            'location': self.location,
            'capacity': self.capacity,
            'equipment': self.equipment,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_time_slots:
            data['time_slots'] = [ts.to_dict() for ts in self.time_slots]
        return data


class VenueTimeSlot(db.Model):
    """Venue availability time slots (semester level)."""
    __tablename__ = 'venue_time_slots'

    id = db.Column(db.Integer, primary_key=True)
    venue_id = db.Column(db.Integer, db.ForeignKey('venues.id'), nullable=False)
    semester_id = db.Column(db.Integer, db.ForeignKey('semesters.id'), nullable=False)
    day_of_week = db.Column(db.Integer, nullable=False)  # 0-6: Monday to Sunday
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    is_available = db.Column(db.Boolean, default=True)
    notes = db.Column(db.String(200))

    # Relationships
    venue = db.relationship('Venue', back_populates='time_slots')
    semester = db.relationship('Semester')

    __table_args__ = (
        db.UniqueConstraint('venue_id', 'semester_id', 'day_of_week', 'start_time',
                            name='unique_venue_timeslot'),
    )

    DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'venue_id': self.venue_id,
            'semester_id': self.semester_id,
            'day_of_week': self.day_of_week,
            'day_name': self.DAY_NAMES[self.day_of_week] if 0 <= self.day_of_week <= 6 else None,
            'start_time': self.start_time.strftime('%H:%M') if self.start_time else None,
            'end_time': self.end_time.strftime('%H:%M') if self.end_time else None,
            'is_available': self.is_available,
            'notes': self.notes,
        }


class VenueBooking(db.Model):
    """Venue booking records (direct booking mode)."""
    __tablename__ = 'venue_bookings'

    id = db.Column(db.Integer, primary_key=True)
    venue_id = db.Column(db.Integer, db.ForeignKey('venues.id'), nullable=False)
    program_id = db.Column(db.Integer, db.ForeignKey('programs.id'), nullable=True)
    rehearsal_id = db.Column(db.Integer, db.ForeignKey('rehearsals.id'), nullable=True)
    date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    status = db.Column(db.String(20), default='confirmed')  # confirmed/cancelled
    booked_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    venue = db.relationship('Venue', back_populates='bookings')
    program = db.relationship('Program')
    rehearsal = db.relationship('Rehearsal', back_populates='venue_bookings')
    user = db.relationship('User')

    STATUS_CONFIRMED = 'confirmed'
    STATUS_CANCELLED = 'cancelled'

    def to_dict(self, include_venue=False, include_program=False):
        """Convert to dictionary."""
        data = {
            'id': self.id,
            'venue_id': self.venue_id,
            'program_id': self.program_id,
            'rehearsal_id': self.rehearsal_id,
            'date': self.date.isoformat() if self.date else None,
            'start_time': self.start_time.strftime('%H:%M') if self.start_time else None,
            'end_time': self.end_time.strftime('%H:%M') if self.end_time else None,
            'status': self.status,
            'booked_by': self.booked_by,
            'booked_by_name': self.user.username if self.user else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_venue and self.venue:
            data['venue'] = self.venue.to_dict()
        if include_program and self.program:
            data['program'] = {
                'id': self.program.id,
                'name': self.program.name,
            }
        return data

    @classmethod
    def check_conflict(cls, venue_id, date, start_time, end_time, exclude_id=None):
        """Check if there's a booking conflict."""
        query = cls.query.filter(
            cls.venue_id == venue_id,
            cls.date == date,
            cls.status == cls.STATUS_CONFIRMED,
            # Time overlap check: existing.start < new.end AND existing.end > new.start
            cls.start_time < end_time,
            cls.end_time > start_time
        )
        if exclude_id:
            query = query.filter(cls.id != exclude_id)
        return query.first()
