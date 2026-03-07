"""Public attendance display routes (no authentication required)."""
from flask import Blueprint, request, jsonify

from database import db
from models import Program, Member, Rehearsal, Attendance, Semester, ProgramMember
from utils.attendance import is_rehearsal_completed, counts_for_attendance, ATTENDED_STATUSES

public_attendance_bp = Blueprint('public_attendance', __name__)


@public_attendance_bp.route('/overview', methods=['GET'])
def attendance_overview():
    """Get attendance overview for all programs."""
    semester_id = request.args.get('semester_id', type=int)

    if not semester_id:
        current_semester = Semester.get_current()
        semester_id = current_semester.id if current_semester else None

    semester = None
    if semester_id:
        semester = Semester.query.get(semester_id)

    programs = Program.query.filter_by(
        status='active'
    ).order_by(Program.name).all()

    if semester_id:
        programs = [p for p in programs if p.semester_id == semester_id]

    # Calculate overall stats
    total_members = set()
    total_rehearsals = 0
    all_attendance_rates = []

    program_list = []
    for program in programs:
        all_rehearsals = program.rehearsals.all()
        # Only count non-cancelled rehearsals
        active_rehearsals = [r for r in all_rehearsals if r.status != 'cancelled']
        # Only count completed rehearsals for display
        completed_rehearsals = [r for r in active_rehearsals if is_rehearsal_completed(r)]
        # Only count rehearsals that are marked to count towards attendance for rate calculation
        counted_rehearsals = [r for r in active_rehearsals if counts_for_attendance(r)]

        num_total = len(active_rehearsals)
        num_completed = len(completed_rehearsals)
        num_counted = len(counted_rehearsals)
        total_rehearsals += num_counted  # Only count those marked for attendance

        # Get member count
        member_count = ProgramMember.query.filter_by(
            program_id=program.id,
            status='active'
        ).count()

        # Add to total members
        for pm in ProgramMember.query.filter_by(program_id=program.id, status='active'):
            total_members.add(pm.member_id)

        if num_counted == 0:
            program_list.append({
                'id': program.id,
                'name': program.name,
                'category': program.category or '',
                'member_count': member_count,
                'rehearsal_count': num_total,
                'completed_rehearsal_count': num_completed,
                'counted_rehearsal_count': num_counted,
                'attendance_rate': 100.0
            })
            continue

        # Calculate attendance rate (only from rehearsals marked to count)
        total_records = 0
        present_count = 0

        for rehearsal in counted_rehearsals:
            for record in rehearsal.attendance_records:
                total_records += 1
                if record.status in ATTENDED_STATUSES:
                    present_count += 1

        attendance_rate = (present_count / total_records * 100) if total_records > 0 else 100.0
        all_attendance_rates.append(attendance_rate)

        program_list.append({
            'id': program.id,
            'name': program.name,
            'category': program.category or '',
            'member_count': member_count,
            'rehearsal_count': num_total,
            'completed_rehearsal_count': num_completed,
            'counted_rehearsal_count': num_counted,
            'attendance_rate': round(attendance_rate, 1)
        })

    avg_rate = sum(all_attendance_rates) / len(all_attendance_rates) if all_attendance_rates else 100.0

    return jsonify({
        'semester': {
            'id': semester.id,
            'name': semester.name
        } if semester else None,
        'programs': program_list,
        'overall_stats': {
            'total_members': len(total_members),
            'total_programs': len(programs),
            'total_rehearsals': total_rehearsals,
            'average_attendance_rate': round(avg_rate, 1)
        }
    })


