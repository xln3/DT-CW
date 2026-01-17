"""Member management routes."""
from flask import Blueprint, request, jsonify, g
from pypinyin import lazy_pinyin

from database import db
from models import Member, AuditLog
from auth.decorators import login_required, committee_required
from auth.permissions import Permission, check_permission


def _sort_members_by_pinyin(members):
    """Sort members by pinyin of their names."""
    def sort_key(m):
        return ''.join(lazy_pinyin(m.name or ''))
    return sorted(members, key=sort_key)

members_bp = Blueprint('members', __name__)


@members_bp.route('', methods=['GET'])
@login_required
def list_members():
    """List all members."""
    # Filter options
    status = request.args.get('status')
    search = request.args.get('search', '').strip()

    query = Member.query

    if status:
        query = query.filter_by(status=status)

    if search:
        query = query.filter(
            db.or_(
                Member.name.ilike(f'%{search}%'),
                Member.student_id.ilike(f'%{search}%'),
                Member.department.ilike(f'%{search}%')
            )
        )

    members = query.all()
    sorted_members = _sort_members_by_pinyin(members)

    return jsonify({
        'members': [m.to_dict() for m in sorted_members]
    })


@members_bp.route('/<int:member_id>', methods=['GET'])
@login_required
def get_member(member_id):
    """Get member by ID."""
    member = Member.query.get_or_404(member_id)
    return jsonify({'member': member.to_dict(include_programs=True)})


@members_bp.route('', methods=['POST'])
@committee_required
def create_member():
    """Create a new member."""
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供队员信息'}), 400

    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': '姓名不能为空'}), 400

    member = Member(
        name=name,
        student_id=data.get('student_id', '').strip() or None,
        phone=data.get('phone', '').strip() or None,
        gender=data.get('gender', '').strip() or None,
        department=data.get('department', '').strip() or None,
        grade=data.get('grade', '').strip() or None,
        notes=data.get('notes', '').strip() or None,
        status='active'
    )

    db.session.add(member)
    db.session.commit()

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_CREATE,
        user=g.current_user,
        module='attendance',
        resource_type='member',
        resource_id=member.id,
        details={'name': name},
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '队员创建成功',
        'member': member.to_dict()
    }), 201


@members_bp.route('/<int:member_id>', methods=['PUT'])
@committee_required
def update_member(member_id):
    """Update a member."""
    member = Member.query.get_or_404(member_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': '姓名不能为空'}), 400
        member.name = name

    if 'student_id' in data:
        member.student_id = data['student_id'].strip() or None

    if 'phone' in data:
        member.phone = data['phone'].strip() or None

    if 'gender' in data:
        member.gender = data['gender'].strip() or None

    if 'department' in data:
        member.department = data['department'].strip() or None

    if 'grade' in data:
        member.grade = data['grade'].strip() or None

    if 'notes' in data:
        member.notes = data['notes'].strip() or None

    if 'status' in data:
        status = data['status'].strip()
        if status not in ['active', 'inactive']:
            return jsonify({'error': '无效的状态'}), 400
        member.status = status

    db.session.commit()

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_UPDATE,
        user=g.current_user,
        module='attendance',
        resource_type='member',
        resource_id=member.id,
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '队员更新成功',
        'member': member.to_dict()
    })


@members_bp.route('/<int:member_id>', methods=['DELETE'])
@committee_required
def delete_member(member_id):
    """Delete a member."""
    member = Member.query.get_or_404(member_id)

    name = member.name
    db.session.delete(member)
    db.session.commit()

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_DELETE,
        user=g.current_user,
        module='attendance',
        resource_type='member',
        resource_id=member_id,
        details={'name': name},
        ip_address=request.remote_addr
    )

    return jsonify({'message': '队员已删除'})


@members_bp.route('/batch', methods=['POST'])
@committee_required
def batch_create_members():
    """Batch create members."""
    data = request.get_json()

    if not data or 'members' not in data:
        return jsonify({'error': '请提供队员列表'}), 400

    members_data = data['members']
    if not isinstance(members_data, list):
        return jsonify({'error': '队员列表格式错误'}), 400

    created = []
    errors = []

    for i, m_data in enumerate(members_data):
        name = m_data.get('name', '').strip() if isinstance(m_data, dict) else ''
        if not name:
            errors.append(f'第{i+1}行: 姓名不能为空')
            continue

        member = Member(
            name=name,
            student_id=m_data.get('student_id', '').strip() or None,
            phone=m_data.get('phone', '').strip() or None,
            gender=m_data.get('gender', '').strip() or None,
            department=m_data.get('department', '').strip() or None,
            grade=m_data.get('grade', '').strip() or None,
            status='active'
        )
        db.session.add(member)
        created.append(member)

    if created:
        db.session.commit()

    return jsonify({
        'message': f'成功创建{len(created)}名队员',
        'created_count': len(created),
        'errors': errors
    })
