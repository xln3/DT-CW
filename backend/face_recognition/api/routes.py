"""
Face recognition API routes.

Organized into:
- Member routes: Upload photos, select from group photos, view status
- Admin routes: Recognize group photos, annotate, view stats
- Calibration routes: Get tasks, complete challenges
"""

from flask import Blueprint, request, jsonify, current_app, g
from werkzeug.utils import secure_filename
import os

from database import db
from auth import login_required, role_required
from auth.jwt_handler import get_current_user

face_bp = Blueprint('face', __name__, url_prefix='/api/face')


# ============================================
# Helper Functions
# ============================================

def save_uploaded_file(file, subdir='photos'):
    """Save uploaded file and return URL."""
    if not file:
        return None
    
    filename = secure_filename(file.filename)
    upload_dir = os.path.join(
        current_app.config.get('UPLOAD_FOLDER', 'uploads'),
        subdir
    )
    os.makedirs(upload_dir, exist_ok=True)
    
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)
    
    return f'/uploads/{subdir}/{filename}'


def get_current_member_id():
    """Get current user's member_id."""
    user = g.get('current_user')
    if user and hasattr(user, 'member_id'):
        return user.member_id
    return None


# ============================================
# Member Routes - Registration
# ============================================

@face_bp.route('/upload', methods=['POST'])
@login_required
def upload_photo():
    """
    Upload a personal photo for face registration.
    
    Request:
        - photo: File (multipart/form-data)
        
    Response:
        - success, registration status, distinguishability info
    """
    from face_recognition.services import RegistrationService
    
    member_id = get_current_member_id()
    if not member_id:
        return jsonify({'error': '您不是团队成员'}), 403
    
    if 'photo' not in request.files:
        return jsonify({'error': '请上传照片'}), 400
    
    photo = request.files['photo']
    if photo.filename == '':
        return jsonify({'error': '请选择照片'}), 400
    
    # Read photo data
    photo_data = photo.read()
    photo.seek(0)
    
    # Save file
    photo_url = save_uploaded_file(photo, f'faces/{member_id}')
    
    if not photo_url:
        return jsonify({'error': '保存照片失败'}), 500
    
    # Process with registration service
    service = RegistrationService()
    result = service.upload_photo(
        member_id=member_id,
        photo_data=photo_data,
        photo_url=photo_url
    )
    
    if not result.get('success'):
        return jsonify(result), 400
    
    return jsonify(result)


@face_bp.route('/my-status', methods=['GET'])
@login_required
def get_my_status():
    """Get current user's face registration status."""
    from face_recognition.services import RegistrationService
    
    member_id = get_current_member_id()
    if not member_id:
        return jsonify({'error': '您不是团队成员'}), 403
    
    service = RegistrationService()
    result = service.get_member_status(member_id)
    
    return jsonify(result)


@face_bp.route('/my-photos', methods=['GET'])
@login_required
def get_my_photos():
    """Get current user's uploaded photos."""
    from face_recognition.services import RegistrationService
    
    member_id = get_current_member_id()
    if not member_id:
        return jsonify({'error': '您不是团队成员'}), 403
    
    service = RegistrationService()
    photos = service.get_member_photos(member_id)
    
    return jsonify({'photos': photos})


@face_bp.route('/photos/<int:photo_id>', methods=['DELETE'])
@login_required
def delete_photo(photo_id):
    """Delete one of user's photos."""
    from face_recognition.services import RegistrationService
    
    member_id = get_current_member_id()
    if not member_id:
        return jsonify({'error': '您不是团队成员'}), 403
    
    service = RegistrationService()
    result = service.delete_photo(member_id, photo_id)
    
    if not result.get('success'):
        return jsonify(result), 400
    
    return jsonify(result)


# ============================================
# Member Routes - Group Photo Selection
# ============================================

@face_bp.route('/selectable-photos', methods=['GET'])
@login_required
def get_selectable_photos():
    """Get group photos available for face selection."""
    from face_recognition.services import GroupSelectionService
    
    member_id = get_current_member_id()
    if not member_id:
        return jsonify({'error': '您不是团队成员'}), 403
    
    service = GroupSelectionService()
    photos = service.get_selectable_photos(member_id)
    
    return jsonify({'photos': photos})


@face_bp.route('/photo-faces/<int:recognition_id>', methods=['GET'])
@login_required
def get_photo_faces(recognition_id):
    """Get faces in a group photo for selection."""
    from face_recognition.services import GroupSelectionService
    
    member_id = get_current_member_id()
    if not member_id:
        return jsonify({'error': '您不是团队成员'}), 403
    
    service = GroupSelectionService()
    result = service.get_photo_faces(recognition_id, member_id)
    
    if 'error' in result:
        return jsonify(result), 404
    
    return jsonify(result)


