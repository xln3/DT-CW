"""Authentication routes."""
from datetime import datetime
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity
)

from database import db
from models import User, AuditLog
from auth import login_required
from auth.permissions import get_user_permissions

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
def login():
    """User login endpoint."""
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供登录信息'}), 400

    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400

    user = User.query.filter_by(username=username).first()

    if not user or not user.check_password(password):
        return jsonify({'error': '用户名或密码错误'}), 401

    if user.status != 'active':
        return jsonify({'error': '账号已被禁用'}), 403

    # Update last login time
    user.last_login_at = datetime.utcnow()
    db.session.commit()

    # Create tokens (identity must be a string)
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    # Log the login
    AuditLog.log(
        action=AuditLog.ACTION_LOGIN,
        user=user,
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '登录成功',
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict(include_email=True),
        'permissions': get_user_permissions(user)
    })


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token."""
    user_id = get_jwt_identity()
    # Convert back to int for database lookup
    user = User.query.get(int(user_id))

    if not user or user.status != 'active':
        return jsonify({'error': '用户不存在或已被禁用'}), 401

    access_token = create_access_token(identity=str(user_id))

    return jsonify({
        'access_token': access_token
    })


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """User logout endpoint."""
    user = g.current_user

    # Log the logout
    AuditLog.log(
        action=AuditLog.ACTION_LOGOUT,
        user=user,
        ip_address=request.remote_addr
    )

    return jsonify({'message': '已退出登录'})


@auth_bp.route('/me', methods=['GET'])
@login_required
def get_current_user():
    """Get current user info."""
    user = g.current_user

    user_data = user.to_dict(include_email=True)
    # Include linked member info if exists
    if user.member:
        user_data['member'] = user.member.to_dict()

    return jsonify({
        'user': user_data,
        'permissions': get_user_permissions(user)
    })


@auth_bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    """Change current user's password."""
    user = g.current_user
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供密码信息'}), 400

    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')

    if not current_password or not new_password:
        return jsonify({'error': '当前密码和新密码不能为空'}), 400

    if len(new_password) < 6:
        return jsonify({'error': '新密码长度至少6位'}), 400

    if not user.check_password(current_password):
        return jsonify({'error': '当前密码错误'}), 400

    user.set_password(new_password)
    db.session.commit()

    # Log password change
    AuditLog.log(
        action=AuditLog.ACTION_UPDATE,
        user=user,
        module='auth',
        resource_type='password',
        resource_id=user.id,
        ip_address=request.remote_addr
    )

    return jsonify({'message': '密码修改成功'})


@auth_bp.route('/profile', methods=['PUT'])
@login_required
def update_profile():
    """Update current user's profile."""
    user = g.current_user
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    # Update user fields
    if 'username' in data:
        new_username = data['username'].strip()
        if new_username and new_username != user.username:
            # Check if username is already taken
            existing = User.query.filter_by(username=new_username).first()
            if existing:
                return jsonify({'error': '用户名已被使用'}), 400
            if len(new_username) < 3:
                return jsonify({'error': '用户名长度至少3位'}), 400
            user.username = new_username

    if 'display_name' in data:
        display_name = data['display_name'].strip()
        if display_name:
            user.display_name = display_name

    if 'email' in data:
        user.email = data['email'].strip() or None

    if 'phone' in data:
        user.phone = data['phone'].strip() or None

    # Update linked member fields if user has a linked member
    if user.member:
        member = user.member
        if 'gender' in data:
            member.gender = data['gender'].strip() or None
        if 'department' in data:
            member.department = data['department'].strip() or None
        if 'grade' in data:
            member.grade = data['grade'].strip() or None
        if 'student_id' in data:
            member.student_id = data['student_id'].strip() or None
        if 'member_phone' in data:
            member.phone = data['member_phone'].strip() or None
        # Extended member fields (editable by member)
        if 'class_name' in data:
            member.class_name = data['class_name'].strip() or None
        if 'member_email' in data:
            member.email = data['member_email'].strip() or None
        if 'dormitory' in data:
            member.dormitory = data['dormitory'].strip() or None
        if 'birth_date' in data:
            from datetime import datetime
            birth_date = data['birth_date']
            if birth_date and isinstance(birth_date, str):
                try:
                    member.birth_date = datetime.strptime(birth_date.strip(), '%Y-%m-%d').date()
                except ValueError:
                    member.birth_date = None
            else:
                member.birth_date = None
        if 'ethnicity' in data:
            member.ethnicity = data['ethnicity'].strip() or None
        if 'hometown' in data:
            member.hometown = data['hometown'].strip() or None
        if 'political_status' in data:
            member.political_status = data['political_status'].strip() or None
        if 'party_branch' in data:
            member.party_branch = data['party_branch'].strip() or None
        if 'is_talented' in data:
            member.is_talented = bool(data['is_talented'])
        if 'is_concentrated_class' in data:
            member.is_concentrated_class = bool(data['is_concentrated_class'])
        if 'team_role' in data:
            member.team_role = data['team_role'].strip() or None
        if 'join_year' in data:
            member.join_year = data['join_year']
        if 'team_level' in data:
            member.team_level = data['team_level'].strip() or None
        if 'graduating_this_semester' in data:
            member.graduating_this_semester = bool(data['graduating_this_semester'])

    db.session.commit()

    # Log profile update
    AuditLog.log(
        action=AuditLog.ACTION_UPDATE,
        user=user,
        module='auth',
        resource_type='profile',
        resource_id=user.id,
        ip_address=request.remote_addr
    )

    user_data = user.to_dict(include_email=True)
    if user.member:
        user_data['member'] = user.member.to_dict()

    return jsonify({
        'message': '个人资料更新成功',
        'user': user_data
    })
