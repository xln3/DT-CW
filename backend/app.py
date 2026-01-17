"""Main Flask application."""
import os
from flask import Flask, jsonify
from flask_cors import CORS

from config import config
from database import db, init_db
from auth import init_jwt


def create_app(config_name=None):
    """Application factory."""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(app)
    CORS(app, supports_credentials=True)
    init_jwt(app)

    # Create database tables
    with app.app_context():
        from models import (
            User, Semester, SystemConfig, AuditLog,
            Member, Teacher, Program, ProgramMember,
            Rehearsal, Attendance, FaceVector, FaceAnnotation,
            EventType, CalendarEvent
        )
        db.create_all()

        # Initialize default system config
        SystemConfig.init_defaults()

        # Initialize default event types
        EventType.init_default_types()

        # Create default admin user if not exists
        if not User.query.filter_by(username='admin').first():
            admin = User(
                username='admin',
                display_name='系统管理员',
                role=User.ROLE_ADMIN,
                status='active'
            )
            admin.set_password('admin123')  # Change in production!
            db.session.add(admin)
            db.session.commit()

    # Register blueprints
    from routes import register_blueprints
    register_blueprints(app)

    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        return jsonify({'status': 'ok', 'message': '艺术团管理系统运行中'})

    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': '资源不存在'}), 404

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify({'error': '服务器内部错误'}), 500

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)
