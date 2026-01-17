"""Semester management routes."""
from flask import Blueprint, request, jsonify
from datetime import datetime

from database import db
from models import Semester
from auth.decorators import login_required, role_required

semesters_bp = Blueprint('semesters', __name__)


@semesters_bp.route('', methods=['GET'])
@login_required
def list_semesters():
    """List all semesters."""
    semesters = Semester.query.order_by(Semester.start_date.desc()).all()
    return jsonify({
        'semesters': [s.to_dict() for s in semesters]
    })


@semesters_bp.route('', methods=['POST'])
@login_required
@role_required('admin')
def create_semester():
    """Create a new semester."""
    data = request.get_json()

    if not data.get('name'):
        return jsonify({'error': '学期名称不能为空'}), 400

    # Parse dates
    start_date = None
    end_date = None
    if data.get('start_date'):
        try:
            start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '开始日期格式错误'}), 400

    if data.get('end_date'):
        try:
            end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '结束日期格式错误'}), 400

    # Validate semester_type
    semester_type = data.get('semester_type', 'fall')
    valid_types = ['summer_training', 'fall', 'winter_training', 'spring']
    if semester_type not in valid_types:
        return jsonify({'error': '无效的学期类型'}), 400

    semester = Semester(
        name=data['name'],
        semester_type=semester_type,
        start_date=start_date,
        end_date=end_date,
        is_current=data.get('is_current', False)
    )

    # If this is set as current, unset others
    if semester.is_current:
        Semester.query.update({'is_current': False})

    db.session.add(semester)
    db.session.commit()

    return jsonify({'semester': semester.to_dict()}), 201


@semesters_bp.route('/<int:semester_id>', methods=['GET'])
@login_required
def get_semester(semester_id):
    """Get a single semester."""
    semester = Semester.query.get_or_404(semester_id)
    return jsonify({'semester': semester.to_dict()})


@semesters_bp.route('/<int:semester_id>', methods=['PUT'])
@login_required
@role_required('admin')
def update_semester(semester_id):
    """Update a semester."""
    semester = Semester.query.get_or_404(semester_id)
    data = request.get_json()

    if 'name' in data:
        semester.name = data['name']

    if 'semester_type' in data:
        valid_types = ['summer_training', 'fall', 'winter_training', 'spring']
        if data['semester_type'] not in valid_types:
            return jsonify({'error': '无效的学期类型'}), 400
        semester.semester_type = data['semester_type']

    if 'start_date' in data:
        if data['start_date']:
            try:
                semester.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': '开始日期格式错误'}), 400
        else:
            semester.start_date = None

    if 'end_date' in data:
        if data['end_date']:
            try:
                semester.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': '结束日期格式错误'}), 400
        else:
            semester.end_date = None

    if 'is_current' in data:
        if data['is_current'] and not semester.is_current:
            # Unset other current semesters
            Semester.query.filter(Semester.id != semester.id).update({'is_current': False})
        semester.is_current = data['is_current']

    db.session.commit()
    return jsonify({'semester': semester.to_dict()})


@semesters_bp.route('/<int:semester_id>', methods=['DELETE'])
@login_required
@role_required('admin')
def delete_semester(semester_id):
    """Delete a semester."""
    semester = Semester.query.get_or_404(semester_id)

    # Check if semester has programs
    if semester.programs.count() > 0:
        return jsonify({'error': '该学期下有节目，无法删除'}), 400

    db.session.delete(semester)
    db.session.commit()

    return jsonify({'message': '删除成功'})


@semesters_bp.route('/<int:semester_id>/set-current', methods=['POST'])
@login_required
@role_required('admin')
def set_current_semester(semester_id):
    """Set a semester as current."""
    semester = Semester.query.get_or_404(semester_id)

    # Unset all current semesters
    Semester.query.update({'is_current': False})

    # Set this one as current
    semester.is_current = True
    db.session.commit()

    return jsonify({'semester': semester.to_dict()})


@semesters_bp.route('/current', methods=['GET'])
def get_current_semester():
    """Get the current semester (public endpoint)."""
    semester = Semester.get_current()
    if not semester:
        return jsonify({'semester': None})
    return jsonify({'semester': semester.to_dict()})
