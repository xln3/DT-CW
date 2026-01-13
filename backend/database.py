"""Database initialization and utilities."""
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def init_db(app):
    """Initialize database with the Flask app."""
    db.init_app(app)

    with app.app_context():
        # Import all models to ensure they are registered
        from models import (
            user, semester, system_config, audit_log,
            member, teacher, program, rehearsal, attendance,
            face_vector, face_annotation
        )
        db.create_all()


def reset_db(app):
    """Reset database (for testing)."""
    with app.app_context():
        db.drop_all()
        db.create_all()