@face_bp.route('/select-myself', methods=['POST'])
@login_required
def select_myself():
    """Select a face as myself in a group photo."""
    from face_recognition.services import GroupSelectionService
    
    member_id = get_current_member_id()
    if not member_id:
        return jsonify({'error': '您不是团队成员'}), 403
    
    data = request.get_json()
    face_id = data.get('face_id')
    
    if not face_id:
        return jsonify({'error': '请指定人脸ID'}), 400
    
    service = GroupSelectionService()
    result = service.select_myself(face_id, member_id)
    
    if not result.get('success'):
        return jsonify(result), 400
    
    return jsonify(result)


# ============================================
# Admin Routes - Recognition
# ============================================

@face_bp.route('/recognize', methods=['POST'])
@role_required('admin', 'committee', 'manager')
def recognize_group_photo():
    """
    Recognize faces in a group photo.
    
    Request:
        - photo: File
        - rehearsal_id: int
        - photo_type: 'check_in' or 'check_out'
        - program_id: int
    """
    from face_recognition.services import RecognitionService
    
    if 'photo' not in request.files:
        return jsonify({'error': '请上传照片'}), 400
    
    photo = request.files['photo']
    rehearsal_id = request.form.get('rehearsal_id', type=int)
    photo_type = request.form.get('photo_type')
    program_id = request.form.get('program_id', type=int)
    
    if not rehearsal_id:
        return jsonify({'error': '请指定排练ID'}), 400
    if photo_type not in ['check_in', 'check_out']:
        return jsonify({'error': '照片类型必须是 check_in 或 check_out'}), 400
    if not program_id:
        return jsonify({'error': '请指定节目ID'}), 400
    
    # Read and save photo
    photo_data = photo.read()
    photo.seek(0)
    photo_url = save_uploaded_file(photo, f'rehearsals/{rehearsal_id}')
    
    service = RecognitionService()
    
    try:
        result = service.recognize_group_photo(
            photo_data=photo_data,
            rehearsal_id=rehearsal_id,
            photo_type=photo_type,
            program_id=program_id,
            photo_url=photo_url
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@face_bp.route('/annotate', methods=['POST'])
@role_required('admin', 'committee', 'manager')
def annotate_face():
    """Manually annotate or correct a detected face."""
    from face_recognition.services import RecognitionService
    
    user = g.current_user
    data = request.get_json()
    
    detected_face_id = data.get('detected_face_id')
    member_id = data.get('member_id')  # Can be None
    feedback_type = data.get('feedback_type', 'correct')
    
    if not detected_face_id:
        return jsonify({'error': '请指定人脸ID'}), 400
    
    service = RecognitionService()
    result = service.annotate_face(
        detected_face_id=detected_face_id,
        member_id=member_id,
        annotated_by=user.id,
        feedback_type=feedback_type
    )
    
    if not result.get('success'):
        return jsonify(result), 400
    
    return jsonify(result)


@face_bp.route('/recognition/<int:recognition_id>', methods=['GET'])
@role_required('admin', 'committee', 'manager')
def get_recognition_result(recognition_id):
    """Get recognition result details."""
    from face_recognition.services import RecognitionService
    
    service = RecognitionService()
    result = service.get_recognition_result(recognition_id)
    
    if 'error' in result:
        return jsonify(result), 404
    
    return jsonify(result)


# ============================================
# Admin Routes - Member Status
# ============================================

@face_bp.route('/members-status', methods=['GET'])
@role_required('admin', 'committee', 'manager')
def get_members_status():
    """Get face registration status for all or filtered members."""
    from models.face_models import MemberFace
    from models import Member, ProgramMember
    
    program_id = request.args.get('program_id', type=int)
    status_filter = request.args.get('status')
    
    query = db.session.query(Member, MemberFace).outerjoin(
        MemberFace, Member.id == MemberFace.member_id
    ).filter(Member.status == 'active')
    
    if program_id:
        query = query.join(
            ProgramMember, Member.id == ProgramMember.member_id
        ).filter(ProgramMember.program_id == program_id)
    
    if status_filter:
        query = query.filter(MemberFace.status == status_filter)
    
    results = query.all()
    
    members = []
    for member, face in results:
        members.append({
            'member_id': member.id,
            'name': member.name,
            'status': face.status if face else 'no_photo',
            'photo_count': face.photo_count if face else 0,
            'distinguishability_score': face.distinguishability_score if face else None,
            'registered_at': face.registered_at.isoformat() if face and face.registered_at else None
        })
    
    return jsonify({
        'total': len(members),
        'members': members
    })


# ============================================
# Calibration Routes
# ============================================

@face_bp.route('/calibration-tasks', methods=['GET'])
@login_required
def get_calibration_tasks():
    """Get pending calibration tasks for current user."""
    from face_recognition.services import CalibrationService
    
    member_id = get_current_member_id()
    if not member_id:
        return jsonify({'error': '您不是团队成员'}), 403
    
    service = CalibrationService()
    tasks = service.get_member_tasks(member_id)
    
    return jsonify({'tasks': tasks})


@face_bp.route('/calibration-tasks/<int:task_id>/start', methods=['POST'])
@login_required
def start_calibration_task(task_id):
    """Start a calibration task."""
    from face_recognition.services import CalibrationService
    
    member_id = get_current_member_id()
    if not member_id:
        return jsonify({'error': '您不是团队成员'}), 403
    
    service = CalibrationService()
    result = service.start_task(task_id, member_id)
    
    if not result.get('success'):
        return jsonify(result), 400
    
    return jsonify(result)


@face_bp.route('/calibration-tasks/<int:task_id>/skip', methods=['POST'])
@login_required
def skip_calibration_task(task_id):
    """Skip a calibration task."""
    from face_recognition.services import CalibrationService
    
    member_id = get_current_member_id()
    if not member_id:
        return jsonify({'error': '您不是团队成员'}), 403
    
    service = CalibrationService()
    result = service.skip_task(task_id, member_id)
    
    if not result.get('success'):
        return jsonify(result), 400
    
    return jsonify(result)


@face_bp.route('/challenge/generate', methods=['POST'])
@login_required
def generate_challenge():
    """Generate a nine-grid calibration challenge."""
    from face_recognition.services import CalibrationService
    
    member_id = get_current_member_id()
    if not member_id:
        return jsonify({'error': '您不是团队成员'}), 403
    
    data = request.get_json() or {}
    task_id = data.get('task_id')
    difficulty = data.get('difficulty', 'medium')
    
    service = CalibrationService()
    result = service.generate_challenge(
        member_id=member_id,
        task_id=task_id,
        difficulty=difficulty
    )
    
    if not result.get('success'):
        return jsonify(result), 400
    
    return jsonify(result)


@face_bp.route('/challenge/verify', methods=['POST'])
@login_required
def verify_challenge():
    """Verify a challenge answer."""
    from face_recognition.services import CalibrationService
    
    member_id = get_current_member_id()
    if not member_id:
        return jsonify({'error': '您不是团队成员'}), 403
    
    data = request.get_json()
    challenge_token = data.get('challenge_token')
    selected_position = data.get('selected_position')
    
    if not challenge_token:
        return jsonify({'error': '请提供挑战令牌'}), 400
    if not selected_position:
        return jsonify({'error': '请选择位置'}), 400
    
    service = CalibrationService()
    result = service.verify_challenge(
        member_id=member_id,
        challenge_token=challenge_token,
        selected_position=selected_position
    )
    
    return jsonify(result)


# ============================================
# Statistics Routes
# ============================================

@face_bp.route('/stats/overview', methods=['GET'])
@role_required('admin', 'committee')
def get_face_stats():
    """Get overall face recognition statistics."""
    from models.face_models import MemberFace, PhotoRecognition
    from sqlalchemy import func
    
    # Registration stats
    status_counts = db.session.query(
        MemberFace.status,
        func.count(MemberFace.id)
    ).group_by(MemberFace.status).all()
    
    # Recognition stats
    recognition_stats = db.session.query(
        func.count(PhotoRecognition.id).label('total'),
        func.avg(PhotoRecognition.matched_faces * 100.0 / 
                 func.nullif(PhotoRecognition.total_faces, 0)).label('avg_match_rate')
    ).filter(PhotoRecognition.status == 'completed').first()
    
    return jsonify({
        'registration': {s[0]: s[1] for s in status_counts},
        'recognition': {
            'total_photos': recognition_stats.total or 0,
            'avg_match_rate': round(recognition_stats.avg_match_rate or 0, 1)
        }
    })


@face_bp.route('/stats/errors', methods=['GET'])
@role_required('admin', 'committee')
def get_error_stats():
    """Get recognition error statistics."""
    from face_recognition.services import CalibrationService
    
    service = CalibrationService()
    stats = service.get_error_statistics()
    
    return jsonify(stats)


@face_bp.route('/analyze-errors', methods=['POST'])
@role_required('admin')
def analyze_errors():
    """Trigger error analysis and task generation."""
    from face_recognition.services import CalibrationService
    
    service = CalibrationService()
    result = service.analyze_errors()
    
    return jsonify(result)
