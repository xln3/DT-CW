"""Rehearsal management routes."""
from datetime import datetime
from flask import Blueprint, request, jsonify, g, send_file

from database import db
from models import Rehearsal, Program, Teacher, Attendance, AuditLog
from auth.decorators import login_required, committee_required
from auth.permissions import Permission, check_program_permission
from utils.attendance import VALID_LEAVE_TYPES, VALID_STATUSES

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

    if 'counts_towards_attendance' in data:
        rehearsal.counts_towards_attendance = bool(data['counts_towards_attendance'])
        if not rehearsal.counts_towards_attendance:
            # When excluding from attendance, require a reason
            exclusion_reason = data.get('exclusion_reason', '').strip()
            if not exclusion_reason:
                return jsonify({'error': '排除考勤计算时必须填写原因'}), 400
            rehearsal.exclusion_reason = exclusion_reason
        else:
            rehearsal.exclusion_reason = None

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
        if record.has_leave:
            leave_type = data.get('leave_type')
            if leave_type not in VALID_LEAVE_TYPES:
                return jsonify({'error': f'无效的请假类型，有效值: {", ".join(VALID_LEAVE_TYPES)}'}), 400
            record.leave_type = leave_type
        else:
            record.leave_type = None
        record.leave_reason = data.get('leave_reason', '').strip() or None

    if 'manual_override' in data:
        record.manual_override = bool(data['manual_override'])
        record.override_reason = data.get('override_reason', '').strip() or None

        if record.manual_override and 'status' in data:
            status = data['status']
            if status not in VALID_STATUSES:
                return jsonify({'error': f'无效的考勤状态，有效值: {", ".join(VALID_STATUSES)}'}), 400
            record.status = status
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


@rehearsals_bp.route('/import-csv', methods=['POST'])
@committee_required
def import_rehearsals_csv():
    """Import rehearsals from CSV file.

    CSV format:
    日期,节目名称,开始时间,结束时间,地点,教师,备注
    2024-01-15,测试舞蹈,09:00,11:00,舞蹈排练厅A,李老师,
    2024-01-16,测试舞蹈,14:00,16:00,舞蹈排练厅B,,第一次排练
    """
    import csv
    import io

    if 'file' not in request.files:
        return jsonify({'error': '请上传CSV文件'}), 400

    file = request.files['file']
    if not file.filename.endswith('.csv'):
        return jsonify({'error': '请上传CSV格式文件'}), 400

    user = g.current_user

    try:
        # Read and decode CSV
        content = file.read().decode('utf-8-sig')  # Handle BOM
        reader = csv.DictReader(io.StringIO(content))

        created_count = 0
        skipped_count = 0
        errors = []
        row_num = 1  # Header is row 0

        for row in reader:
            row_num += 1
            try:
                # Parse date
                date_str = row.get('日期', '').strip()
                if not date_str:
                    errors.append(f'第{row_num}行: 日期不能为空')
                    continue

                try:
                    scheduled_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                except ValueError:
                    errors.append(f'第{row_num}行: 日期格式错误，应为 YYYY-MM-DD')
                    continue

                # Find program
                program_name = row.get('节目名称', '').strip()
                if not program_name:
                    errors.append(f'第{row_num}行: 节目名称不能为空')
                    continue

                program = Program.query.filter_by(name=program_name, status='active').first()
                if not program:
                    errors.append(f'第{row_num}行: 找不到节目 "{program_name}"')
                    continue

                # Parse times
                start_time = None
                end_time = None
                start_time_str = row.get('开始时间', '').strip()
                end_time_str = row.get('结束时间', '').strip()

                if start_time_str:
                    try:
                        start_time = datetime.strptime(start_time_str, '%H:%M').time()
                    except ValueError:
                        errors.append(f'第{row_num}行: 开始时间格式错误，应为 HH:MM')
                        continue

                if end_time_str:
                    try:
                        end_time = datetime.strptime(end_time_str, '%H:%M').time()
                    except ValueError:
                        errors.append(f'第{row_num}行: 结束时间格式错误，应为 HH:MM')
                        continue

                # Find teacher (optional)
                teacher_id = None
                teacher_name = row.get('教师', '').strip()
                if teacher_name:
                    teacher = Teacher.query.filter_by(name=teacher_name, status='active').first()
                    if teacher:
                        teacher_id = teacher.id

                # Check for duplicate
                existing = Rehearsal.query.filter_by(
                    program_id=program.id,
                    scheduled_date=scheduled_date
                ).first()

                if existing:
                    skipped_count += 1
                    continue

                # Create rehearsal
                location = row.get('地点', '').strip() or None
                notes = row.get('备注', '').strip() or None

                rehearsal = Rehearsal(
                    program_id=program.id,
                    teacher_id=teacher_id,
                    scheduled_date=scheduled_date,
                    scheduled_start_time=start_time,
                    scheduled_end_time=end_time,
                    location=location,
                    notes=notes,
                    status='scheduled'
                )
                db.session.add(rehearsal)
                db.session.flush()  # Get ID for attendance init

                # Initialize attendance records
                _init_attendance_records(rehearsal)
                created_count += 1

            except Exception as e:
                errors.append(f'第{row_num}行: 处理错误 - {str(e)}')
                continue

        db.session.commit()

        # Log
        AuditLog.log(
            action=AuditLog.ACTION_CREATE,
            user=user,
            module='attendance',
            resource_type='rehearsal_import',
            details={
                'created': created_count,
                'skipped': skipped_count,
                'errors': len(errors)
            },
            ip_address=request.remote_addr
        )

        return jsonify({
            'message': f'导入完成: 创建 {created_count} 个排练, 跳过 {skipped_count} 个重复',
            'created_count': created_count,
            'skipped_count': skipped_count,
            'errors': errors[:20]  # Limit error output
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'CSV解析错误: {str(e)}'}), 400


@rehearsals_bp.route('/import-template', methods=['GET'])
def get_import_template():
    """Download CSV import template."""
    import io

    template = """日期,节目名称,开始时间,结束时间,地点,教师,备注
2024-01-15,示例舞蹈节目,09:00,11:00,舞蹈排练厅A,张老师,
2024-01-16,示例舞蹈节目,14:00,16:00,舞蹈排练厅B,,第二次排练
2024-01-17,另一个节目,19:00,21:00,多功能厅,,晚间排练"""

    output = io.BytesIO()
    output.write('\ufeff'.encode('utf-8'))  # BOM for Excel
    output.write(template.encode('utf-8'))
    output.seek(0)

    return send_file(
        output,
        mimetype='text/csv',
        as_attachment=True,
        download_name='rehearsal_import_template.csv'
    )
