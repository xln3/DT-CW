"""Public attendance display routes (no authentication required)."""
from flask import Blueprint, request, jsonify

from database import db
from models import Program, Member, Rehearsal, Attendance, Semester, ProgramMember

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
        rehearsals = program.rehearsals.all()
        num_rehearsals = len(rehearsals)
        total_rehearsals += num_rehearsals

        # Get member count
        member_count = ProgramMember.query.filter_by(
            program_id=program.id,
            status='active'
        ).count()

        # Add to total members
        for pm in ProgramMember.query.filter_by(program_id=program.id, status='active'):
            total_members.add(pm.member_id)

        if num_rehearsals == 0:
            program_list.append({
                'id': program.id,
                'name': program.name,
                'category': program.category or '',
                'member_count': member_count,
                'rehearsal_count': 0,
                'attendance_rate': 100.0
            })
            continue

        # Calculate attendance rate
        total_records = 0
        present_count = 0

        for rehearsal in rehearsals:
            for record in rehearsal.attendance_records:
                total_records += 1
                if record.status in [
                    Attendance.STATUS_NORMAL,
                    Attendance.STATUS_LEAVE_ABSENT,
                    Attendance.STATUS_LEAVE_LATE,
                    Attendance.STATUS_LEAVE_EARLY
                ]:
                    present_count += 1

        attendance_rate = (present_count / total_records * 100) if total_records > 0 else 100.0
        all_attendance_rates.append(attendance_rate)

        program_list.append({
            'id': program.id,
            'name': program.name,
            'category': program.category or '',
            'member_count': member_count,
            'rehearsal_count': num_rehearsals,
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

    rehearsals = program.rehearsals.order_by(Rehearsal.scheduled_date.desc()).all()

    # Get active members
    program_members = ProgramMember.query.filter_by(
        program_id=program.id,
        status='active'
    ).all()
    members = [pm.member for pm in program_members if pm.member]

    # Build member stats
    member_list = []
    for member in members:
        stats = {
            'member_id': member.id,
            'member_name': member.name,
            'student_id': member.student_id or '',
            'total_rehearsals': 0,
            'normal_count': 0,
            'late_count': 0,
            'absent_count': 0,
            'leave_count': 0,
            'attendance_rate': 100.0
        }

        # Calculate stats from attendance records
        for rehearsal in rehearsals:
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
                elif record.status in [Attendance.STATUS_EARLY_LEAVE, Attendance.STATUS_ABSENT]:
                    stats['absent_count'] += 1
                elif record.status in [
                    Attendance.STATUS_LEAVE_ABSENT,
                    Attendance.STATUS_LEAVE_LATE,
                    Attendance.STATUS_LEAVE_EARLY
                ]:
                    stats['leave_count'] += 1

        # Calculate attendance rate
        if stats['total_rehearsals'] > 0:
            effective = stats['normal_count'] + stats['leave_count']
            stats['attendance_rate'] = round(effective / stats['total_rehearsals'] * 100, 1)

        member_list.append(stats)

    # Build rehearsal list
    rehearsal_list = []
    for rehearsal in rehearsals[:20]:  # Last 20 rehearsals
        records = rehearsal.attendance_records.all()
        total = len(records)
        present = sum(1 for r in records if r.status in [
            Attendance.STATUS_NORMAL,
            Attendance.STATUS_LEAVE_ABSENT,
            Attendance.STATUS_LEAVE_LATE,
            Attendance.STATUS_LEAVE_EARLY
        ])

        rehearsal_list.append({
            'id': rehearsal.id,
            'date': rehearsal.scheduled_date.isoformat(),
            'location': rehearsal.location or '',
            'attendance_rate': round(present / total * 100, 1) if total > 0 else 100.0
        })

    # Calculate overall stats
    total_rehearsals = len(rehearsals)
    total_members = len(members)
    avg_rate = sum(m['attendance_rate'] for m in member_list) / len(member_list) if member_list else 100.0

    return jsonify({
        'program': {
            'id': program.id,
            'name': program.name,
            'category': program.category or ''
        },
        'stats': {
            'total_rehearsals': total_rehearsals,
            'total_members': total_members,
            'average_attendance_rate': round(avg_rate, 1)
        },
        'members': member_list,
        'recent_rehearsals': rehearsal_list
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
            'absent_count': 0,
            'leave_count': 0
        }

        for pm in program_memberships:
            program = pm.program
            if semester_id and program.semester_id != semester_id:
                continue

            # Get attendance records
            records = Attendance.query.join(Rehearsal).filter(
                Attendance.member_id == member.id,
                Rehearsal.program_id == program.id
            ).all()

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
                'absent_count': total_stats['absent_count'],
                'leave_count': total_stats['leave_count'],
                'attendance_rate': overall_rate
            }
        })

    return jsonify({
        'results': results
    })
