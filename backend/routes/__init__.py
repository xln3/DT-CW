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
    from .calendar import calendar_bp
    from .public_calendar import public_calendar_bp
    from .venues import venues_bp, bookings_bp, public_venues_bp
    from .teacher_applications import teacher_applications_bp
    from .teacher_payments import teacher_payments_bp
    from .budget import budget_bp
    from .public_schedule import public_schedule_bp

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
    app.register_blueprint(calendar_bp, url_prefix='/api/admin/calendar')

    # Venue routes
    app.register_blueprint(venues_bp, url_prefix='/api/admin/venues')
    app.register_blueprint(bookings_bp, url_prefix='/api/admin/bookings')

    # Teacher application routes
    app.register_blueprint(teacher_applications_bp, url_prefix='/api/admin/applications')

    # Teacher payment routes
    app.register_blueprint(teacher_payments_bp, url_prefix='/api/admin/payments')

    # Budget routes
    app.register_blueprint(budget_bp, url_prefix='/api/admin/budget')

    # Public routes
    app.register_blueprint(public_attendance_bp, url_prefix='/api/public/attendance')
    app.register_blueprint(public_calendar_bp, url_prefix='/api/public/calendar')
    app.register_blueprint(public_venues_bp, url_prefix='/api/public/venues')
    app.register_blueprint(public_schedule_bp, url_prefix='/api/public/schedule')

    # Face recognition routes
    from face_recognition.api import face_bp
    app.register_blueprint(face_bp)
