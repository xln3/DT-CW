"""Public attendance display routes (no authentication required)."""
from flask import Blueprint, request, jsonify

from database import db
from models import Program, Member, Rehearsal, Attendance, Semester

public_attendance_bp = Blueprint('public_attendance', __name__)


@public_attendance_bp.route('/overview', methods=['GET'])
def attendance_overview():
    """Get attendance overview for all programs."""
    semester_id = request.args.get('semester_id', type=int)

    if not semester_id:
        current_semester = Semester.get_current()
        semester_id = current_semester.id if current_semester else None

    if not semester_id:
        return jsonify({'error': '未设置当前学期'}), 400

    programs = Program.query.filter_by(
        semester_id=semester_id,
        status='active'
    ).order_by(Program.name).all()

    overview = []
    for program in programs:
        rehearsals = program.rehearsals.all()
        total_rehearsals = len(rehearsals)

        if total_rehearsals == 0:
            overview.append({
                'program_id': program.id,
                'program_name': program.name,
                'category': program.category,
                'member_count': program.members.filter_by(status='active').count(),
                'rehearsal_count': 0,
                'avg_attendance_rate': 0
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

        avg_rate = (present_count / total_records * 100) if total_records > 0 else 0

        overview.append({
            'program_id': program.id,
            'program_name': program.name,
            'category': program.category,
            'member_count': program.members.filter_by(status='active').count(),
            'rehearsal_count': total_rehearsals,
            'avg_attendance_rate': round(avg_rate, 1)
        })

    return jsonify({
        'semester_id': semester_id,
        'overview': overview
    })


@public_attendance_bp.route('/programs/<int:program_id>', methods=['GET'])
def program_attendance(program_id):
    """Get detailed attendance for a program."""
    program = Program.query.get_or_404(program_id)

    rehearsals = program.rehearsals.order_by(Rehearsal.scheduled_date.desc()).all()
    members = [pm.member for pm in program.members.filter_by(status='active')]

    # Build attendance matrix
    member_stats = {}
    for member in members:
        member_stats[member.id] = {
            'member_id': member.id,
            'member_name': member.name,
            'total': 0,
            'normal': 0,
            'late': 0,
            'early_leave': 0,
            'absent': 0,
            'leave': 0,
            'attendance_rate': 0
        }

    rehearsal_list = []
    for rehearsal in rehearsals:
        r_data = {
            'rehearsal_id': rehearsal.id,
            'date': rehearsal.scheduled_date.isoformat(),
            'start_time': rehearsal.scheduled_start_time.isoformat() if rehearsal.scheduled_start_time else None,
            'end_time': rehearsal.scheduled_end_time.isoformat() if rehearsal.scheduled_end_time else None,
            'location': rehearsal.location,
            'attendance': {}
        }

        for record in rehearsal.attendance_records:
            if record.member_id in member_stats:
                stats = member_stats[record.member_id]
                stats['total'] += 1

                if record.status == Attendance.STATUS_NORMAL:
                    stats['normal'] += 1
                elif record.status == Attendance.STATUS_LATE:
                    stats['late'] += 1
                elif record.status == Attendance.STATUS_EARLY_LEAVE:
                    stats['early_leave'] += 1
                elif record.status == Attendance.STATUS_ABSENT:
                    stats['absent'] += 1
                elif record.status in [
                    Attendance.STATUS_LEAVE_ABSENT,
                    Attendance.STATUS_LEAVE_LATE,
                    Attendance.STATUS_LEAVE_EARLY
                ]:
                    stats['leave'] += 1

                r_data['attendance'][record.member_id] = {
                    'status': record.status,
                    'status_display': Attendance.get_status_display(record.status)
                }

        rehearsal_list.append(r_data)

    # Calculate attendance rate for each member
    for stats in member_stats.values():
        if stats['total'] > 0:
            effective = stats['normal'] + stats['leave']
            stats['attendance_rate'] = round(effective / stats['total'] * 100, 1)

    return jsonify({
        'program': {
            'id': program.id,
            'name': program.name,
            'category': program.category
        },
        'members': list(member_stats.values()),
        'rehearsals': rehearsal_list
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
        # Get programs in current semester
        programs_data = []
        for pm in member.program_memberships.filter_by(status='active'):
            program = pm.program
            if program.semester_id != semester_id:
                continue

            # Get attendance stats for this program
            records = Attendance.query.join(Rehearsal).filter(
                Attendance.member_id == member.id,
                Rehearsal.program_id == program.id
            ).all()

            total = len(records)
            normal = sum(1 for r in records if r.status == Attendance.STATUS_NORMAL)
            leave = sum(1 for r in records if r.status in [
                Attendance.STATUS_LEAVE_ABSENT,
                Attendance.STATUS_LEAVE_LATE,
                Attendance.STATUS_LEAVE_EARLY
            ])
            absent = sum(1 for r in records if r.status == Attendance.STATUS_ABSENT)

            programs_data.append({
                'program_id': program.id,
                'program_name': program.name,
                'total_rehearsals': total,
                'normal': normal,
                'leave': leave,
                'absent': absent,
                'attendance_rate': round((normal + leave) / total * 100, 1) if total > 0 else 0
            })

        results.append({
            'member_id': member.id,
            'name': member.name,
            'student_id': member.student_id,
            'department': member.department,
            'programs': programs_data
        })

    return jsonify({
        'members': results
    })
