"""Routes package."""
from flask import Flask


def register_blueprints(app: Flask):
    """Register all blueprints with the Flask app."""
    from .auth import auth_bp
    from .users import users_bp
    from .members import members_bp
    from .teachers import teachers_bp
    from .programs import programs_bp
    from .rehearsals import rehearsals_bp
    from .public_attendance import public_attendance_bp
    from .dashboard import dashboard_bp
    from .semesters import semesters_bp

    # Auth routes
    app.register_blueprint(auth_bp, url_prefix='/api/auth')

    # Admin routes
    app.register_blueprint(users_bp, url_prefix='/api/admin/users')
    app.register_blueprint(members_bp, url_prefix='/api/admin/members')
    app.register_blueprint(teachers_bp, url_prefix='/api/admin/teachers')
    app.register_blueprint(programs_bp, url_prefix='/api/admin/programs')
    app.register_blueprint(rehearsals_bp, url_prefix='/api/admin/rehearsals')
    app.register_blueprint(dashboard_bp, url_prefix='/api/admin/dashboard')
    app.register_blueprint(semesters_bp, url_prefix='/api/admin/semesters')

    # Public routes
    app.register_blueprint(public_attendance_bp, url_prefix='/api/public/attendance')
