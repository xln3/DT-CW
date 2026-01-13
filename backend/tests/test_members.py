"""Tests for member management API."""
import pytest
from tests.conftest import get_auth_header


class TestMemberAPI:
    """Test member management endpoints."""

    def test_list_members_unauthorized(self, client, db_session):
        """Test listing members without auth."""
        response = client.get('/api/admin/members')
        assert response.status_code == 401

    def test_list_members(self, client, db_session, admin_user, member):
        """Test listing members."""
        headers = get_auth_header(client, 'testadmin', 'password123')
        response = client.get('/api/admin/members', headers=headers)
        assert response.status_code == 200
        assert len(response.json['members']) == 1
        assert response.json['members'][0]['name'] == '张三'

    def test_create_member(self, client, db_session, committee_user):
        """Test creating a member."""
        headers = get_auth_header(client, 'testcommittee', 'password123')
        response = client.post('/api/admin/members', headers=headers, json={
            'name': '李四',
            'student_id': '2024003',
            'department': '艺术学院',
            'gender': '男'
        })
        assert response.status_code == 201
        assert response.json['member']['name'] == '李四'

    def test_create_member_empty_name(self, client, db_session, committee_user):
        """Test creating member with empty name."""
        headers = get_auth_header(client, 'testcommittee', 'password123')
        response = client.post('/api/admin/members', headers=headers, json={
            'name': '',
            'student_id': '2024003'
        })
        assert response.status_code == 400

    def test_get_member(self, client, db_session, admin_user, member):
        """Test getting a single member."""
        headers = get_auth_header(client, 'testadmin', 'password123')
        response = client.get(f'/api/admin/members/{member.id}', headers=headers)
        assert response.status_code == 200
        assert response.json['member']['name'] == '张三'

    def test_update_member(self, client, db_session, committee_user, member):
        """Test updating a member."""
        headers = get_auth_header(client, 'testcommittee', 'password123')
        response = client.put(f'/api/admin/members/{member.id}', headers=headers, json={
            'name': '张三改名',
            'department': '新院系'
        })
        assert response.status_code == 200
        assert response.json['member']['name'] == '张三改名'
        assert response.json['member']['department'] == '新院系'

    def test_delete_member(self, client, db_session, committee_user, member):
        """Test deleting a member."""
        headers = get_auth_header(client, 'testcommittee', 'password123')
        member_id = member.id
        response = client.delete(f'/api/admin/members/{member_id}', headers=headers)
        assert response.status_code == 200

        # Verify deleted by listing
        response = client.get('/api/admin/members', headers=headers)
        assert response.status_code == 200
        member_ids = [m['id'] for m in response.json['members']]
        assert member_id not in member_ids

    def test_batch_create_members(self, client, db_session, committee_user):
        """Test batch creating members."""
        headers = get_auth_header(client, 'testcommittee', 'password123')
        response = client.post('/api/admin/members/batch', headers=headers, json={
            'members': [
                {'name': '队员1', 'student_id': '001'},
                {'name': '队员2', 'student_id': '002'},
                {'name': '队员3', 'student_id': '003'}
            ]
        })
        assert response.status_code == 200
        assert response.json['created_count'] == 3

    def test_search_members(self, client, db_session, admin_user, member):
        """Test searching members."""
        headers = get_auth_header(client, 'testadmin', 'password123')
        response = client.get('/api/admin/members?search=张', headers=headers)
        assert response.status_code == 200
        assert len(response.json['members']) == 1

        response = client.get('/api/admin/members?search=notfound', headers=headers)
        assert response.status_code == 200
        assert len(response.json['members']) == 0

    def test_program_manager_can_view_members(self, client, db_session, program_manager, member):
        """Test that program manager can view members."""
        headers = get_auth_header(client, 'testmanager', 'password123')
        response = client.get('/api/admin/members', headers=headers)
        assert response.status_code == 200

    def test_program_manager_cannot_create_members(self, client, db_session, program_manager):
        """Test that program manager cannot create members."""
        headers = get_auth_header(client, 'testmanager', 'password123')
        response = client.post('/api/admin/members', headers=headers, json={
            'name': '新队员'
        })
        assert response.status_code == 403