@public_attendance_bp.route('/programs/<int:program_id>', methods=['GET'])
def program_attendance(program_id):
    """Get detailed attendance for a program."""
    program = Program.query.get_or_404(program_id)

    all_rehearsals = program.rehearsals.order_by(Rehearsal.scheduled_date.desc()).all()
    # Only count non-cancelled rehearsals
    active_rehearsals = [r for r in all_rehearsals if r.status != 'cancelled']
    # Only count completed rehearsals for display
    completed_rehearsals = [r for r in active_rehearsals if is_rehearsal_completed(r)]
    # Only count rehearsals that are marked to count towards attendance for rate calculation
    counted_rehearsals = [r for r in active_rehearsals if counts_for_attendance(r)]

    # Get active members
    program_members = ProgramMember.query.filter_by(
        program_id=program.id,
        status='active'
    ).all()
    members = [pm.member for pm in program_members if pm.member]

    # Build member stats (only from completed rehearsals)
    member_list = []
    for member in members:
        stats = {
            'member_id': member.id,
            'member_name': member.name,
            'student_id': member.student_id or '',
            'total_rehearsals': 0,
            'normal_count': 0,
            'late_count': 0,
            'early_leave_count': 0,
            'absent_count': 0,
            'leave_count': 0,
            'attendance_rate': 100.0
        }

        # Calculate stats from attendance records (only counted rehearsals)
        for rehearsal in counted_rehearsals:
            record = Attendance.query.filter_by(
                rehearsal_id=rehearsal.id,
                member_id=member.id
            ).first()

            if record:
                stats['total_rehearsals'] += 1
                if record.status == Attendance.STATUS_NORMAL:
                    stats['normal_count'] += 1
                elif record.status == Attendance.STATUS_LATE:
                    stats['late_count'] += 1
                elif record.status == Attendance.STATUS_EARLY_LEAVE:
                    stats['early_leave_count'] += 1
                elif record.status == Attendance.STATUS_ABSENT:
                    stats['absent_count'] += 1
                elif record.status in [
                    Attendance.STATUS_LEAVE_ABSENT,
                    Attendance.STATUS_LEAVE_LATE,
                    Attendance.STATUS_LEAVE_EARLY
                ]:
                    stats['leave_count'] += 1

        # Calculate attendance rate
        if stats['total_rehearsals'] > 0:
            effective = (stats['normal_count'] + stats['late_count']
                         + stats['early_leave_count'] + stats['leave_count'])
            stats['attendance_rate'] = round(effective / stats['total_rehearsals'] * 100, 1)

        member_list.append(stats)

    # Build rehearsal list (only completed ones, show status and whether it counts)
    rehearsal_list = []
    for rehearsal in completed_rehearsals[:20]:  # Last 20 completed rehearsals
        records = rehearsal.attendance_records.all()
        total = len(records)
        present = sum(1 for r in records if r.status in ATTENDED_STATUSES)

        # Check if this rehearsal counts towards attendance
        counts = rehearsal.counts_towards_attendance
        counts_towards = counts if counts is not None else True

        rehearsal_list.append({
            'id': rehearsal.id,
            'date': rehearsal.scheduled_date.isoformat(),
            'location': rehearsal.location or '',
            'status': rehearsal.status or 'scheduled',
            'counts_towards_attendance': counts_towards,
            'exclusion_reason': rehearsal.exclusion_reason if not counts_towards else None,
            'attendance_rate': round(present / total * 100, 1) if total > 0 else 100.0
        })

    # Calculate overall stats
    num_total = len(active_rehearsals)
    num_completed = len(completed_rehearsals)
    num_counted = len(counted_rehearsals)
    total_members = len(members)
    avg_rate = sum(m['attendance_rate'] for m in member_list) / len(member_list) if member_list else 100.0

    return jsonify({
        'program': {
            'id': program.id,
            'name': program.name,
            'category': program.category or ''
        },
        'stats': {
            'total_rehearsals': num_total,
            'completed_rehearsals': num_completed,
            'counted_rehearsals': num_counted,
            'total_members': total_members,
            'average_attendance_rate': round(avg_rate, 1)
        },
        'members': member_list,
        'recent_rehearsals': rehearsal_list
    })


