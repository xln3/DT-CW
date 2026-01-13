"""Program management routes."""
from flask import Blueprint, request, jsonify, g

from database import db
from models import Program, ProgramMember, Member, Semester, AuditLog
from auth.decorators import login_required, committee_required
from auth.permissions import Permission, check_program_permission

programs_bp = Blueprint('programs', __name__)


@programs_bp.route('', methods=['GET'])
@login_required
def list_programs():
    """List all programs."""
    semester_id = request.args.get('semester_id', type=int)
    status = request.args.get('status')
    category = request.args.get('category')

    query = Program.query

    if semester_id:
        query = query.filter_by(semester_id=semester_id)
    else:
        # Default to current semester
        current_semester = Semester.get_current()
        if current_semester:
            query = query.filter_by(semester_id=current_semester.id)

    if status:
        query = query.filter_by(status=status)

    if category:
        query = query.filter_by(category=category)

    programs = query.order_by(Program.name).all()

    # Filter by user's accessible programs if program manager
    user = g.current_user
    if user.is_program_manager():
        managed_ids = [up.program_id for up in user.managed_programs]
        programs = [p for p in programs if p.id in managed_ids]

    return jsonify({
        'programs': [p.to_dict() for p in programs]
    })


@programs_bp.route('/<int:program_id>', methods=['GET'])
@login_required
def get_program(program_id):
    """Get program by ID."""
    program = Program.query.get_or_404(program_id)

    # Check access for program manager
    user = g.current_user
    if user.is_program_manager() and not user.can_manage_program(program_id):
        return jsonify({'error': '无权访问该节目'}), 403

    include_members = request.args.get('include_members', 'false').lower() == 'true'
    include_rehearsals = request.args.get('include_rehearsals', 'false').lower() == 'true'

    return jsonify({
        'program': program.to_dict(include_members=include_members, include_rehearsals=include_rehearsals)
    })


@programs_bp.route('', methods=['POST'])
@committee_required
def create_program():
    """Create a new program."""
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供节目信息'}), 400

    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': '节目名称不能为空'}), 400

    semester_id = data.get('semester_id')
    if not semester_id:
        current_semester = Semester.get_current()
        semester_id = current_semester.id if current_semester else None

    program = Program(
        name=name,
        category=data.get('category', '').strip() or None,
        description=data.get('description', '').strip() or None,
        semester_id=semester_id,
        status='active'
    )

    db.session.add(program)
    db.session.commit()

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_CREATE,
        user=g.current_user,
        module='attendance',
        resource_type='program',
        resource_id=program.id,
        details={'name': name},
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '节目创建成功',
        'program': program.to_dict()
    }), 201


@programs_bp.route('/<int:program_id>', methods=['PUT'])
@login_required
def update_program(program_id):
    """Update a program."""
    program = Program.query.get_or_404(program_id)
    user = g.current_user

    # Check permission
    if not check_program_permission(user, Permission.PROGRAM_EDIT, program_id):
        return jsonify({'error': '无权修改该节目'}), 403

    data = request.get_json()
    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': '节目名称不能为空'}), 400
        program.name = name

    if 'category' in data:
        program.category = data['category'].strip() or None

    if 'description' in data:
        program.description = data['description'].strip() or None

    if 'status' in data and (user.is_admin() or user.is_committee()):
        status = data['status'].strip()
        if status not in ['active', 'completed', 'cancelled']:
            return jsonify({'error': '无效的状态'}), 400
        program.status = status

    db.session.commit()

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_UPDATE,
        user=user,
        module='attendance',
        resource_type='program',
        resource_id=program.id,
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '节目更新成功',
        'program': program.to_dict()
    })


@programs_bp.route('/<int:program_id>', methods=['DELETE'])
@committee_required
def delete_program(program_id):
    """Delete a program."""
    program = Program.query.get_or_404(program_id)

    name = program.name
    db.session.delete(program)
    db.session.commit()

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_DELETE,
        user=g.current_user,
        module='attendance',
        resource_type='program',
        resource_id=program_id,
        details={'name': name},
        ip_address=request.remote_addr
    )

    return jsonify({'message': '节目已删除'})


