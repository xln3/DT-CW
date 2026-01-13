"""Dashboard statistics routes."""
from datetime import datetime, timedelta
from flask import Blueprint, jsonify

from database import db
from models import Member, Teacher, Program, Rehearsal, Attendance
from auth.decorators import login_required

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/stats', methods=['GET'])
@login_required
def get_stats():
    """Get dashboard statistics."""
    # Count active members
    member_count = Member.query.filter_by(status='active').count()

    # Count active teachers
    teacher_count = Teacher.query.filter_by(status='active').count()

    # Count active programs
    program_count = Program.query.filter_by(status='active').count()

    # Count rehearsals this week
    today = datetime.now().date()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    week_rehearsal_count = Rehearsal.query.filter(
        Rehearsal.scheduled_date >= week_start,
        Rehearsal.scheduled_date <= week_end
    ).count()

    # Get upcoming rehearsals (next 7 days)
    upcoming_rehearsals = Rehearsal.query.filter(
        Rehearsal.scheduled_date >= today,
        Rehearsal.scheduled_date <= today + timedelta(days=7)
    ).order_by(Rehearsal.scheduled_date, Rehearsal.scheduled_start_time).limit(5).all()

    upcoming_list = []
    for r in upcoming_rehearsals:
        upcoming_list.append({
            'id': r.id,
            'program_name': r.program.name if r.program else 'Unknown',
            'date': r.scheduled_date.isoformat(),
            'start_time': r.scheduled_start_time.isoformat() if r.scheduled_start_time else None,
            'location': r.location
        })

    # Get recent programs
    recent_programs = Program.query.filter_by(status='active').order_by(
        Program.created_at.desc()
    ).limit(5).all()

    recent_program_list = []
    for p in recent_programs:
        recent_program_list.append({
            'id': p.id,
            'name': p.name,
            'category': p.category,
            'member_count': p.members.filter_by(status='active').count(),
            'rehearsal_count': p.rehearsals.count()
        })

    return jsonify({
        'stats': {
            'member_count': member_count,
            'teacher_count': teacher_count,
            'program_count': program_count,
            'week_rehearsal_count': week_rehearsal_count
        },
        'upcoming_rehearsals': upcoming_list,
        'recent_programs': recent_program_list
    })
