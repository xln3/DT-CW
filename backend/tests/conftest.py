"""Pytest configuration and fixtures."""
import pytest
from datetime import date

from app import create_app
from database import db
from models import User, Member, Teacher, Program, Semester


@pytest.fixture
def app():
    """Create application for testing."""
    app = create_app('testing')
    yield app


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def db_session(app):
    """Create database session for testing."""
    with app.app_context():
        db.create_all()
        yield db
        db.drop_all()


@pytest.fixture
def admin_user(db_session):
    """Create admin user for testing."""
    user = User(
        username='testadmin',
        display_name='Test Admin',
        role=User.ROLE_ADMIN,
        status='active'
    )
    user.set_password('password123')
    db_session.session.add(user)
    db_session.session.commit()
    return user


@pytest.fixture
def committee_user(db_session):
    """Create committee user for testing."""
    user = User(
        username='testcommittee',
        display_name='Test Committee',
        role=User.ROLE_COMMITTEE,
        status='active'
    )
    user.set_password('password123')
    db_session.session.add(user)
    db_session.session.commit()
    return user


@pytest.fixture
def program_manager(db_session):
    """Create program manager user for testing."""
    user = User(
        username='testmanager',
        display_name='Test Manager',
        role=User.ROLE_PROGRAM_MANAGER,
        status='active'
    )
    user.set_password('password123')
    db_session.session.add(user)
    db_session.session.commit()
    return user


@pytest.fixture
def semester(db_session):
    """Create test semester."""
    sem = Semester(
        name='2024-2025学年第一学期',
        start_date=date(2024, 9, 1),
        end_date=date(2025, 1, 31),
        is_current=True
    )
    db_session.session.add(sem)
    db_session.session.commit()
    return sem


@pytest.fixture
def member(db_session):
    """Create test member."""
    m = Member(
        name='张三',
        student_id='2024001',
        department='计算机学院',
        status='active'
    )
    db_session.session.add(m)
    db_session.session.commit()
    return m


@pytest.fixture
def teacher(db_session):
    """Create test teacher."""
    t = Teacher(
        name='李老师',
        specialty='舞蹈',
        status='active'
    )
    db_session.session.add(t)
    db_session.session.commit()
    return t


@pytest.fixture
def program(db_session, semester):
    """Create test program."""
    p = Program(
        name='测试舞蹈节目',
        category='dance',
        semester_id=semester.id,
        status='active'
    )
    db_session.session.add(p)
    db_session.session.commit()
    return p


def get_auth_header(client, username, password):
    """Helper to get authentication header."""
    response = client.post('/api/auth/login', json={
        'username': username,
        'password': password
    })
    if response.status_code == 200:
        token = response.json['access_token']
        return {'Authorization': f'Bearer {token}'}
    return {}