@public_attendance_bp.route('/overview/matrix', methods=['GET'])
def attendance_overview_matrix():
    """Get attendance matrix for all programs (programs x dates)."""
    semester_id = request.args.get('semester_id', type=int)

    if not semester_id:
        current_semester = Semester.get_current()
        semester_id = current_semester.id if current_semester else None

    semester = None
    if semester_id:
        semester = Semester.query.get(semester_id)

    programs = Program.query.filter_by(
        status='active'
    ).order_by(Program.name).all()

    if semester_id:
        programs = [p for p in programs if p.semester_id == semester_id]

    # Collect all completed rehearsal dates across all programs
    all_dates = set()
    program_rehearsals = {}  # program_id -> list of rehearsals

    for program in programs:
        all_rehearsals = program.rehearsals.all()
        counted_rehearsals = [r for r in all_rehearsals
                              if r.status != 'cancelled' and counts_for_attendance(r)]
        program_rehearsals[program.id] = counted_rehearsals
        for r in counted_rehearsals:
            all_dates.add(r.scheduled_date.isoformat())

    # Sort dates chronologically
    sorted_dates = sorted(all_dates)

    # Build matrix data
    program_list = []
    matrix = {}

    for program in programs:
        program_list.append({
            'id': program.id,
            'name': program.name,
            'category': program.category or ''
        })

        matrix[program.id] = {}
        rehearsals = program_rehearsals.get(program.id, [])

        for rehearsal in rehearsals:
            date_str = rehearsal.scheduled_date.isoformat()
            records = rehearsal.attendance_records.all()
            total = len(records)

            # Count by status
            normal_count = 0
            partial_count = 0  # late, early_leave, leave_late, leave_early
            absent_count = 0   # absent, leave_absent

            for r in records:
                if r.status == Attendance.STATUS_NORMAL:
                    normal_count += 1
                elif r.status in [Attendance.STATUS_LATE, Attendance.STATUS_EARLY_LEAVE,
                                 Attendance.STATUS_LEAVE_LATE, Attendance.STATUS_LEAVE_EARLY]:
                    partial_count += 1
                elif r.status in [Attendance.STATUS_ABSENT, Attendance.STATUS_LEAVE_ABSENT]:
                    absent_count += 1

            matrix[program.id][date_str] = {
                'rehearsal_id': rehearsal.id,
                'counts': True,
                'total': total,
                'normal': normal_count,
                'partial': partial_count,
                'absent': absent_count
            }

    return jsonify({
        'semester': {
            'id': semester.id,
            'name': semester.name
        } if semester else None,
        'programs': program_list,
        'dates': sorted_dates,
        'matrix': matrix
    })


@public_attendance_bp.route('/programs/<int:program_id>/matrix', methods=['GET'])
def program_attendance_matrix(program_id):
    """Get attendance matrix for a program (members x rehearsals)."""
    from pypinyin import lazy_pinyin

    program = Program.query.get_or_404(program_id)

    # Get completed rehearsals
    all_rehearsals = program.rehearsals.order_by(Rehearsal.scheduled_date).all()
    completed_rehearsals = [r for r in all_rehearsals
                          if r.status != 'cancelled' and is_rehearsal_completed(r)]

    # Get active members with leader info
    program_members = ProgramMember.query.filter_by(
        program_id=program.id,
        status='active'
    ).all()

    # Sort members: leaders first, then by pinyin
    def member_sort_key(pm):
        is_leader = pm.is_leader if hasattr(pm, 'is_leader') else False
        name = pm.member.name if pm.member else ''
        pinyin = ''.join(lazy_pinyin(name))
        return (0 if is_leader else 1, pinyin)

    program_members.sort(key=member_sort_key)

    # Build member list
    member_list = []
    for pm in program_members:
        if pm.member:
            is_leader = pm.is_leader if hasattr(pm, 'is_leader') else False
            member_list.append({
                'id': pm.member.id,
                'name': pm.member.name,
                'is_leader': is_leader
            })

    # Build rehearsal list
    rehearsal_list = []
    for r in completed_rehearsals:
        counts = r.counts_towards_attendance
        counts_towards = counts if counts is not None else True
        rehearsal_list.append({
            'id': r.id,
            'date': r.scheduled_date.isoformat(),
            'counts': counts_towards
        })

    # Build attendance matrix
    matrix = {}
    for pm in program_members:
        if not pm.member:
            continue
        member_id = pm.member.id
        matrix[member_id] = {}

        for rehearsal in completed_rehearsals:
            record = Attendance.query.filter_by(
                rehearsal_id=rehearsal.id,
                member_id=member_id
            ).first()

            if record:
                matrix[member_id][rehearsal.id] = {
                    'status': record.status,
                    'detected_before': record.detected_before,
                    'detected_after': record.detected_after,
                    'has_leave': record.has_leave,
                    'leave_type': record.leave_type,
                }
            else:
                matrix[member_id][rehearsal.id] = None

    # Calculate summary (A/B format: attended / total)
    summary = {}
    for pm in program_members:
        if not pm.member:
            continue
        member_id = pm.member.id
        attended = 0
        total = 0

        for rehearsal in completed_rehearsals:
            counts = rehearsal.counts_towards_attendance
            counts_towards = counts if counts is not None else True
            if not counts_towards:
                continue

            record = Attendance.query.filter_by(
                rehearsal_id=rehearsal.id,
                member_id=member_id
            ).first()

            if record:
                total += 1
                if record.status in ATTENDED_STATUSES:
                    attended += 1

        summary[member_id] = {
            'attended': attended,
            'total': total
        }

    return jsonify({
        'program': {
            'id': program.id,
            'name': program.name,
            'category': program.category or ''
        },
        'members': member_list,
        'rehearsals': rehearsal_list,
        'matrix': matrix,
        'summary': summary
    })


