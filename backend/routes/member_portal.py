"""Member portal routes - API endpoints for member users."""
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, g

from database import db
from models import (
    Program, Member, Rehearsal, Attendance, Semester, ProgramMember
)
from auth import login_required
from utils.attendance import (
    is_rehearsal_completed,
    attendance_mode_for,
    build_rehearsal_slot,
    sorted_program_rehearsals,
    PHYSICALLY_ATTENDED_STATUSES,
)


member_portal_bp = Blueprint('member_portal', __name__)


@member_portal_bp.route('/semesters', methods=['GET'])
@login_required
def list_semesters():
    """Read-only list of semesters, for member-side semester switcher."""
    semesters = Semester.query.order_by(Semester.start_date.desc()).all()
    return jsonify({
        'semesters': [s.to_dict() for s in semesters],
    })


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
    """Attendance timeline for the current member.

    Per program returns the full list of non-cancelled rehearsals plus a
    `rehearsal_id -> status` map for this member. Frontend renders a
    color-coded strip per program (request: 不显示百分比，按时间横轴显示).
    """
    user = g.current_user
    semester_id = request.args.get('semester_id', type=int)

    if not user.member_id:
        return jsonify({'member': None, 'programs': []})

    member = Member.query.get(user.member_id)
    if not member:
        return jsonify({'error': '成员信息不存在'}), 404

    if not semester_id:
        current_semester = Semester.get_current()
        semester_id = current_semester.id if current_semester else None

    program_memberships = ProgramMember.query.filter_by(
        member_id=member.id,
        status='active'
    ).all()

    programs_data = []
    for pm in program_memberships:
        program = pm.program
        if not program:
            continue
        if semester_id and program.semester_id != semester_id:
            continue

        rehearsals = sorted_program_rehearsals(program)
        rehearsal_dicts = [build_rehearsal_slot(r) for r in rehearsals]
        counted_ids = {
            r['id'] for r in rehearsal_dicts
            if r['is_completed'] and r['counts_for_attendance']
        }

        attendance = {}
        attended = 0
        rehearsal_ids = [r['id'] for r in rehearsal_dicts]
        if rehearsal_ids:
            recs = Attendance.query.filter(
                Attendance.rehearsal_id.in_(rehearsal_ids),
                Attendance.member_id == member.id,
            ).all()
            for rec in recs:
                if not rec.status:
                    continue
                attendance[str(rec.rehearsal_id)] = rec.status
                if rec.rehearsal_id in counted_ids and rec.status in PHYSICALLY_ATTENDED_STATUSES:
                    attended += 1

        programs_data.append({
            'program_id': program.id,
            'program_name': program.name,
            'attendance_mode': attendance_mode_for(program.name),
            'rehearsals': rehearsal_dicts,
            'completed_total': len(counted_ids),
            'attendance': attendance,
            'attended_count': attended,
        })

    return jsonify({
        'member': {
            'id': member.id,
            'name': member.name,
            'student_id': member.student_id or '',
            'department': member.department or ''
        },
        'programs': programs_data,
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
