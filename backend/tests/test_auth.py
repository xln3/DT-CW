"""Tests for authentication."""
import pytest
from tests.conftest import get_auth_header


class TestAuth:
    """Test authentication endpoints."""

    def test_login_success(self, client, db_session, admin_user):
        """Test successful login."""
        response = client.post('/api/auth/login', json={
            'username': 'testadmin',
            'password': 'password123'
        })
        assert response.status_code == 200
        data = response.json
        assert 'access_token' in data
        assert 'refresh_token' in data
        assert data['user']['username'] == 'testadmin'
        assert data['user']['role'] == 'admin'

    def test_login_wrong_password(self, client, db_session, admin_user):
        """Test login with wrong password."""
        response = client.post('/api/auth/login', json={
            'username': 'testadmin',
            'password': 'wrongpassword'
        })
        assert response.status_code == 401
        assert 'error' in response.json

    def test_login_nonexistent_user(self, client, db_session):
        """Test login with nonexistent user."""
        response = client.post('/api/auth/login', json={
            'username': 'nonexistent',
            'password': 'password123'
        })
        assert response.status_code == 401

    def test_login_inactive_user(self, client, db_session, admin_user):
        """Test login with inactive user."""
        admin_user.status = 'inactive'
        db_session.session.commit()

        response = client.post('/api/auth/login', json={
            'username': 'testadmin',
            'password': 'password123'
        })
        assert response.status_code == 403

    def test_get_current_user(self, client, db_session, admin_user):
        """Test getting current user info."""
        headers = get_auth_header(client, 'testadmin', 'password123')
        response = client.get('/api/auth/me', headers=headers)
        assert response.status_code == 200
        assert response.json['user']['username'] == 'testadmin'

    def test_get_current_user_unauthorized(self, client, db_session):
        """Test getting current user without auth."""
        response = client.get('/api/auth/me')
        assert response.status_code == 401

    def test_change_password(self, client, db_session, admin_user):
        """Test changing password."""
        headers = get_auth_header(client, 'testadmin', 'password123')
        response = client.post('/api/auth/change-password', headers=headers, json={
            'current_password': 'password123',
            'new_password': 'newpassword123'
        })
        assert response.status_code == 200

        # Verify new password works
        response = client.post('/api/auth/login', json={
            'username': 'testadmin',
            'password': 'newpassword123'
        })
        assert response.status_code == 200

    def test_change_password_wrong_current(self, client, db_session, admin_user):
        """Test changing password with wrong current password."""
        headers = get_auth_header(client, 'testadmin', 'password123')
        response = client.post('/api/auth/change-password', headers=headers, json={
            'current_password': 'wrongpassword',
            'new_password': 'newpassword123'
        })
        assert response.status_code == 400

    def test_refresh_token(self, client, db_session, admin_user):
        """Test refreshing access token."""
        # First login
        response = client.post('/api/auth/login', json={
            'username': 'testadmin',
            'password': 'password123'
        })
        refresh_token = response.json['refresh_token']

        # Refresh
        response = client.post('/api/auth/refresh', headers={
            'Authorization': f'Bearer {refresh_token}'
        })
        assert response.status_code == 200
        assert 'access_token' in response.json
