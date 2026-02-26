"""Authentication and authorization decorators."""
from functools import wraps
from flask import jsonify, request, g
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

from models import User
from .permissions import Permission, check_permission, check_program_permission


def login_required(f):
    """Decorator to require authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Let JWT errors propagate to the JWT error handlers
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        # Convert string identity back to int for database lookup
        user = User.query.get(int(user_id))

        if not user:
            print(f"[AUTH] User not found: {user_id}")
            return jsonify({'error': '用户不存在'}), 401

        if user.status != 'active':
            print(f"[AUTH] User disabled: {user.username}")
            return jsonify({'error': '账号已被禁用'}), 403

        g.current_user = user
        return f(*args, **kwargs)

    return decorated_function


def role_required(*roles):
    """Decorator to require specific roles."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Let JWT errors propagate to the JWT error handlers
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            # Convert string identity back to int for database lookup
            user = User.query.get(int(user_id))

            if not user:
                print(f"[AUTH] User not found: {user_id}")
                return jsonify({'error': '用户不存在'}), 401

            if user.status != 'active':
                print(f"[AUTH] User disabled: {user.username}")
                return jsonify({'error': '账号已被禁用'}), 403

            if user.role not in roles:
                print(f"[AUTH] Role denied: {user.username} has {user.role}, needs {roles}")
                return jsonify({'error': '权限不足'}), 403

            g.current_user = user
            return f(*args, **kwargs)

        return decorated_function
    return decorator


def permission_required(permission: Permission):
    """Decorator to require specific permission."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Let JWT errors propagate to the JWT error handlers
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            # Convert string identity back to int for database lookup
            user = User.query.get(int(user_id))

            if not user:
                return jsonify({'error': '用户不存在'}), 401

            if user.status != 'active':
                return jsonify({'error': '账号已被禁用'}), 403

            if not check_permission(user, permission):
                return jsonify({'error': '权限不足'}), 403

            g.current_user = user
            return f(*args, **kwargs)

        return decorated_function
    return decorator


def program_access_required(permission: Permission, program_id_param='program_id'):
    """Decorator to require program-specific permission.

    Args:
        permission: The required permission
        program_id_param: Name of the parameter containing program ID
                         (looks in route params, query params, and JSON body)
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Let JWT errors propagate to the JWT error handlers
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            # Convert string identity back to int for database lookup
            user = User.query.get(int(user_id))

            if not user:
                return jsonify({'error': '用户不存在'}), 401

            if user.status != 'active':
                return jsonify({'error': '账号已被禁用'}), 403

            # Get program_id from various sources
            program_id = kwargs.get(program_id_param)
            if program_id is None:
                program_id = request.args.get(program_id_param)
            if program_id is None and request.is_json:
                program_id = request.json.get(program_id_param)

            if program_id is None:
                return jsonify({'error': '缺少节目ID参数'}), 400

            try:
                program_id = int(program_id)
            except (ValueError, TypeError):
                return jsonify({'error': '无效的节目ID'}), 400

            if not check_program_permission(user, permission, program_id):
                return jsonify({'error': '无权访问该节目'}), 403

            g.current_user = user
            g.program_id = program_id
            return f(*args, **kwargs)

        return decorated_function
    return decorator


def admin_required(f):
    """Shortcut decorator for admin-only routes."""
    return role_required(User.ROLE_ADMIN)(f)


def staff_required(f):
    """Decorator for admin routes that should exclude member-role users.
    Allows admin, committee, and program_manager."""
    return role_required(User.ROLE_ADMIN, User.ROLE_COMMITTEE, User.ROLE_PROGRAM_MANAGER)(f)


def committee_required(f):
    """Shortcut decorator for committee or admin routes."""
    return role_required(User.ROLE_ADMIN, User.ROLE_COMMITTEE)(f)
