"""Member model."""
from datetime import datetime, date
from database import db


class Member(db.Model):
    """Team member model."""
    __tablename__ = 'members'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    student_id = db.Column(db.String(50))  # Student ID (optional)
    phone = db.Column(db.String(20))
    gender = db.Column(db.String(10))
    department = db.Column(db.String(100))  # Department/Faculty
    grade = db.Column(db.String(20))  # Grade/Year
    status = db.Column(db.String(20), default='active')  # active/inactive
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Extended fields (Phase 1)
    class_name = db.Column(db.String(50))  # 班级
    email = db.Column(db.String(100))  # 邮箱
    dormitory = db.Column(db.String(100))  # 宿舍
    birth_date = db.Column(db.Date)  # 出生日期
    ethnicity = db.Column(db.String(50))  # 民族
    hometown = db.Column(db.String(100))  # 籍贯
    political_status = db.Column(db.String(50))  # 政治面貌
    party_branch = db.Column(db.String(100))  # 党团关系所在
    is_talented = db.Column(db.Boolean, default=False)  # 是否为特长生
    is_concentrated_class = db.Column(db.Boolean, default=False)  # 是否为集中班
    team_role = db.Column(db.String(50))  # 队内职务
    join_year = db.Column(db.Integer)  # 入队年份
    team_level = db.Column(db.String(50))  # 所在梯队
    graduating_this_semester = db.Column(db.Boolean, default=False)  # 本学期毕业

    # Relationships
    program_memberships = db.relationship('ProgramMember', back_populates='member', lazy='dynamic')
    face_vectors = db.relationship('FaceVector', back_populates='member', lazy='dynamic')
    attendance_records = db.relationship('Attendance', back_populates='member', lazy='dynamic')

    STATUS_ACTIVE = 'active'
    STATUS_INACTIVE = 'inactive'

    def to_dict(self, include_programs=False):
        """Convert to dictionary."""
        data = {
            'id': self.id,
            'name': self.name,
            'student_id': self.student_id,
            'phone': self.phone,
            'gender': self.gender,
            'department': self.department,
            'grade': self.grade,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            # Extended fields
            'class_name': self.class_name,
            'email': self.email,
            'dormitory': self.dormitory,
            'birth_date': self.birth_date.isoformat() if self.birth_date else None,
            'ethnicity': self.ethnicity,
            'hometown': self.hometown,
            'political_status': self.political_status,
            'party_branch': self.party_branch,
            'is_talented': self.is_talented,
            'is_concentrated_class': self.is_concentrated_class,
            'team_role': self.team_role,
            'join_year': self.join_year,
            'team_level': self.team_level,
            'graduating_this_semester': self.graduating_this_semester,
        }
        if include_programs:
            data['programs'] = [
                pm.program.to_dict() for pm in self.program_memberships.filter_by(status='active')
            ]
        return data

    def get_active_programs(self):
        """Get all active programs this member belongs to."""
        return [pm.program for pm in self.program_memberships.filter_by(status='active')]
