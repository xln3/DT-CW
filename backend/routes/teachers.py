"""Teacher management routes."""
from flask import Blueprint, request, jsonify, g

from database import db
from models import Teacher, AuditLog
from auth.decorators import login_required, committee_required
from auth.permissions import Permission, check_permission

teachers_bp = Blueprint('teachers', __name__)


@teachers_bp.route('', methods=['GET'])
@login_required
def list_teachers():
    """List all teachers."""
    status = request.args.get('status')
    search = request.args.get('search', '').strip()

    query = Teacher.query

    if status:
        query = query.filter_by(status=status)

    if search:
        query = query.filter(
            db.or_(
                Teacher.name.ilike(f'%{search}%'),
                Teacher.specialty.ilike(f'%{search}%')
            )
        )

    teachers = query.order_by(Teacher.name).all()

    # Check if user can view sensitive info
    include_sensitive = check_permission(g.current_user, Permission.TEACHER_VIEW_SENSITIVE)

    return jsonify({
        'teachers': [t.to_dict(include_sensitive=include_sensitive) for t in teachers]
    })


@teachers_bp.route('/<int:teacher_id>', methods=['GET'])
@login_required
def get_teacher(teacher_id):
    """Get teacher by ID."""
    teacher = Teacher.query.get_or_404(teacher_id)

    include_sensitive = check_permission(g.current_user, Permission.TEACHER_VIEW_SENSITIVE)

    return jsonify({'teacher': teacher.to_dict(include_sensitive=include_sensitive)})


@teachers_bp.route('', methods=['POST'])
@committee_required
def create_teacher():
    """Create a new teacher."""
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供教师信息'}), 400

    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': '姓名不能为空'}), 400

    teacher = Teacher(
        name=name,
        phone=data.get('phone', '').strip() or None,
        id_card_last4=data.get('id_card_last4', '').strip() or None,
        bank_account=data.get('bank_account', '').strip() or None,
        specialty=data.get('specialty', '').strip() or None,
        notes=data.get('notes', '').strip() or None,
        status='active'
    )

    db.session.add(teacher)
    db.session.commit()

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_CREATE,
        user=g.current_user,
        module='attendance',
        resource_type='teacher',
        resource_id=teacher.id,
        details={'name': name},
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '教师创建成功',
        'teacher': teacher.to_dict()
    }), 201


@teachers_bp.route('/<int:teacher_id>', methods=['PUT'])
@committee_required
def update_teacher(teacher_id):
    """Update a teacher."""
    teacher = Teacher.query.get_or_404(teacher_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': '姓名不能为空'}), 400
        teacher.name = name

    if 'phone' in data:
        teacher.phone = data['phone'].strip() or None

    if 'id_card_last4' in data:
        teacher.id_card_last4 = data['id_card_last4'].strip() or None

    if 'bank_account' in data:
        teacher.bank_account = data['bank_account'].strip() or None

    if 'specialty' in data:
        teacher.specialty = data['specialty'].strip() or None

    if 'notes' in data:
        teacher.notes = data['notes'].strip() or None

    if 'status' in data:
        status = data['status'].strip()
        if status not in ['active', 'inactive']:
            return jsonify({'error': '无效的状态'}), 400
        teacher.status = status

    db.session.commit()

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_UPDATE,
        user=g.current_user,
        module='attendance',
        resource_type='teacher',
        resource_id=teacher.id,
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '教师更新成功',
        'teacher': teacher.to_dict()
    })


@teachers_bp.route('/<int:teacher_id>', methods=['DELETE'])
@committee_required
def delete_teacher(teacher_id):
    """Delete a teacher."""
    teacher = Teacher.query.get_or_404(teacher_id)

    name = teacher.name
    db.session.delete(teacher)
    db.session.commit()

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_DELETE,
        user=g.current_user,
        module='attendance',
        resource_type='teacher',
        resource_id=teacher_id,
        details={'name': name},
        ip_address=request.remote_addr
    )

    return jsonify({'message': '教师已删除'})
