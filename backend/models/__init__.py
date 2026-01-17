"""Database models package."""
from .user import User, UserProgram
from .semester import Semester
from .system_config import SystemConfig
from .audit_log import AuditLog
from .member import Member
from .teacher import Teacher
from .program import Program, ProgramMember
from .rehearsal import Rehearsal
from .attendance import Attendance
from .face_vector import FaceVector
from .face_annotation import FaceAnnotation
from .event_type import EventType
from .calendar_event import CalendarEvent
from .venue import Venue, VenueTimeSlot, VenueBooking
from .teacher_application import (
    TeacherEntryApplication,
    PaymentSource,
    TeacherPayment,
    PaymentSourceDetail,
)
from .budget import BudgetCategory, Budget, Expense

# New face recognition models
from .face_models import (
    MemberFace,
    MemberPhoto,
    PhotoRecognition,
    DetectedFace,
    RecognitionError,
    ConfusionPair,
    CalibrationTask,
    CalibrationChallenge,
)

__all__ = [
    'User', 'UserProgram',
    'Semester',
    'SystemConfig',
    'AuditLog',
    'Member',
    'Teacher',
    'Program', 'ProgramMember',
    'Rehearsal',
    'Attendance',
    'FaceVector',
    'FaceAnnotation',
    'EventType',
    'CalendarEvent',
    'Venue', 'VenueTimeSlot', 'VenueBooking',
    'TeacherEntryApplication', 'PaymentSource', 'TeacherPayment', 'PaymentSourceDetail',
    'BudgetCategory', 'Budget', 'Expense',
    # New face recognition models
    'MemberFace',
    'MemberPhoto',
    'PhotoRecognition',
    'DetectedFace',
    'RecognitionError',
    'ConfusionPair',
    'CalibrationTask',
    'CalibrationChallenge',
]
