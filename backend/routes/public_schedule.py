"""Public schedule display routes (no authentication required)."""
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify

from database import db
from models import Program, Rehearsal, Semester

public_schedule_bp = Blueprint('public_schedule', __name__)


@public_schedule_bp.route('/week', methods=['GET'])
def week_schedule():
    """Get weekly schedule for training period display.

    Query params:
        start_date: YYYY-MM-DD (defaults to current week's Monday)
        semester_id: int (defaults to current semester)
    """
    semester_id = request.args.get('semester_id', type=int)
    start_date_str = request.args.get('start_date')

    # Get semester
    if semester_id:
        semester = Semester.query.get(semester_id)
    else:
        semester = Semester.get_current()

    if not semester:
        return jsonify({'error': '未找到当前学期'}), 404

    # For training periods, use the entire semester date range
    if semester.is_training_period():
        start_date = semester.start_date
        week_end = semester.end_date
    else:
        # Parse start_date or use current week's Monday
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': '日期格式错误'}), 400
        else:
            today = datetime.now().date()
            # Default to Monday of current week
            start_date = today - timedelta(days=today.weekday())

        # Calculate week range
        week_end = start_date + timedelta(days=6)

        # Clamp to semester dates
        if start_date < semester.start_date:
            start_date = semester.start_date
        if week_end > semester.end_date:
            week_end = semester.end_date

    # Get all active programs in this semester
    programs = Program.query.filter_by(
        semester_id=semester.id,
        status='active'
    ).order_by(Program.name).all()

    program_info = [{
        'id': p.id,
        'name': p.name,
        'display_color': p.display_color or '#3498DB',
        'category': p.category
    } for p in programs]

    # Get rehearsals in this date range
    rehearsals = Rehearsal.query.join(Program).filter(
        Program.semester_id == semester.id,
        Program.status == 'active',
        Rehearsal.scheduled_date >= start_date,
        Rehearsal.scheduled_date <= week_end
    ).order_by(Rehearsal.scheduled_date, Rehearsal.scheduled_start_time).all()

    # Group by date
    schedule = {}
    current = start_date
    while current <= week_end:
        schedule[current.isoformat()] = []
        current += timedelta(days=1)

    for r in rehearsals:
        date_key = r.scheduled_date.isoformat()
        if date_key in schedule:
            schedule[date_key].append({
                'id': r.id,
                'program_id': r.program_id,
                'program_name': r.program.name if r.program else None,
                'program_color': r.program.display_color if r.program else '#3498DB',
                'start_time': r.scheduled_start_time.isoformat() if r.scheduled_start_time else None,
                'end_time': r.scheduled_end_time.isoformat() if r.scheduled_end_time else None,
                'location': r.location,
                'teacher_name': r.teacher.name if r.teacher else None
            })

    return jsonify({
        'semester': semester.to_dict(),
        'week_start': start_date.isoformat(),
        'week_end': week_end.isoformat(),
        'programs': program_info,
        'schedule': schedule
    })


@public_schedule_bp.route('/day/<date>', methods=['GET'])
def day_schedule(date):
    """Get schedule for a specific day.

    Args:
        date: YYYY-MM-DD
    """
    try:
        target_date = datetime.strptime(date, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': '日期格式错误'}), 400

    semester_id = request.args.get('semester_id', type=int)

    # Get semester
    if semester_id:
        semester = Semester.query.get(semester_id)
    else:
        semester = Semester.get_current()

    if not semester:
        return jsonify({'error': '未找到当前学期'}), 404

    # Get rehearsals for this day
    rehearsals = Rehearsal.query.join(Program).filter(
        Program.semester_id == semester.id,
        Program.status == 'active',
        Rehearsal.scheduled_date == target_date
    ).order_by(Rehearsal.scheduled_start_time).all()

    events = []
    for r in rehearsals:
        events.append({
            'id': r.id,
            'program_id': r.program_id,
            'program_name': r.program.name if r.program else None,
            'program_color': r.program.display_color if r.program else '#3498DB',
            'category': r.program.category if r.program else None,
            'start_time': r.scheduled_start_time.isoformat() if r.scheduled_start_time else None,
            'end_time': r.scheduled_end_time.isoformat() if r.scheduled_end_time else None,
            'location': r.location,
            'teacher_name': r.teacher.name if r.teacher else None,
            'notes': r.notes
        })

    return jsonify({
        'date': target_date.isoformat(),
        'semester': semester.to_dict(),
        'events': events
    })
