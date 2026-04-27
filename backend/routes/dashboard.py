"""Dashboard statistics routes."""
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, g, request

from database import db
from models import Member, Teacher, Program, Rehearsal, Attendance, ProgramMember, Semester
from auth.decorators import login_required
from utils.attendance import counts_for_attendance, attendance_mode_for

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/stats', methods=['GET'])
@login_required
def get_stats():
    """Get dashboard statistics."""
    # Count active members
    member_count = Member.query.filter_by(status='active').count()

    # Count active teachers
    teacher_count = Teacher.query.filter_by(status='active').count()

    # Count active programs
    program_count = Program.query.filter_by(status='active').count()

    # Count rehearsals this week (exclude cancelled)
    today = datetime.now().date()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    week_rehearsal_count = Rehearsal.query.filter(
        Rehearsal.scheduled_date >= week_start,
        Rehearsal.scheduled_date <= week_end,
        db.or_(Rehearsal.status != 'cancelled', Rehearsal.status.is_(None))
    ).count()

    # Get upcoming rehearsals (next 7 days, exclude cancelled)
    upcoming_rehearsals = Rehearsal.query.filter(
        Rehearsal.scheduled_date >= today,
        Rehearsal.scheduled_date <= today + timedelta(days=7),
        db.or_(Rehearsal.status != 'cancelled', Rehearsal.status.is_(None))
    ).order_by(Rehearsal.scheduled_date, Rehearsal.scheduled_start_time).limit(5).all()

    upcoming_list = []
    for r in upcoming_rehearsals:
        upcoming_list.append({
            'id': r.id,
            'program_name': r.program.name if r.program else 'Unknown',
            'date': r.scheduled_date.isoformat(),
            'start_time': r.scheduled_start_time.isoformat() if r.scheduled_start_time else None,
            'location': r.location
        })

    # Get recent programs
    recent_programs = Program.query.filter_by(status='active').order_by(
        Program.created_at.desc()
    ).limit(5).all()

    recent_program_list = []
    for p in recent_programs:
        # Get non-cancelled rehearsals count
        total_rehearsals = p.rehearsals.filter(
            db.or_(Rehearsal.status != 'cancelled', Rehearsal.status.is_(None))
        ).count()

        # Get completed rehearsals count
        now = datetime.now()
        completed_rehearsals = 0
        for r in p.rehearsals.filter(
            db.or_(Rehearsal.status != 'cancelled', Rehearsal.status.is_(None))
        ):
            if r.scheduled_date < now.date():
                completed_rehearsals += 1
            elif r.scheduled_date == now.date() and r.scheduled_end_time:
                if r.scheduled_end_time <= now.time():
                    completed_rehearsals += 1

        recent_program_list.append({
            'id': p.id,
            'name': p.name,
            'category': p.category,
            'member_count': p.members.filter_by(status='active').count(),
            'rehearsal_count': total_rehearsals,
            'completed_rehearsal_count': completed_rehearsals
        })

    return jsonify({
        'stats': {
            'member_count': member_count,
            'teacher_count': teacher_count,
            'program_count': program_count,
            'week_rehearsal_count': week_rehearsal_count
        },
        'upcoming_rehearsals': upcoming_list,
        'recent_programs': recent_program_list
    })


def _sort_pms_by_pinyin(pms):
    """Sort program members: leaders first, then by pinyin name."""
    try:
        from pypinyin import lazy_pinyin
        def key(pm):
            name = pm.member.name if pm.member else ''
            return (0 if pm.is_leader else 1, ''.join(lazy_pinyin(name)))
    except ImportError:
        def key(pm):
            name = pm.member.name if pm.member else ''
            return (0 if pm.is_leader else 1, name)
    return sorted(pms, key=key)


