"""Rehearsal management routes."""
from datetime import datetime
from flask import Blueprint, request, jsonify, g

from database import db
from models import Rehearsal, Program, Teacher, Attendance, AuditLog
from auth.decorators import login_required
from auth.permissions import Permission, check_program_permission

rehearsals_bp = Blueprint('rehearsals', __name__)


@rehearsals_bp.route('', methods=['GET'])
@login_required
def list_rehearsals():
    """List rehearsals."""
    program_id = request.args.get('program_id', type=int)
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')

    query = Rehearsal.query

    if program_id:
        query = query.filter_by(program_id=program_id)

    if date_from:
        try:
            from_date = datetime.strptime(date_from, '%Y-%m-%d').date()
            query = query.filter(Rehearsal.scheduled_date >= from_date)
        except ValueError:
            pass

    if date_to:
        try:
            to_date = datetime.strptime(date_to, '%Y-%m-%d').date()
            query = query.filter(Rehearsal.scheduled_date <= to_date)
        except ValueError:
            pass

    rehearsals = query.order_by(Rehearsal.scheduled_date.desc()).all()

    # Filter by user's accessible programs if program manager
    user = g.current_user
    if user.is_program_manager():
        managed_ids = [up.program_id for up in user.managed_programs]
        rehearsals = [r for r in rehearsals if r.program_id in managed_ids]

    return jsonify({
        'rehearsals': [r.to_dict() for r in rehearsals]
    })


@rehearsals_bp.route('/<int:rehearsal_id>', methods=['GET'])
@login_required
def get_rehearsal(rehearsal_id):
    """Get rehearsal by ID."""
    rehearsal = Rehearsal.query.get_or_404(rehearsal_id)

    user = g.current_user
    if user.is_program_manager() and not user.can_manage_program(rehearsal.program_id):
        return jsonify({'error': '无权访问该排练'}), 403

    include_attendance = request.args.get('include_attendance', 'false').lower() == 'true'

    return jsonify({
        'rehearsal': rehearsal.to_dict(include_attendance=include_attendance)
    })


@rehearsals_bp.route('', methods=['POST'])
@login_required
def create_rehearsal():
    """Create a new rehearsal."""
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供排练信息'}), 400

    program_id = data.get('program_id')
    if not program_id:
        return jsonify({'error': '请选择节目'}), 400

    program = Program.query.get(program_id)
    if not program:
        return jsonify({'error': '节目不存在'}), 404

    user = g.current_user
    if not check_program_permission(user, Permission.REHEARSAL_CREATE, program_id):
        return jsonify({'error': '无权为该节目创建排练'}), 403

    scheduled_date = data.get('scheduled_date')
    if not scheduled_date:
        return jsonify({'error': '请选择排练日期'}), 400

    try:
        scheduled_date = datetime.strptime(scheduled_date, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': '日期格式错误'}), 400

    # Parse times
    start_time = None
    end_time = None
    if data.get('scheduled_start_time'):
        try:
            start_time = datetime.strptime(data['scheduled_start_time'], '%H:%M').time()
        except ValueError:
            pass
    if data.get('scheduled_end_time'):
        try:
            end_time = datetime.strptime(data['scheduled_end_time'], '%H:%M').time()
        except ValueError:
            pass

    teacher_id = data.get('teacher_id')
    if teacher_id:
        teacher = Teacher.query.get(teacher_id)
        if not teacher:
            return jsonify({'error': '教师不存在'}), 404

    rehearsal = Rehearsal(
        program_id=program_id,
        teacher_id=teacher_id,
        scheduled_date=scheduled_date,
        scheduled_start_time=start_time,
        scheduled_end_time=end_time,
        location=data.get('location', '').strip() or None,
        notes=data.get('notes', '').strip() or None
    )

    db.session.add(rehearsal)
    db.session.commit()

    # Initialize attendance records for all program members
    _init_attendance_records(rehearsal)

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_CREATE,
        user=user,
        module='attendance',
        resource_type='rehearsal',
        resource_id=rehearsal.id,
        details={'program_id': program_id, 'date': str(scheduled_date)},
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '排练创建成功',
        'rehearsal': rehearsal.to_dict()
    }), 201