@public_attendance_bp.route('/members', methods=['GET'])
def member_attendance():
    """Search and get attendance for individual members."""
    search = request.args.get('search', '').strip()
    semester_id = request.args.get('semester_id', type=int)

    if not search:
        return jsonify({'error': '请输入搜索关键词'}), 400

    if not semester_id:
        current_semester = Semester.get_current()
        semester_id = current_semester.id if current_semester else None

    # Search members
    members = Member.query.filter(
        db.or_(
            Member.name.ilike(f'%{search}%'),
            Member.student_id.ilike(f'%{search}%')
        )
    ).filter_by(status='active').limit(20).all()

    results = []
    for member in members:
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
            'early_leave_count': 0,
            'absent_count': 0,
            'leave_count': 0
        }

        for pm in program_memberships:
            program = pm.program
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
            early_leave = sum(1 for r in records if r.status == Attendance.STATUS_EARLY_LEAVE)
            absent = sum(1 for r in records if r.status == Attendance.STATUS_ABSENT)
            leave = sum(1 for r in records if r.status in [
                Attendance.STATUS_LEAVE_ABSENT,
                Attendance.STATUS_LEAVE_LATE,
                Attendance.STATUS_LEAVE_EARLY
            ])

            # Add to totals
            total_stats['total_rehearsals'] += total
            total_stats['normal_count'] += normal
            total_stats['late_count'] += late
            total_stats['early_leave_count'] += early_leave
            total_stats['absent_count'] += absent
            total_stats['leave_count'] += leave

            effective = normal + late + early_leave + leave
            programs_data.append({
                'program_id': program.id,
                'program_name': program.name,
                'total_rehearsals': total,
                'normal_count': normal,
                'late_count': late,
                'early_leave_count': early_leave,
                'absent_count': absent,
                'leave_count': leave,
                'attendance_rate': round(effective / total * 100, 1) if total > 0 else 100.0
            })

        # Calculate overall rate
        overall_rate = 100.0
        if total_stats['total_rehearsals'] > 0:
            effective = (total_stats['normal_count'] + total_stats['late_count']
                         + total_stats['early_leave_count'] + total_stats['leave_count'])
            overall_rate = round(effective / total_stats['total_rehearsals'] * 100, 1)

        results.append({
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
                'early_leave_count': total_stats['early_leave_count'],
                'absent_count': total_stats['absent_count'],
                'leave_count': total_stats['leave_count'],
                'attendance_rate': overall_rate
            }
        })

    return jsonify({
        'results': results
    })