# Program member management
@programs_bp.route('/<int:program_id>/members', methods=['GET'])
@login_required
def get_program_members(program_id):
    """Get members of a program."""
    program = Program.query.get_or_404(program_id)

    user = g.current_user
    if user.is_program_manager() and not user.can_manage_program(program_id):
        return jsonify({'error': '无权访问该节目'}), 403

    status = request.args.get('status', 'active')
    members = program.members.filter_by(status=status).all()

    return jsonify({
        'members': [pm.to_dict() for pm in members]
    })


@programs_bp.route('/<int:program_id>/members', methods=['POST'])
@login_required
def add_program_member(program_id):
    """Add a member to a program."""
    program = Program.query.get_or_404(program_id)
    user = g.current_user

    if not check_program_permission(user, Permission.PROGRAM_EDIT, program_id):
        return jsonify({'error': '无权修改该节目'}), 403

    data = request.get_json()
    if not data:
        return jsonify({'error': '请提供成员信息'}), 400

    member_id = data.get('member_id')
    if not member_id:
        return jsonify({'error': '请选择队员'}), 400

    member = Member.query.get(member_id)
    if not member:
        return jsonify({'error': '队员不存在'}), 404

    # Check if already in program
    existing = ProgramMember.query.filter_by(
        program_id=program_id,
        member_id=member_id
    ).first()

    if existing:
        if existing.status == 'active':
            return jsonify({'error': '该队员已在节目中'}), 400
        # Reactivate if previously left
        existing.status = 'active'
        existing.left_at = None
        existing.role = data.get('role', '').strip() or None
    else:
        pm = ProgramMember(
            program_id=program_id,
            member_id=member_id,
            role=data.get('role', '').strip() or None,
            status='active'
        )
        db.session.add(pm)

    db.session.commit()

    return jsonify({
        'message': '成员添加成功'
    })


@programs_bp.route('/<int:program_id>/members/batch', methods=['POST'])
@login_required
def batch_add_program_members(program_id):
    """Batch add members to a program."""
    program = Program.query.get_or_404(program_id)
    user = g.current_user

    if not check_program_permission(user, Permission.PROGRAM_EDIT, program_id):
        return jsonify({'error': '无权修改该节目'}), 403

    data = request.get_json()
    if not data or 'member_ids' not in data:
        return jsonify({'error': '请提供成员列表'}), 400

    member_ids = data['member_ids']
    role = data.get('role', '').strip() or None
    added = 0

    for member_id in member_ids:
        member = Member.query.get(member_id)
        if not member:
            continue

        existing = ProgramMember.query.filter_by(
            program_id=program_id,
            member_id=member_id
        ).first()

        if existing:
            if existing.status != 'active':
                existing.status = 'active'
                existing.left_at = None
                existing.role = role
                added += 1
        else:
            pm = ProgramMember(
                program_id=program_id,
                member_id=member_id,
                role=role,
                status='active'
            )
            db.session.add(pm)
            added += 1

    db.session.commit()

    return jsonify({
        'message': f'成功添加{added}名成员'
    })


@programs_bp.route('/<int:program_id>/members/<int:member_id>', methods=['DELETE'])
@login_required
def remove_program_member(program_id, member_id):
    """Remove a member from a program."""
    user = g.current_user

    if not check_program_permission(user, Permission.PROGRAM_EDIT, program_id):
        return jsonify({'error': '无权修改该节目'}), 403

    pm = ProgramMember.query.filter_by(
        program_id=program_id,
        member_id=member_id
    ).first()

    if not pm:
        return jsonify({'error': '该成员不在节目中'}), 404

    from datetime import datetime
    pm.status = 'left'
    pm.left_at = datetime.utcnow()
    db.session.commit()

    return jsonify({'message': '成员已移除'})
