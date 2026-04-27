"""Shared attendance calculation helpers."""
from datetime import datetime


def is_rehearsal_completed(rehearsal):
    """Check if a rehearsal is completed (not cancelled and time has passed)."""
    if rehearsal.status == 'cancelled':
        return False
    now = datetime.now()
    today = now.date()
    current_time = now.time()

    if rehearsal.scheduled_date < today:
        return True
    elif rehearsal.scheduled_date == today and rehearsal.scheduled_end_time:
        return rehearsal.scheduled_end_time <= current_time
    return False


def counts_for_attendance(rehearsal):
    """Check if a rehearsal should be counted for attendance rate calculation."""
    if not is_rehearsal_completed(rehearsal):
        return False
    counts = rehearsal.counts_towards_attendance
    return counts if counts is not None else True


# Statuses that count as "attended" for attendance rate calculation.
# late and early_leave count because the member did show up.
# leave_* statuses count because the absence is excused.
ATTENDED_STATUSES = [
    'normal',
    'late',
    'early_leave',
    'leave_absent',
    'leave_late',
    'leave_early',
]

# Valid leave_type values when has_leave is True
VALID_LEAVE_TYPES = ['full', 'late', 'early']

# All valid attendance status values
VALID_STATUSES = [
    'normal',
    'late',
    'early_leave',
    'absent',
    'leave_absent',
    'leave_late',
    'leave_early',
]


# Programs whose attendance is reported as a cumulative count of attended
# sessions instead of a percentage. These are open-training-style programs
# where the goal is encouragement to come, not perfect attendance.
CUMULATIVE_PROGRAMS = {'芭蕾基训'}


def attendance_mode_for(program_name: str) -> str:
    """Return 'cumulative' or 'rate' depending on the program."""
    return 'cumulative' if program_name in CUMULATIVE_PROGRAMS else 'rate'
