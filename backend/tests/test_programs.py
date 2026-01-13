"""Tests for program management API."""
import pytest
from models import UserProgram
from tests.conftest import get_auth_header


class TestProgramAPI:
    """Test program management endpoints."""

    def test_list_programs(self, client, db_session, admin_user, program):
        """Test listing programs."""
        headers = get_auth_header(client, 'testadmin', 'password123')
        response = client.get('/api/admin/programs', headers=headers)
        assert response.status_code == 200
        assert len(response.json['programs']) == 1
        assert response.json['programs'][0]['name'] == '测试舞蹈节目'

    def test_create_program(self, client, db_session, committee_user, semester):
        """Test creating a program."""
        headers = get_auth_header(client, 'testcommittee', 'password123')
        response = client.post('/api/admin/programs', headers=headers, json={
            'name': '新节目',
            'category': 'choir',
            'description': '测试描述'
        })
        assert response.status_code == 201
        assert response.json['program']['name'] == '新节目'
        assert response.json['program']['category'] == 'choir'

    def test_get_program(self, client, db_session, admin_user, program):
        """Test getting a single program."""
        headers = get_auth_header(client, 'testadmin', 'password123')
        response = client.get(f'/api/admin/programs/{program.id}', headers=headers)
        assert response.status_code == 200
        assert response.json['program']['name'] == '测试舞蹈节目'

    def test_update_program(self, client, db_session, committee_user, program):
        """Test updating a program."""
        headers = get_auth_header(client, 'testcommittee', 'password123')
        response = client.put(f'/api/admin/programs/{program.id}', headers=headers, json={
            'name': '更新后的节目名',
            'description': '新描述'
        })
        assert response.status_code == 200
        assert response.json['program']['name'] == '更新后的节目名'

    def test_delete_program(self, client, db_session, committee_user, program):
        """Test deleting a program."""
        headers = get_auth_header(client, 'testcommittee', 'password123')
        response = client.delete(f'/api/admin/programs/{program.id}', headers=headers)
        assert response.status_code == 200

    def test_add_member_to_program(self, client, db_session, committee_user, program, member):
        """Test adding a member to a program."""
        headers = get_auth_header(client, 'testcommittee', 'password123')
        response = client.post(
            f'/api/admin/programs/{program.id}/members',
            headers=headers,
            json={'member_id': member.id, 'role': 'lead'}
        )
        assert response.status_code == 200

        # Verify member was added
        response = client.get(f'/api/admin/programs/{program.id}/members', headers=headers)
        assert response.status_code == 200
        assert len(response.json['members']) == 1

    def test_batch_add_members(self, client, db_session, committee_user, program, member):
        """Test batch adding members to a program."""
        from models import Member
        # Create more members
        m2 = Member(name='队员2', status='active')
        m3 = Member(name='队员3', status='active')
        db_session.session.add_all([m2, m3])
        db_session.session.commit()

        headers = get_auth_header(client, 'testcommittee', 'password123')
        response = client.post(
            f'/api/admin/programs/{program.id}/members/batch',
            headers=headers,
            json={'member_ids': [member.id, m2.id, m3.id], 'role': 'ensemble'}
        )
        assert response.status_code == 200
        assert '3' in response.json['message']

    def test_remove_member_from_program(self, client, db_session, committee_user, program, member):
        """Test removing a member from a program."""
        headers = get_auth_header(client, 'testcommittee', 'password123')

        # First add the member
        client.post(
            f'/api/admin/programs/{program.id}/members',
            headers=headers,
            json={'member_id': member.id}
        )

        # Then remove
        response = client.delete(
            f'/api/admin/programs/{program.id}/members/{member.id}',
            headers=headers
        )
        assert response.status_code == 200

    def test_program_manager_access(self, client, db_session, program_manager, program):
        """Test that program manager can only access assigned programs."""
        headers = get_auth_header(client, 'testmanager', 'password123')

        # Should not see any programs initially
        response = client.get('/api/admin/programs', headers=headers)
        assert response.status_code == 200
        assert len(response.json['programs']) == 0

        # Assign program to manager
        up = UserProgram(user_id=program_manager.id, program_id=program.id)
        db_session.session.add(up)
        db_session.session.commit()

        # Now should see the program
        response = client.get('/api/admin/programs', headers=headers)
        assert response.status_code == 200
        assert len(response.json['programs']) == 1

    def test_program_manager_cannot_create(self, client, db_session, program_manager, semester):
        """Test that program manager cannot create programs."""
        headers = get_auth_header(client, 'testmanager', 'password123')
        response = client.post('/api/admin/programs', headers=headers, json={
            'name': '新节目'
        })
        assert response.status_code == 403

    def test_program_manager_can_edit_own_program(self, client, db_session, program_manager, program):
        """Test that program manager can edit their assigned program."""
        # Assign program
        up = UserProgram(user_id=program_manager.id, program_id=program.id)
        db_session.session.add(up)
        db_session.session.commit()

        headers = get_auth_header(client, 'testmanager', 'password123')
        response = client.put(f'/api/admin/programs/{program.id}', headers=headers, json={
            'description': '新描述'
        })
        assert response.status_code == 200
