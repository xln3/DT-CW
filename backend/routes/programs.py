"""Program management routes."""
import csv
import io
from flask import Blueprint, request, jsonify, g

from database import db
from models import Program, ProgramMember, Member, Semester, AuditLog, User
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
        display_color=data.get('display_color', '').strip() or '#3498DB',
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

    if 'display_color' in data:
        program.display_color = data['display_color'].strip() or '#3498DB'

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


@programs_bp.route('/import-csv', methods=['POST'])
@committee_required
def import_programs_csv():
    """Import programs and members from CSV file.

    CSV format (column-based):
    Row 1: Program names (one per column)
    Row 2: Member count info (optional, ignored)
    Row 3+: Member names (one per row, each column belongs to corresponding program)
    """
    if 'file' not in request.files:
        return jsonify({'error': '请上传CSV文件'}), 400

    file = request.files['file']
    if not file.filename or not file.filename.endswith('.csv'):
        return jsonify({'error': '请上传CSV格式文件'}), 400

    # Get current semester
    current_semester = Semester.get_current()
    if not current_semester:
        return jsonify({'error': '请先设置当前学期'}), 400

    default_password = request.form.get('default_password', '202601')

    try:
        # Read CSV content
        content = file.read().decode('utf-8-sig')  # Handle BOM
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)

        if len(rows) < 3:
            return jsonify({'error': 'CSV格式错误：至少需要3行（节目名、人数说明、成员）'}), 400

        # Row 1: Program names
        program_names = [name.strip() for name in rows[0] if name.strip()]
        if not program_names:
            return jsonify({'error': '未找到节目名称'}), 400

        # Create or get programs
        programs = []
        for name in program_names:
            program = Program.query.filter_by(
                name=name,
                semester_id=current_semester.id
            ).first()
            if not program:
                program = Program(
                    name=name,
                    semester_id=current_semester.id,
                    category='dance',  # Default to dance
                    status='active'
                )
                db.session.add(program)
                db.session.flush()
            programs.append(program)

        # Row 3+: Members (skip row 2 which is count info)
        stats = {
            'programs_created': 0,
            'members_created': 0,
            'users_created': 0,
            'assignments_created': 0,
        }

        # Track which programs were newly created
        for p in programs:
            if p.id is None or db.session.is_modified(p):
                stats['programs_created'] += 1

        for row_idx, row in enumerate(rows[2:], start=3):
            for col_idx, member_name in enumerate(row):
                member_name = member_name.strip()
                if not member_name or col_idx >= len(programs):
                    continue

                program = programs[col_idx]

                # Find or create member
                member = Member.query.filter_by(name=member_name).first()
                if not member:
                    member = Member(
                        name=member_name,
                        gender='女',  # Default female
                        status='active'
                    )
                    db.session.add(member)
                    db.session.flush()
                    stats['members_created'] += 1

                    # Create user account for new member
                    existing_user = User.query.filter_by(username=member_name).first()
                    if not existing_user:
                        user = User(
                            username=member_name,
                            display_name=member_name,
                            role='member',  # Default to regular member role
                            status='active',
                            member_id=member.id
                        )
                        user.set_password(default_password)
                        db.session.add(user)
                        stats['users_created'] += 1

                # Add member to program if not already
                existing_pm = ProgramMember.query.filter_by(
                    program_id=program.id,
                    member_id=member.id
                ).first()

                if not existing_pm:
                    pm = ProgramMember(
                        program_id=program.id,
                        member_id=member.id,
                        role='ensemble',
                        status='active'
                    )
                    db.session.add(pm)
                    stats['assignments_created'] += 1
                elif existing_pm.status != 'active':
                    existing_pm.status = 'active'
                    existing_pm.left_at = None
                    stats['assignments_created'] += 1

        db.session.commit()

        # Log
        AuditLog.log(
            action=AuditLog.ACTION_CREATE,
            user=g.current_user,
            module='attendance',
            resource_type='program_import',
            details=stats,
            ip_address=request.remote_addr
        )

        return jsonify({
            'message': '导入成功',
            'stats': stats,
            'programs': [p.to_dict() for p in programs]
        })

    except UnicodeDecodeError:
        return jsonify({'error': 'CSV文件编码错误，请使用UTF-8编码'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500