@dashboard_bp.route('/managed-programs-attendance', methods=['GET'])
@login_required
def get_managed_programs_attendance():
    """Per-member attendance breakdown for programs the user can manage.

    For program_manager users this is the dashboard's primary view: every
    program they lead, with a row per member showing their attendance for
    the semester. Admin and committee see all active programs in the semester.

    Cumulative-mode programs (e.g. 芭蕾基训) report attended_count instead of a
    rate — same convention as the member-side /api/member/my-attendance.
    """
    user = g.current_user
    semester_id = request.args.get('semester_id', type=int)
    if not semester_id:
        current = Semester.get_current()
        semester_id = current.id if current else None

    if not semester_id:
        return jsonify({'programs': [], 'semester_id': None})

    if user.is_admin() or user.is_committee():
        programs = Program.query.filter_by(
            semester_id=semester_id, status='active'
        ).order_by(Program.id).all()
    elif user.is_program_manager():
        managed_ids = [up.program_id for up in user.managed_programs.all()]
        if not managed_ids:
            return jsonify({'programs': [], 'semester_id': semester_id})
        programs = Program.query.filter(
            Program.id.in_(managed_ids),
            Program.semester_id == semester_id,
            Program.status == 'active',
        ).order_by(Program.id).all()
    else:
        return jsonify({'programs': [], 'semester_id': semester_id})

    programs_data = []
    for program in programs:
        mode = attendance_mode_for(program.name)

        # Count rehearsals that count for attendance in this program (semester
        # rehearsals only — Program.rehearsals is already scoped by program_id).
        program_rehearsals = program.rehearsals.filter(
            Rehearsal.status != 'cancelled'
        ).all()
        counted_rehearsals = [r for r in program_rehearsals if counts_for_attendance(r)]
        program_total = len(counted_rehearsals)

        active_pms = [pm for pm in program.members.all() if pm.status == 'active']
        sorted_pms = _sort_pms_by_pinyin(active_pms)

        # Bulk-load attendance records for this program's counted rehearsals
        # to avoid N×M queries.
        rehearsal_ids = [r.id for r in counted_rehearsals]
        records_by_member = {pm.member_id: [] for pm in sorted_pms}
        if rehearsal_ids:
            all_records = Attendance.query.filter(
                Attendance.rehearsal_id.in_(rehearsal_ids),
                Attendance.member_id.in_(records_by_member.keys())
            ).all()
            for rec in all_records:
                if rec.member_id in records_by_member:
                    records_by_member[rec.member_id].append(rec)

        members_data = []
        for pm in sorted_pms:
            if not pm.member:
                continue
            recs = records_by_member.get(pm.member_id, [])
            # Per-member total may differ from program_total only if the
            # member joined/left mid-semester (joined_at / left_at). We keep
            # this simple: total = number of records for this member in the
            # counted set.
            total = len(recs)
            normal = sum(1 for r in recs if r.status == Attendance.STATUS_NORMAL)
            late = sum(1 for r in recs if r.status == Attendance.STATUS_LATE)
            early_leave = sum(1 for r in recs if r.status == Attendance.STATUS_EARLY_LEAVE)
            absent = sum(1 for r in recs if r.status == Attendance.STATUS_ABSENT)
            leave = sum(1 for r in recs if r.status in [
                Attendance.STATUS_LEAVE_ABSENT,
                Attendance.STATUS_LEAVE_LATE,
                Attendance.STATUS_LEAVE_EARLY,
            ])
            attended = normal + late + early_leave
            effective = attended + leave

            members_data.append({
                'member_id': pm.member_id,
                'member_name': pm.member.name,
                'is_leader': bool(pm.is_leader),
                'total_rehearsals': total,
                'attended_count': attended,
                'normal_count': normal,
                'late_count': late,
                'early_leave_count': early_leave,
                'absent_count': absent,
                'leave_count': leave,
                'attendance_rate': round(effective / total * 100, 1) if total > 0 else 100.0,
            })

        programs_data.append({
            'program_id': program.id,
            'program_name': program.name,
            'attendance_mode': mode,
            'total_rehearsals': program_total,
            'member_count': len(members_data),
            'members': members_data,
        })

    return jsonify({
        'programs': programs_data,
        'semester_id': semester_id,
    })
