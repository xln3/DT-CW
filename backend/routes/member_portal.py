"""Member portal routes - API endpoints for member users."""
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, g

from database import db
from models import (
    Program, Member, Rehearsal, Attendance, Semester, ProgramMember
)
from auth import login_required


member_portal_bp = Blueprint('member_portal', __name__)


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


@member_portal_bp.route('/my-programs', methods=['GET'])
@login_required
def get_my_programs():
    """Get programs that the current member participates in."""
    user = g.current_user

    # Must have associated member
    if not user.member_id:
        return jsonify({
            'programs': [],
            'message': '当前用户未关联成员信息'
        })

    # Get active program memberships
    program_memberships = ProgramMember.query.filter_by(
        member_id=user.member_id,
        status='active'
    ).all()

    programs_data = []
    for pm in program_memberships:
        program = pm.program
        if not program or program.status != 'active':
            continue

        # Get rehearsal counts
        all_rehearsals = program.rehearsals.all()
        active_rehearsals = [r for r in all_rehearsals if r.status != 'cancelled']
        completed_rehearsals = [r for r in active_rehearsals if is_rehearsal_completed(r)]

        # Get member count
        member_count = ProgramMember.query.filter_by(
            program_id=program.id,
            status='active'
        ).count()

        programs_data.append({
            'id': program.id,
            'name': program.name,
            'category': program.category or '',
            'display_color': program.display_color,
            'is_leader': pm.is_leader if hasattr(pm, 'is_leader') else False,
            'member_count': member_count,
            'rehearsal_count': len(active_rehearsals),
            'completed_rehearsal_count': len(completed_rehearsals)
        })

    return jsonify({'programs': programs_data})


@member_portal_bp.route('/my-programs/<int:program_id>', methods=['GET'])
@login_required
def get_my_program_detail(program_id):
    """Get detailed information about a program the member participates in."""
    user = g.current_user

    if not user.member_id:
        return jsonify({'error': '当前用户未关联成员信息'}), 403

    # Verify membership
    pm = ProgramMember.query.filter_by(
        member_id=user.member_id,
        program_id=program_id,
        status='active'
    ).first()

    if not pm:
        return jsonify({'error': '无权访问该节目'}), 403

    program = Program.query.get_or_404(program_id)

    # Get all members
    program_members = ProgramMember.query.filter_by(
        program_id=program.id,
        status='active'
    ).all()

    members_data = []
    for member_pm in program_members:
        if member_pm.member:
            members_data.append({
                'id': member_pm.member.id,
                'name': member_pm.member.name,
                'is_leader': member_pm.is_leader if hasattr(member_pm, 'is_leader') else False
            })

    # Get rehearsals
    all_rehearsals = program.rehearsals.order_by(Rehearsal.scheduled_date.desc()).all()
    active_rehearsals = [r for r in all_rehearsals if r.status != 'cancelled']

    rehearsals_data = []
    for r in active_rehearsals[:20]:  # Last 20
        rehearsals_data.append({
            'id': r.id,
            'scheduled_date': r.scheduled_date.isoformat(),
            'scheduled_start_time': r.scheduled_start_time.strftime('%H:%M') if r.scheduled_start_time else None,
            'scheduled_end_time': r.scheduled_end_time.strftime('%H:%M') if r.scheduled_end_time else None,
            'location': r.location,
            'status': r.status or 'scheduled',
            'is_completed': is_rehearsal_completed(r)
        })

    return jsonify({
        'program': {
            'id': program.id,
            'name': program.name,
            'category': program.category or '',
            'display_color': program.display_color,
            'description': program.description
        },
        'is_leader': pm.is_leader if hasattr(pm, 'is_leader') else False,
        'members': members_data,
        'rehearsals': rehearsals_data
    })


