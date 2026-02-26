"""User and UserProgram models."""
from datetime import datetime
from database import db
import bcrypt


class User(db.Model):
    """User model for authentication and authorization."""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    display_name = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    role = db.Column(db.String(20), nullable=False)  # admin/committee/program_manager
    status = db.Column(db.String(20), default='active')  # active/inactive
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'))  # Link to member
    last_login_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    managed_programs = db.relationship(
        'UserProgram',
        foreign_keys='UserProgram.user_id',
        back_populates='user',
        lazy='dynamic'
    )
    member = db.relationship('Member', backref='user_account', foreign_keys=[member_id])

    ROLE_ADMIN = 'admin'
    ROLE_COMMITTEE = 'committee'
    ROLE_PROGRAM_MANAGER = 'program_manager'
    ROLE_MEMBER = 'member'

    VALID_ROLES = [ROLE_ADMIN, ROLE_COMMITTEE, ROLE_PROGRAM_MANAGER, ROLE_MEMBER]

    def set_password(self, password: str):
        """Hash and set password."""
        self.password_hash = bcrypt.hashpw(
            password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')

    def check_password(self, password: str) -> bool:
        """Check password against hash."""
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8')
        )

    def is_admin(self) -> bool:
        """Check if user is system admin."""
        return self.role == self.ROLE_ADMIN

    def is_committee(self) -> bool:
        """Check if user is committee member."""
        return self.role == self.ROLE_COMMITTEE

    def is_program_manager(self) -> bool:
        """Check if user is program manager."""
        return self.role == self.ROLE_PROGRAM_MANAGER

    def is_member(self) -> bool:
        """Check if user is regular member."""
        return self.role == self.ROLE_MEMBER

    def can_manage_program(self, program_id: int) -> bool:
        """Check if user can manage a specific program."""
        if self.is_admin() or self.is_committee():
            return True
        if self.is_program_manager():
            return self.managed_programs.filter_by(program_id=program_id).first() is not None
        return False

    def to_dict(self, include_email=False):
        """Convert to dictionary."""
        data = {
            'id': self.id,
            'username': self.username,
            'display_name': self.display_name,
            'role': self.role,
            'status': self.status,
            'member_id': self.member_id,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_email:
            data['email'] = self.email
            data['phone'] = self.phone
        if self.role == self.ROLE_PROGRAM_MANAGER:
            data['managed_program_ids'] = [
                mp.program_id for mp in self.managed_programs
            ]
        return data


class UserProgram(db.Model):
    """Association between users and programs they manage."""
    __tablename__ = 'user_programs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    program_id = db.Column(db.Integer, db.ForeignKey('programs.id'), nullable=False)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    assigned_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    # Relationships
    user = db.relationship('User', foreign_keys=[user_id], back_populates='managed_programs')

    __table_args__ = (
        db.UniqueConstraint('user_id', 'program_id', name='unique_user_program'),
    )
