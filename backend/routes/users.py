"""User management routes."""
from flask import Blueprint, request, jsonify, g

from database import db
from models import User, AuditLog
from auth.decorators import login_required, committee_required, admin_required
from auth.permissions import Permission, check_permission

users_bp = Blueprint('users', __name__)


@users_bp.route('', methods=['GET'])
@committee_required
def list_users():
    """List all users with optional pagination."""
    page = request.args.get('page', type=int)
    per_page = request.args.get('per_page', 20, type=int)

    query = User.query.order_by(User.created_at.desc())

    if page is not None:
        total = query.count()
        users = query.offset((page - 1) * per_page).limit(per_page).all()
        return jsonify({
            'items': [u.to_dict(include_email=True) for u in users],
            'total': total,
            'page': page,
            'per_page': per_page,
            'pages': (total + per_page - 1) // per_page,
        })

    users = query.all()
    return jsonify({
        'users': [u.to_dict(include_email=True) for u in users]
    })


@users_bp.route('/<int:user_id>', methods=['GET'])
@committee_required
def get_user(user_id):
    """Get user by ID."""
    user = User.query.get_or_404(user_id)
    return jsonify({'user': user.to_dict(include_email=True)})


@users_bp.route('', methods=['POST'])
@committee_required
def create_user():
    """Create a new user."""
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供用户信息'}), 400

    username = data.get('username', '').strip()
    password = data.get('password', '')
    display_name = data.get('display_name', '').strip()
    role = data.get('role', '').strip()

    # Validation
    if not username:
        return jsonify({'error': '用户名不能为空'}), 400
    if not password or len(password) < 6:
        return jsonify({'error': '密码长度至少6位'}), 400
    if not display_name:
        return jsonify({'error': '显示名称不能为空'}), 400
    if role not in User.VALID_ROLES:
        return jsonify({'error': '无效的角色'}), 400

    # Check if user is trying to create admin (only admin can)
    current_user = g.current_user
    if role == User.ROLE_ADMIN and not current_user.is_admin():
        return jsonify({'error': '只有管理员可以创建管理员账号'}), 403

    # Check if username already exists
    if User.query.filter_by(username=username).first():
        return jsonify({'error': '用户名已存在'}), 400

    user = User(
        username=username,
        display_name=display_name,
        email=data.get('email', '').strip() or None,
        phone=data.get('phone', '').strip() or None,
        role=role,
        status='active'
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_CREATE,
        user=current_user,
        module='users',
        resource_type='user',
        resource_id=user.id,
        details={'username': username, 'role': role},
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '用户创建成功',
        'user': user.to_dict(include_email=True)
    }), 201


@users_bp.route('/<int:user_id>', methods=['PUT'])
@committee_required
def update_user(user_id):
    """Update a user."""
    user = User.query.get_or_404(user_id)
    current_user = g.current_user
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    # Committee members cannot edit admin users
    if user.is_admin() and not current_user.is_admin():
        return jsonify({'error': '无权修改管理员账号'}), 403

    # Update fields
    if 'display_name' in data:
        display_name = data['display_name'].strip()
        if not display_name:
            return jsonify({'error': '显示名称不能为空'}), 400
        user.display_name = display_name

    if 'email' in data:
        user.email = data['email'].strip() or None

    if 'phone' in data:
        user.phone = data['phone'].strip() or None

    if 'role' in data:
        role = data['role'].strip()
        if role not in User.VALID_ROLES:
            return jsonify({'error': '无效的角色'}), 400
        # Only admin can change role to/from admin
        if (role == User.ROLE_ADMIN or user.role == User.ROLE_ADMIN) and not current_user.is_admin():
            return jsonify({'error': '无权修改管理员角色'}), 403
        user.role = role

    if 'status' in data:
        status = data['status'].strip()
        if status not in ['active', 'inactive']:
            return jsonify({'error': '无效的状态'}), 400
        # Cannot deactivate yourself
        if user.id == current_user.id and status == 'inactive':
            return jsonify({'error': '不能禁用自己的账号'}), 400
        user.status = status

    if 'password' in data and data['password']:
        password = data['password']
        if len(password) < 6:
            return jsonify({'error': '密码长度至少6位'}), 400
        user.set_password(password)

    db.session.commit()

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_UPDATE,
        user=current_user,
        module='users',
        resource_type='user',
        resource_id=user.id,
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '用户更新成功',
        'user': user.to_dict(include_email=True)
    })


@users_bp.route('/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete a user (admin only)."""
    user = User.query.get_or_404(user_id)
    current_user = g.current_user

    # Cannot delete yourself
    if user.id == current_user.id:
        return jsonify({'error': '不能删除自己的账号'}), 400

    username = user.username
    db.session.delete(user)
    db.session.commit()

    # Log
    AuditLog.log(
        action=AuditLog.ACTION_DELETE,
        user=current_user,
        module='users',
        resource_type='user',
        resource_id=user_id,
        details={'username': username},
        ip_address=request.remote_addr
    )

    return jsonify({'message': '用户已删除'})