@member_portal_bp.route('/my-attendance', methods=['GET'])
@login_required
def get_my_attendance():
    """Get attendance records for the current member."""
    user = g.current_user
    semester_id = request.args.get('semester_id', type=int)

    if not user.member_id:
        return jsonify({
            'member': None,
            'programs': [],
            'overall_stats': {
                'total_rehearsals': 0,
                'normal_count': 0,
                'late_count': 0,
                'absent_count': 0,
                'leave_count': 0,
                'attendance_rate': 100.0
            }
        })

    member = Member.query.get(user.member_id)
    if not member:
        return jsonify({'error': '成员信息不存在'}), 404

    if not semester_id:
        current_semester = Semester.get_current()
        semester_id = current_semester.id if current_semester else None

    # Get all program memberships
    program_memberships = ProgramMember.query.filter_by(
        member_id=member.id,
        status='active'
    ).all()

    programs_data = []
    total_stats = {
        'total_rehearsals': 0,
        'normal_count': 0,
        'late_count': 0,
        'absent_count': 0,
        'leave_count': 0
    }

    for pm in program_memberships:
        program = pm.program
        if not program:
            continue
        if semester_id and program.semester_id != semester_id:
            continue

        # Get attendance records (only from rehearsals that count towards attendance)
        all_records = Attendance.query.join(Rehearsal).filter(
            Attendance.member_id == member.id,
            Rehearsal.program_id == program.id,
            Rehearsal.status != 'cancelled'
        ).all()

        # Filter to only rehearsals that count towards attendance
        records = [r for r in all_records if counts_for_attendance(r.rehearsal)]

        total = len(records)
        normal = sum(1 for r in records if r.status == Attendance.STATUS_NORMAL)
        late = sum(1 for r in records if r.status == Attendance.STATUS_LATE)
        absent = sum(1 for r in records if r.status in [Attendance.STATUS_ABSENT, Attendance.STATUS_EARLY_LEAVE])
        leave = sum(1 for r in records if r.status in [
            Attendance.STATUS_LEAVE_ABSENT,
            Attendance.STATUS_LEAVE_LATE,
            Attendance.STATUS_LEAVE_EARLY
        ])

        # Add to totals
        total_stats['total_rehearsals'] += total
        total_stats['normal_count'] += normal
        total_stats['late_count'] += late
        total_stats['absent_count'] += absent
        total_stats['leave_count'] += leave

        programs_data.append({
            'program_id': program.id,
            'program_name': program.name,
            'total_rehearsals': total,
            'normal_count': normal,
            'late_count': late,
            'absent_count': absent,
            'leave_count': leave,
            'attendance_rate': round((normal + leave) / total * 100, 1) if total > 0 else 100.0
        })

    # Calculate overall rate
    overall_rate = 100.0
    if total_stats['total_rehearsals'] > 0:
        effective = total_stats['normal_count'] + total_stats['leave_count']
        overall_rate = round(effective / total_stats['total_rehearsals'] * 100, 1)

    return jsonify({
        'member': {
            'id': member.id,
            'name': member.name,
            'student_id': member.student_id or '',
            'department': member.department or ''
        },
        'programs': programs_data,
        'overall_stats': {
            'total_rehearsals': total_stats['total_rehearsals'],
            'normal_count': total_stats['normal_count'],
            'late_count': total_stats['late_count'],
            'absent_count': total_stats['absent_count'],
            'leave_count': total_stats['leave_count'],
            'attendance_rate': overall_rate
        }
    })


@member_portal_bp.route('/my-rehearsals', methods=['GET'])
@login_required
def get_my_rehearsals():
    """Get upcoming rehearsals for programs the member participates in."""
    user = g.current_user
    days = request.args.get('days', 14, type=int)  # Default: next 2 weeks
    limit = request.args.get('limit', 10, type=int)

    if not user.member_id:
        return jsonify({'rehearsals': []})

    # Get member's programs
    program_memberships = ProgramMember.query.filter_by(
        member_id=user.member_id,
        status='active'
    ).all()

    program_ids = [pm.program_id for pm in program_memberships]

    if not program_ids:
        return jsonify({'rehearsals': []})

    # Get upcoming rehearsals
    today = datetime.now().date()
    end_date = today + timedelta(days=days)

    rehearsals = Rehearsal.query.filter(
        Rehearsal.program_id.in_(program_ids),
        Rehearsal.scheduled_date >= today,
        Rehearsal.scheduled_date <= end_date,
        Rehearsal.status != 'cancelled'
    ).order_by(Rehearsal.scheduled_date, Rehearsal.scheduled_start_time).limit(limit).all()

    rehearsals_data = []
    for r in rehearsals:
        program = Program.query.get(r.program_id)
        rehearsals_data.append({
            'id': r.id,
            'program_id': r.program_id,
            'program_name': program.name if program else '',
            'program_color': program.display_color if program else None,
            'scheduled_date': r.scheduled_date.isoformat(),
            'scheduled_start_time': r.scheduled_start_time.strftime('%H:%M') if r.scheduled_start_time else None,
            'scheduled_end_time': r.scheduled_end_time.strftime('%H:%M') if r.scheduled_end_time else None,
            'location': r.location,
            'notes': r.notes
        })

    return jsonify({'rehearsals': rehearsals_data})


@member_portal_bp.route('/my-info', methods=['GET'])
@login_required
def get_my_info():
    """Get member's personal information."""
    user = g.current_user

    if not user.member_id:
        return jsonify({
            'member': None,
            'user': {
                'id': user.id,
                'username': user.username,
                'display_name': user.display_name,
                'email': user.email,
                'phone': user.phone
            }
        })

    member = Member.query.get(user.member_id)
    if not member:
        return jsonify({'error': '成员信息不存在'}), 404

    return jsonify({
        'member': {
            'id': member.id,
            'name': member.name,
            'student_id': member.student_id,
            'gender': member.gender,
            'department': member.department,
            'grade': member.grade,
            'phone': member.phone,
            'email': member.email,
            'status': member.status
        },
        'user': {
            'id': user.id,
            'username': user.username,
            'display_name': user.display_name,
            'email': user.email,
            'phone': user.phone
        }
    })
