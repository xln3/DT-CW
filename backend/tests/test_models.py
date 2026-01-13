"""Tests for database models."""
import pytest
from datetime import date, time

from models import (
    User, Member, Teacher, Program, ProgramMember,
    Semester, Rehearsal, Attendance
)


class TestUserModel:
    """Test User model."""

    def test_create_user(self, db_session):
        """Test creating a user."""
        user = User(
            username='newuser',
            display_name='New User',
            role=User.ROLE_COMMITTEE,
            status='active'
        )
        user.set_password('testpass123')
        db_session.session.add(user)
        db_session.session.commit()

        assert user.id is not None
        assert user.username == 'newuser'
        assert user.check_password('testpass123')
        assert not user.check_password('wrongpass')

    def test_user_roles(self, db_session):
        """Test user role checks."""
        admin = User(username='admin', display_name='Admin', role=User.ROLE_ADMIN)
        committee = User(username='committee', display_name='Committee', role=User.ROLE_COMMITTEE)
        manager = User(username='manager', display_name='Manager', role=User.ROLE_PROGRAM_MANAGER)

        assert admin.is_admin()
        assert not admin.is_committee()
        assert committee.is_committee()
        assert not committee.is_admin()
        assert manager.is_program_manager()

    def test_user_to_dict(self, db_session, admin_user):
        """Test user serialization."""
        data = admin_user.to_dict()
        assert 'id' in data
        assert data['username'] == 'testadmin'
        assert 'password_hash' not in data

        # With email
        admin_user.email = 'test@example.com'
        data = admin_user.to_dict(include_email=True)
        assert data['email'] == 'test@example.com'


class TestMemberModel:
    """Test Member model."""

    def test_create_member(self, db_session):
        """Test creating a member."""
        member = Member(
            name='测试队员',
            student_id='2024002',
            department='艺术学院',
            status='active'
        )
        db_session.session.add(member)
        db_session.session.commit()

        assert member.id is not None
        assert member.name == '测试队员'

    def test_member_to_dict(self, db_session, member):
        """Test member serialization."""
        data = member.to_dict()
        assert data['name'] == '张三'
        assert data['student_id'] == '2024001'


class TestProgramModel:
    """Test Program model."""

    def test_create_program(self, db_session, semester):
        """Test creating a program."""
        program = Program(
            name='新舞蹈节目',
            category='dance',
            semester_id=semester.id,
            status='active'
        )
        db_session.session.add(program)
        db_session.session.commit()

        assert program.id is not None
        assert program.semester_id == semester.id

    def test_program_members(self, db_session, program, member):
        """Test program member association."""
        pm = ProgramMember(
            program_id=program.id,
            member_id=member.id,
            role='lead',
            status='active'
        )
        db_session.session.add(pm)
        db_session.session.commit()

        # Check relationship
        active_members = program.get_active_members()
        assert len(active_members) == 1
        assert active_members[0].id == member.id


class TestRehearsalModel:
    """Test Rehearsal model."""

    def test_create_rehearsal(self, db_session, program, teacher):
        """Test creating a rehearsal."""
        rehearsal = Rehearsal(
            program_id=program.id,
            teacher_id=teacher.id,
            scheduled_date=date(2024, 10, 15),
            scheduled_start_time=time(14, 0),
            scheduled_end_time=time(16, 0),
            location='舞蹈厅A'
        )
        db_session.session.add(rehearsal)
        db_session.session.commit()

        assert rehearsal.id is not None
        assert rehearsal.program.name == '测试舞蹈节目'

    def test_rehearsal_videos(self, db_session, program):
        """Test rehearsal video storage."""
        rehearsal = Rehearsal(
            program_id=program.id,
            scheduled_date=date(2024, 10, 15)
        )
        db_session.session.add(rehearsal)
        db_session.session.commit()

        videos = ['https://example.com/video1.mp4', 'https://example.com/video2.mp4']
        rehearsal.set_videos(videos)
        db_session.session.commit()

        assert rehearsal.get_videos() == videos


class TestAttendanceModel:
    """Test Attendance model."""

    def test_attendance_status_calculation(self, db_session):
        """Test attendance status calculation."""
        # Normal: present both times
        record = Attendance(rehearsal_id=1, member_id=1)
        record.detected_before = True
        record.detected_after = True
        record.calculate_status()
        assert record.status == Attendance.STATUS_NORMAL

        # Late: only after
        record.detected_before = False
        record.detected_after = True
        record.calculate_status()
        assert record.status == Attendance.STATUS_LATE

        # Early leave: only before
        record.detected_before = True
        record.detected_after = False
        record.calculate_status()
        assert record.status == Attendance.STATUS_EARLY_LEAVE

        # Absent: neither
        record.detected_before = False
        record.detected_after = False
        record.calculate_status()
        assert record.status == Attendance.STATUS_ABSENT

        # Leave
        record.has_leave = True
        record.leave_type = Attendance.LEAVE_FULL
        record.calculate_status()
        assert record.status == Attendance.STATUS_LEAVE_ABSENT

    def test_attendance_status_display(self):
        """Test attendance status display names."""
        assert Attendance.get_status_display(Attendance.STATUS_NORMAL) == '正常'
        assert Attendance.get_status_display(Attendance.STATUS_LATE) == '迟到'
        assert Attendance.get_status_display(Attendance.STATUS_ABSENT) == '缺勤'


class TestSemesterModel:
    """Test Semester model."""

    def test_get_current_semester(self, db_session, semester):
        """Test getting current semester."""
        current = Semester.get_current()
        assert current is not None
        assert current.id == semester.id
        assert current.is_current is True

    def test_set_current_semester(self, db_session, semester):
        """Test setting current semester."""
        # Create another semester
        new_sem = Semester(
            name='2024-2025学年第二学期',
            start_date=date(2025, 2, 1),
            end_date=date(2025, 7, 31),
            is_current=False
        )
        db_session.session.add(new_sem)
        db_session.session.commit()

        # Set new semester as current
        Semester.set_current(new_sem.id)

        # Verify
        db_session.session.refresh(semester)
        db_session.session.refresh(new_sem)
        assert semester.is_current is False
        assert new_sem.is_current is True
