"""Shared attendance calculation helpers."""
from datetime import datetime, time as _time


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

# Statuses where the member was physically present (in part or in full).
# This is what we count for the timeline-view "出席 X / M" summary —
# leave does NOT count here, since "请假" means the member was not there.
PHYSICALLY_ATTENDED_STATUSES = ('normal', 'late', 'early_leave')

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


def build_rehearsal_slot(rehearsal):
    """Compact dict for one rehearsal in a timeline payload."""
    counts = (
        bool(rehearsal.counts_towards_attendance)
        if rehearsal.counts_towards_attendance is not None else True
    )
    return {
        'id': rehearsal.id,
        'date': rehearsal.scheduled_date.isoformat(),
        'start_time': rehearsal.scheduled_start_time.strftime('%H:%M')
            if rehearsal.scheduled_start_time else None,
        'is_completed': is_rehearsal_completed(rehearsal),
        'counts_for_attendance': counts,
    }


def sorted_program_rehearsals(program):
    """All non-cancelled rehearsals of a program, ordered by date+time.

    Untimed rehearsals sort before timed ones on the same day; this is
    arbitrary but stable.
    """
    return sorted(
        [r for r in program.rehearsals.all() if r.status != 'cancelled'],
        key=lambda r: (r.scheduled_date, r.scheduled_start_time or _time(0, 0)),
    )
