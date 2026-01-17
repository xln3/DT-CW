"""Teacher entry application routes."""
from datetime import datetime
from flask import Blueprint, request, jsonify, g

from database import db
from models import Teacher, Rehearsal, AuditLog
from models.teacher_application import TeacherEntryApplication
from auth.decorators import login_required, committee_required

teacher_applications_bp = Blueprint('teacher_applications', __name__)


@teacher_applications_bp.route('', methods=['GET'])
@login_required
def list_applications():
    """List all teacher entry applications."""
    status = request.args.get('status')
    teacher_id = request.args.get('teacher_id', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    query = TeacherEntryApplication.query

    if status:
        query = query.filter_by(status=status)

    if teacher_id:
        query = query.filter_by(teacher_id=teacher_id)

    if start_date:
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(TeacherEntryApplication.entry_date >= start)
        except ValueError:
            pass

    if end_date:
        try:
            end = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(TeacherEntryApplication.entry_date <= end)
        except ValueError:
            pass

    applications = query.order_by(
        TeacherEntryApplication.entry_date.desc(),
        TeacherEntryApplication.created_at.desc()
    ).all()

    return jsonify({
        'applications': [a.to_dict() for a in applications]
    })


@teacher_applications_bp.route('/pending', methods=['GET'])
@login_required
def list_pending():
    """List pending applications for approval."""
    applications = TeacherEntryApplication.query.filter_by(
        status=TeacherEntryApplication.STATUS_PENDING
    ).order_by(TeacherEntryApplication.entry_date).all()

    return jsonify({
        'applications': [a.to_dict(include_teacher=True) for a in applications]
    })


@teacher_applications_bp.route('/<int:application_id>', methods=['GET'])
@login_required
def get_application(application_id):
    """Get application by ID."""
    application = TeacherEntryApplication.query.get_or_404(application_id)

    return jsonify({
        'application': application.to_dict(include_teacher=True, include_rehearsal=True)
    })


@teacher_applications_bp.route('', methods=['POST'])
@login_required
def create_application():
    """Create a new entry application."""
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供申请信息'}), 400

    teacher_id = data.get('teacher_id')
    if not teacher_id:
        return jsonify({'error': '请选择教师'}), 400

    teacher = Teacher.query.get(teacher_id)
    if not teacher:
        return jsonify({'error': '教师不存在'}), 404

    entry_date_str = data.get('entry_date')
    if not entry_date_str:
        return jsonify({'error': '请选择入校日期'}), 400

    try:
        entry_date = datetime.strptime(entry_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': '日期格式无效'}), 400

    entry_time = None
    exit_time = None

    if data.get('entry_time'):
        try:
            entry_time = datetime.strptime(data['entry_time'], '%H:%M').time()
        except ValueError:
            pass

    if data.get('exit_time'):
        try:
            exit_time = datetime.strptime(data['exit_time'], '%H:%M').time()
        except ValueError:
            pass

    application = TeacherEntryApplication(
        teacher_id=teacher_id,
        rehearsal_id=data.get('rehearsal_id'),
        entry_date=entry_date,
        entry_time=entry_time,
        exit_time=exit_time,
        purpose=data.get('purpose', '').strip() or None,
        status=TeacherEntryApplication.STATUS_PENDING,
        created_by=g.current_user.id,
        notes=data.get('notes', '').strip() or None
    )

    db.session.add(application)
    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_CREATE,
        user=g.current_user,
        module='teacher',
        resource_type='entry_application',
        resource_id=application.id,
        details={'teacher_id': teacher_id, 'entry_date': entry_date_str},
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '入校申请创建成功',
        'application': application.to_dict()
    }), 201


