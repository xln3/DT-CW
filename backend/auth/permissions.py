"""Permission definitions and checking."""
from enum import Enum
from typing import Optional
from models import User


class Permission(Enum):
    """Permission types for the system."""
    # Member management
    MEMBER_VIEW = 'member:view'
    MEMBER_CREATE = 'member:create'
    MEMBER_EDIT = 'member:edit'
    MEMBER_DELETE = 'member:delete'

    # Teacher management
    TEACHER_VIEW = 'teacher:view'
    TEACHER_CREATE = 'teacher:create'
    TEACHER_EDIT = 'teacher:edit'
    TEACHER_DELETE = 'teacher:delete'
    TEACHER_VIEW_SENSITIVE = 'teacher:view_sensitive'

    # Program management
    PROGRAM_VIEW = 'program:view'
    PROGRAM_CREATE = 'program:create'
    PROGRAM_EDIT = 'program:edit'
    PROGRAM_DELETE = 'program:delete'

    # Rehearsal management
    REHEARSAL_VIEW = 'rehearsal:view'
    REHEARSAL_CREATE = 'rehearsal:create'
    REHEARSAL_EDIT = 'rehearsal:edit'
    REHEARSAL_DELETE = 'rehearsal:delete'

    # Attendance management
    ATTENDANCE_VIEW = 'attendance:view'
    ATTENDANCE_EDIT = 'attendance:edit'

    # Annotation
    ANNOTATION_VIEW = 'annotation:view'
    ANNOTATION_EDIT = 'annotation:edit'

    # User management
    USER_VIEW = 'user:view'
    USER_CREATE = 'user:create'
    USER_EDIT = 'user:edit'
    USER_DELETE = 'user:delete'

    # System
    SYSTEM_CONFIG = 'system:config'


# Permission mapping by role
ROLE_PERMISSIONS = {
    User.ROLE_ADMIN: [
        # Admin has all permissions
        Permission.MEMBER_VIEW, Permission.MEMBER_CREATE, Permission.MEMBER_EDIT, Permission.MEMBER_DELETE,
        Permission.TEACHER_VIEW, Permission.TEACHER_CREATE, Permission.TEACHER_EDIT, Permission.TEACHER_DELETE,
        Permission.TEACHER_VIEW_SENSITIVE,
        Permission.PROGRAM_VIEW, Permission.PROGRAM_CREATE, Permission.PROGRAM_EDIT, Permission.PROGRAM_DELETE,
        Permission.REHEARSAL_VIEW, Permission.REHEARSAL_CREATE, Permission.REHEARSAL_EDIT, Permission.REHEARSAL_DELETE,
        Permission.ATTENDANCE_VIEW, Permission.ATTENDANCE_EDIT,
        Permission.ANNOTATION_VIEW, Permission.ANNOTATION_EDIT,
        Permission.USER_VIEW, Permission.USER_CREATE, Permission.USER_EDIT, Permission.USER_DELETE,
        Permission.SYSTEM_CONFIG,
    ],
    User.ROLE_COMMITTEE: [
        # Committee has most permissions except system config
        Permission.MEMBER_VIEW, Permission.MEMBER_CREATE, Permission.MEMBER_EDIT, Permission.MEMBER_DELETE,
        Permission.TEACHER_VIEW, Permission.TEACHER_CREATE, Permission.TEACHER_EDIT, Permission.TEACHER_DELETE,
        Permission.TEACHER_VIEW_SENSITIVE,
        Permission.PROGRAM_VIEW, Permission.PROGRAM_CREATE, Permission.PROGRAM_EDIT, Permission.PROGRAM_DELETE,
        Permission.REHEARSAL_VIEW, Permission.REHEARSAL_CREATE, Permission.REHEARSAL_EDIT, Permission.REHEARSAL_DELETE,
        Permission.ATTENDANCE_VIEW, Permission.ATTENDANCE_EDIT,
        Permission.ANNOTATION_VIEW, Permission.ANNOTATION_EDIT,
        Permission.USER_VIEW, Permission.USER_CREATE, Permission.USER_EDIT,  # Can't delete users
    ],
    User.ROLE_PROGRAM_MANAGER: [
        # Program manager has limited permissions (own programs only)
        Permission.MEMBER_VIEW,
        Permission.TEACHER_VIEW,
        Permission.PROGRAM_VIEW, Permission.PROGRAM_EDIT,  # Own programs only
        Permission.REHEARSAL_VIEW, Permission.REHEARSAL_CREATE, Permission.REHEARSAL_EDIT,  # Own programs only
        Permission.ATTENDANCE_VIEW, Permission.ATTENDANCE_EDIT,  # Own programs only
        Permission.ANNOTATION_VIEW, Permission.ANNOTATION_EDIT,  # Own programs only
    ],
}


def check_permission(user: Optional[User], permission: Permission) -> bool:
    """Check if user has a specific permission."""
    if not user or user.status != 'active':
        return False

    role_perms = ROLE_PERMISSIONS.get(user.role, [])
    return permission in role_perms


def check_program_permission(user: Optional[User], permission: Permission, program_id: int) -> bool:
    """Check if user has permission for a specific program."""
    if not user or user.status != 'active':
        return False

    # Admin and committee have access to all programs
    if user.is_admin() or user.is_committee():
        return check_permission(user, permission)

    # Program manager can only access their own programs
    if user.is_program_manager():
        if not user.can_manage_program(program_id):
            return False
        return check_permission(user, permission)

    return False


def get_user_permissions(user: Optional[User]) -> list:
    """Get all permissions for a user."""
    if not user or user.status != 'active':
        return []

    return [p.value for p in ROLE_PERMISSIONS.get(user.role, [])]