@rehearsals_bp.route('/<int:rehearsal_id>', methods=['PUT'])
@login_required
def update_rehearsal(rehearsal_id):
    """Update a rehearsal."""
    rehearsal = Rehearsal.query.get_or_404(rehearsal_id)
    user = g.current_user

    if not check_program_permission(user, Permission.REHEARSAL_EDIT, rehearsal.program_id):
        return jsonify({'error': '无权修改该排练'}), 403

    data = request.get_json()
    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    if 'scheduled_date' in data:
        try:
            rehearsal.scheduled_date = datetime.strptime(data['scheduled_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '日期格式错误'}), 400

    if 'scheduled_start_time' in data:
        if data['scheduled_start_time']:
            try:
                rehearsal.scheduled_start_time = datetime.strptime(
                    data['scheduled_start_time'], '%H:%M'
                ).time()
            except ValueError:
                pass
        else:
            rehearsal.scheduled_start_time = None

    if 'scheduled_end_time' in data:
        if data['scheduled_end_time']:
            try:
                rehearsal.scheduled_end_time = datetime.strptime(
                    data['scheduled_end_time'], '%H:%M'
                ).time()
            except ValueError:
                pass
        else:
            rehearsal.scheduled_end_time = None

    if 'teacher_id' in data:
        teacher_id = data['teacher_id']
        if teacher_id:
            teacher = Teacher.query.get(teacher_id)
            if not teacher:
                return jsonify({'error': '教师不存在'}), 404
        rehearsal.teacher_id = teacher_id

    if 'location' in data:
        rehearsal.location = data['location'].strip() or None

    if 'notes' in data:
        rehearsal.notes = data['notes'].strip() or None

    if 'videos' in data:
        rehearsal.set_videos(data['videos'])

    if 'status' in data:
        if data['status'] in ['scheduled', 'completed', 'cancelled']:
            rehearsal.status = data['status']

    db.session.commit()

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_UPDATE,
        user=user,
        module='attendance',
        resource_type='rehearsal',
        resource_id=rehearsal.id,
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '排练更新成功',
        'rehearsal': rehearsal.to_dict()
    })


@rehearsals_bp.route('/<int:rehearsal_id>', methods=['DELETE'])
@login_required
def delete_rehearsal(rehearsal_id):
    """Delete a rehearsal."""
    rehearsal = Rehearsal.query.get_or_404(rehearsal_id)
    user = g.current_user

    if not check_program_permission(user, Permission.REHEARSAL_DELETE, rehearsal.program_id):
        return jsonify({'error': '无权删除该排练'}), 403

    program_id = rehearsal.program_id
    scheduled_date = str(rehearsal.scheduled_date)

    db.session.delete(rehearsal)
    db.session.commit()

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_DELETE,
        user=user,
        module='attendance',
        resource_type='rehearsal',
        resource_id=rehearsal_id,
        details={'program_id': program_id, 'date': scheduled_date},
        ip_address=request.remote_addr
    )

    return jsonify({'message': '排练已删除'})


# Attendance management
@rehearsals_bp.route('/<int:rehearsal_id>/attendance', methods=['GET'])
@login_required
def get_attendance(rehearsal_id):
    """Get attendance records for a rehearsal."""
    rehearsal = Rehearsal.query.get_or_404(rehearsal_id)
    user = g.current_user

    if user.is_program_manager() and not user.can_manage_program(rehearsal.program_id):
        return jsonify({'error': '无权访问该排练'}), 403

    records = rehearsal.attendance_records.all()

    return jsonify({
        'attendance': [r.to_dict() for r in records]
    })


@rehearsals_bp.route('/<int:rehearsal_id>/attendance/<int:member_id>', methods=['PUT'])
@login_required
def update_attendance(rehearsal_id, member_id):
    """Update attendance record for a member."""
    rehearsal = Rehearsal.query.get_or_404(rehearsal_id)
    user = g.current_user

    if not check_program_permission(user, Permission.ATTENDANCE_EDIT, rehearsal.program_id):
        return jsonify({'error': '无权修改考勤'}), 403

    record = Attendance.query.filter_by(
        rehearsal_id=rehearsal_id,
        member_id=member_id
    ).first()

    if not record:
        return jsonify({'error': '考勤记录不存在'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    if 'has_leave' in data:
        record.has_leave = bool(data['has_leave'])
        record.leave_type = data.get('leave_type')
        record.leave_reason = data.get('leave_reason', '').strip() or None

    if 'manual_override' in data:
        record.manual_override = bool(data['manual_override'])
        record.override_reason = data.get('override_reason', '').strip() or None

        if record.manual_override and 'status' in data:
            record.status = data['status']
    else:
        # Recalculate status
        record.calculate_status()

    db.session.commit()

    return jsonify({
        'message': '考勤更新成功',
        'attendance': record.to_dict()
    })


def _init_attendance_records(rehearsal):
    """Initialize attendance records for all program members."""
    program = rehearsal.program
    for pm in program.members.filter_by(status='active'):
        record = Attendance(
            rehearsal_id=rehearsal.id,
            member_id=pm.member_id,
            status=Attendance.STATUS_ABSENT  # Default to absent until detected
        )
        db.session.add(record)
    db.session.commit()
