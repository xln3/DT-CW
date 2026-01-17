"""JWT token handling."""
from flask import jsonify
from flask_jwt_extended import JWTManager, get_jwt_identity, verify_jwt_in_request
from functools import wraps

jwt = JWTManager()


def init_jwt(app):
    """Initialize JWT with the Flask app."""
    jwt.init_app(app)

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            'error': 'token_expired'
        }), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({
            'error': '无效的认证令牌'
        }), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({
            'error': 'authorization_required'
        }), 401

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return jsonify({
            'error': '令牌已被撤销'
        }), 401


def get_current_user():
    """Get current logged-in user from JWT token."""
    from models import User

    try:
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        if user_id:
            return User.query.get(int(user_id))
    except Exception:
        pass
    return None


def get_current_user_optional():
    """Get current user if logged in, None otherwise (no error)."""
    from models import User

    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
        if user_id:
            return User.query.get(int(user_id))
    except Exception:
        pass
    return None