@teacher_applications_bp.route('/<int:application_id>', methods=['PUT'])
@login_required
def update_application(application_id):
    """Update an application."""
    application = TeacherEntryApplication.query.get_or_404(application_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    # Only allow updates if still pending
    if application.status != TeacherEntryApplication.STATUS_PENDING:
        return jsonify({'error': '只能修改待审批的申请'}), 400

    if 'entry_date' in data:
        try:
            application.entry_date = datetime.strptime(data['entry_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '日期格式无效'}), 400

    if 'entry_time' in data:
        if data['entry_time']:
            try:
                application.entry_time = datetime.strptime(data['entry_time'], '%H:%M').time()
            except ValueError:
                pass
        else:
            application.entry_time = None

    if 'exit_time' in data:
        if data['exit_time']:
            try:
                application.exit_time = datetime.strptime(data['exit_time'], '%H:%M').time()
            except ValueError:
                pass
        else:
            application.exit_time = None

    if 'purpose' in data:
        application.purpose = data['purpose'].strip() or None

    if 'notes' in data:
        application.notes = data['notes'].strip() or None

    if 'rehearsal_id' in data:
        application.rehearsal_id = data['rehearsal_id']

    db.session.commit()

    return jsonify({
        'message': '申请更新成功',
        'application': application.to_dict()
    })


@teacher_applications_bp.route('/<int:application_id>/approve', methods=['POST'])
@committee_required
def approve_application(application_id):
    """Approve an application."""
    application = TeacherEntryApplication.query.get_or_404(application_id)

    if application.status != TeacherEntryApplication.STATUS_PENDING:
        return jsonify({'error': '只能审批待处理的申请'}), 400

    application.status = TeacherEntryApplication.STATUS_APPROVED
    application.approved_by = g.current_user.id
    application.approved_at = datetime.utcnow()

    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_UPDATE,
        user=g.current_user,
        module='teacher',
        resource_type='entry_application',
        resource_id=application.id,
        details={'action': 'approve'},
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '申请已批准',
        'application': application.to_dict()
    })


@teacher_applications_bp.route('/<int:application_id>/reject', methods=['POST'])
@committee_required
def reject_application(application_id):
    """Reject an application."""
    application = TeacherEntryApplication.query.get_or_404(application_id)
    data = request.get_json() or {}

    if application.status != TeacherEntryApplication.STATUS_PENDING:
        return jsonify({'error': '只能审批待处理的申请'}), 400

    application.status = TeacherEntryApplication.STATUS_REJECTED
    application.approved_by = g.current_user.id
    application.approved_at = datetime.utcnow()

    if data.get('reason'):
        application.notes = (application.notes or '') + f"\n拒绝原因: {data['reason']}"

    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_UPDATE,
        user=g.current_user,
        module='teacher',
        resource_type='entry_application',
        resource_id=application.id,
        details={'action': 'reject'},
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '申请已拒绝',
        'application': application.to_dict()
    })


@teacher_applications_bp.route('/<int:application_id>/complete', methods=['POST'])
@login_required
def complete_application(application_id):
    """Mark application as completed."""
    application = TeacherEntryApplication.query.get_or_404(application_id)

    if application.status != TeacherEntryApplication.STATUS_APPROVED:
        return jsonify({'error': '只能完成已批准的申请'}), 400

    application.status = TeacherEntryApplication.STATUS_COMPLETED
    db.session.commit()

    return jsonify({
        'message': '申请已标记为完成',
        'application': application.to_dict()
    })


@teacher_applications_bp.route('/<int:application_id>', methods=['DELETE'])
@login_required
def delete_application(application_id):
    """Delete an application."""
    application = TeacherEntryApplication.query.get_or_404(application_id)

    # Only allow deletion of pending applications
    if application.status != TeacherEntryApplication.STATUS_PENDING:
        return jsonify({'error': '只能删除待审批的申请'}), 400

    user = g.current_user
    # Only admin/committee or creator can delete
    if not (user.is_admin() or user.is_committee() or application.created_by == user.id):
        return jsonify({'error': '无权删除该申请'}), 403

    db.session.delete(application)
    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_DELETE,
        user=g.current_user,
        module='teacher',
        resource_type='entry_application',
        resource_id=application_id,
        ip_address=request.remote_addr
    )

    return jsonify({'message': '申请已删除'})


# Teacher-specific applications endpoint
@teacher_applications_bp.route('/teachers/<int:teacher_id>/applications', methods=['GET'])
@login_required
def get_teacher_applications(teacher_id):
    """Get all applications for a specific teacher."""
    Teacher.query.get_or_404(teacher_id)

    status = request.args.get('status')

    query = TeacherEntryApplication.query.filter_by(teacher_id=teacher_id)

    if status:
        query = query.filter_by(status=status)

    applications = query.order_by(
        TeacherEntryApplication.entry_date.desc()
    ).all()

    return jsonify({
        'applications': [a.to_dict(include_rehearsal=True) for a in applications]
    })


@teacher_applications_bp.route('/teachers/<int:teacher_id>/applications', methods=['POST'])
@login_required
def create_teacher_application(teacher_id):
    """Create application for a specific teacher."""
    teacher = Teacher.query.get_or_404(teacher_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供申请信息'}), 400

    entry_date_str = data.get('entry_date')
    if not entry_date_str:
        return jsonify({'error': '请选择入校日期'}), 400

    try:
        entry_date = datetime.strptime(entry_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': '日期格式无效'}), 400

    entry_time = None
    exit_time = None

    if data.get('entry_time'):
        try:
            entry_time = datetime.strptime(data['entry_time'], '%H:%M').time()
        except ValueError:
            pass

    if data.get('exit_time'):
        try:
            exit_time = datetime.strptime(data['exit_time'], '%H:%M').time()
        except ValueError:
            pass

    application = TeacherEntryApplication(
        teacher_id=teacher_id,
        rehearsal_id=data.get('rehearsal_id'),
        entry_date=entry_date,
        entry_time=entry_time,
        exit_time=exit_time,
        purpose=data.get('purpose', '').strip() or None,
        status=TeacherEntryApplication.STATUS_PENDING,
        created_by=g.current_user.id,
        notes=data.get('notes', '').strip() or None
    )

    db.session.add(application)
    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_CREATE,
        user=g.current_user,
        module='teacher',
        resource_type='entry_application',
        resource_id=application.id,
        details={'teacher_id': teacher_id, 'entry_date': entry_date_str},
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '入校申请创建成功',
        'application': application.to_dict()
    }), 201
