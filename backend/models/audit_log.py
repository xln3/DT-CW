"""Audit log model for tracking operations."""
from datetime import datetime
from database import db
import json


class AuditLog(db.Model):
    """Audit log for tracking user operations."""
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer)
    username = db.Column(db.String(50))
    action = db.Column(db.String(50), nullable=False)  # create/update/delete/login/logout
    module = db.Column(db.String(50))  # attendance/venue/budget/etc.
    resource_type = db.Column(db.String(50))  # member/program/rehearsal/etc.
    resource_id = db.Column(db.Integer)
    details = db.Column(db.Text)  # JSON: change details
    ip_address = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Action constants
    ACTION_CREATE = 'create'
    ACTION_UPDATE = 'update'
    ACTION_DELETE = 'delete'
    ACTION_LOGIN = 'login'
    ACTION_LOGOUT = 'logout'

    @classmethod
    def log(cls, action: str, user=None, module: str = None,
            resource_type: str = None, resource_id: int = None,
            details: dict = None, ip_address: str = None):
        """Create an audit log entry."""
        log_entry = cls(
            user_id=user.id if user else None,
            username=user.username if user else None,
            action=action,
            module=module,
            resource_type=resource_type,
            resource_id=resource_id,
            details=json.dumps(details, ensure_ascii=False) if details else None,
            ip_address=ip_address
        )
        db.session.add(log_entry)
        db.session.commit()
        return log_entry

    def get_details(self) -> dict:
        """Parse details JSON."""
        if self.details:
            return json.loads(self.details)
        return {}

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.username,
            'action': self.action,
            'module': self.module,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'details': self.get_details(),
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
