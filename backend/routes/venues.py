"""Venue management routes."""
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, g

from database import db
from models import Semester, AuditLog
from models.venue import Venue, VenueTimeSlot, VenueBooking
from auth.decorators import login_required, committee_required

venues_bp = Blueprint('venues', __name__)


@venues_bp.route('', methods=['GET'])
@login_required
def list_venues():
    """List all venues."""
    is_active = request.args.get('is_active')

    query = Venue.query

    if is_active is not None:
        query = query.filter_by(is_active=is_active.lower() == 'true')

    venues = query.order_by(Venue.name).all()

    return jsonify({
        'venues': [v.to_dict() for v in venues]
    })


@venues_bp.route('/<int:venue_id>', methods=['GET'])
@login_required
def get_venue(venue_id):
    """Get venue by ID."""
    venue = Venue.query.get_or_404(venue_id)
    include_time_slots = request.args.get('include_time_slots', 'false').lower() == 'true'

    return jsonify({
        'venue': venue.to_dict(include_time_slots=include_time_slots)
    })


@venues_bp.route('', methods=['POST'])
@committee_required
def create_venue():
    """Create a new venue."""
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供场地信息'}), 400

    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': '场地名称不能为空'}), 400

    venue = Venue(
        name=name,
        location=data.get('location', '').strip() or None,
        capacity=data.get('capacity'),
        equipment=data.get('equipment', '').strip() or None,
        is_active=data.get('is_active', True)
    )

    db.session.add(venue)
    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_CREATE,
        user=g.current_user,
        module='venue',
        resource_type='venue',
        resource_id=venue.id,
        details={'name': name},
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '场地创建成功',
        'venue': venue.to_dict()
    }), 201


@venues_bp.route('/<int:venue_id>', methods=['PUT'])
@committee_required
def update_venue(venue_id):
    """Update a venue."""
    venue = Venue.query.get_or_404(venue_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': '场地名称不能为空'}), 400
        venue.name = name

    if 'location' in data:
        venue.location = data['location'].strip() or None

    if 'capacity' in data:
        venue.capacity = data['capacity']

    if 'equipment' in data:
        venue.equipment = data['equipment'].strip() or None

    if 'is_active' in data:
        venue.is_active = data['is_active']

    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_UPDATE,
        user=g.current_user,
        module='venue',
        resource_type='venue',
        resource_id=venue.id,
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '场地更新成功',
        'venue': venue.to_dict()
    })


@venues_bp.route('/<int:venue_id>', methods=['DELETE'])
@committee_required
def delete_venue(venue_id):
    """Delete a venue."""
    venue = Venue.query.get_or_404(venue_id)

    name = venue.name
    db.session.delete(venue)
    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_DELETE,
        user=g.current_user,
        module='venue',
        resource_type='venue',
        resource_id=venue_id,
        details={'name': name},
        ip_address=request.remote_addr
    )

    return jsonify({'message': '场地已删除'})


# Time slot management
@venues_bp.route('/<int:venue_id>/timeslots', methods=['GET'])
@login_required
def get_venue_timeslots(venue_id):
    """Get venue time slots for a semester."""
    Venue.query.get_or_404(venue_id)

    semester_id = request.args.get('semester_id', type=int)
    if not semester_id:
        current_semester = Semester.get_current()
        semester_id = current_semester.id if current_semester else None

    if not semester_id:
        return jsonify({'error': '未找到有效学期'}), 400

    time_slots = VenueTimeSlot.query.filter_by(
        venue_id=venue_id,
        semester_id=semester_id
    ).order_by(VenueTimeSlot.day_of_week, VenueTimeSlot.start_time).all()

    return jsonify({
        'time_slots': [ts.to_dict() for ts in time_slots]
    })


@venues_bp.route('/<int:venue_id>/timeslots', methods=['PUT'])
@committee_required
def update_venue_timeslots(venue_id):
    """Update venue time slots for a semester (replace all)."""
    Venue.query.get_or_404(venue_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供时间段信息'}), 400

    semester_id = data.get('semester_id')
    if not semester_id:
        current_semester = Semester.get_current()
        semester_id = current_semester.id if current_semester else None

    if not semester_id:
        return jsonify({'error': '未找到有效学期'}), 400

    time_slots_data = data.get('time_slots', [])

    # Delete existing time slots for this venue and semester
    VenueTimeSlot.query.filter_by(
        venue_id=venue_id,
        semester_id=semester_id
    ).delete()

    # Create new time slots
    for ts_data in time_slots_data:
        day_of_week = ts_data.get('day_of_week')
        start_time_str = ts_data.get('start_time')
        end_time_str = ts_data.get('end_time')

        if day_of_week is None or not start_time_str or not end_time_str:
            continue

        try:
            start_time = datetime.strptime(start_time_str, '%H:%M').time()
            end_time = datetime.strptime(end_time_str, '%H:%M').time()
        except ValueError:
            continue

        time_slot = VenueTimeSlot(
            venue_id=venue_id,
            semester_id=semester_id,
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
            is_available=ts_data.get('is_available', True),
            notes=ts_data.get('notes', '').strip() or None
        )
        db.session.add(time_slot)

    db.session.commit()

    # Return updated time slots
    time_slots = VenueTimeSlot.query.filter_by(
        venue_id=venue_id,
        semester_id=semester_id
    ).order_by(VenueTimeSlot.day_of_week, VenueTimeSlot.start_time).all()

    return jsonify({
        'message': '时间段更新成功',
        'time_slots': [ts.to_dict() for ts in time_slots]
    })


# Booking management
@venues_bp.route('/<int:venue_id>/bookings', methods=['GET'])
@login_required
def get_venue_bookings(venue_id):
    """Get venue bookings."""
    Venue.query.get_or_404(venue_id)

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    status = request.args.get('status')

    query = VenueBooking.query.filter_by(venue_id=venue_id)

    if start_date:
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(VenueBooking.date >= start)
        except ValueError:
            pass

    if end_date:
        try:
            end = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(VenueBooking.date <= end)
        except ValueError:
            pass

    if status:
        query = query.filter_by(status=status)
    else:
        query = query.filter_by(status=VenueBooking.STATUS_CONFIRMED)

    bookings = query.order_by(VenueBooking.date, VenueBooking.start_time).all()

    return jsonify({
        'bookings': [b.to_dict(include_program=True) for b in bookings]
    })


@venues_bp.route('/<int:venue_id>/schedule', methods=['GET'])
@login_required
def get_venue_schedule(venue_id):
    """Get venue schedule for a date range (combined time slots and bookings)."""
    venue = Venue.query.get_or_404(venue_id)

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not start_date:
        start_date = datetime.now().date()
    else:
        try:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        except ValueError:
            start_date = datetime.now().date()

    if not end_date:
        end_date = start_date + timedelta(days=7)
    else:
        try:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        except ValueError:
            end_date = start_date + timedelta(days=7)

    # Get current semester's time slots
    current_semester = Semester.get_current()
    time_slots = []
    if current_semester:
        time_slots = VenueTimeSlot.query.filter_by(
            venue_id=venue_id,
            semester_id=current_semester.id
        ).all()

    # Get bookings in date range
    bookings = VenueBooking.query.filter(
        VenueBooking.venue_id == venue_id,
        VenueBooking.date >= start_date,
        VenueBooking.date <= end_date,
        VenueBooking.status == VenueBooking.STATUS_CONFIRMED
    ).order_by(VenueBooking.date, VenueBooking.start_time).all()

    # Build schedule by date
    schedule = {}
    current = start_date
    while current <= end_date:
        day_of_week = current.weekday()  # 0=Monday
        date_str = current.isoformat()

        # Find available slots for this day of week
        day_slots = [ts.to_dict() for ts in time_slots
                     if ts.day_of_week == day_of_week and ts.is_available]

        # Find bookings for this date
        day_bookings = [b.to_dict(include_program=True) for b in bookings
                        if b.date == current]

        schedule[date_str] = {
            'date': date_str,
            'day_of_week': day_of_week,
            'day_name': VenueTimeSlot.DAY_NAMES[day_of_week],
            'available_slots': day_slots,
            'bookings': day_bookings,
        }

        current += timedelta(days=1)

    return jsonify({
        'venue': venue.to_dict(),
        'schedule': schedule,
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
    })


# Booking endpoints
bookings_bp = Blueprint('bookings', __name__)


@bookings_bp.route('', methods=['GET'])
@login_required
def list_bookings():
    """List all bookings."""
    venue_id = request.args.get('venue_id', type=int)
    program_id = request.args.get('program_id', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    status = request.args.get('status')

    query = VenueBooking.query

    if venue_id:
        query = query.filter_by(venue_id=venue_id)

    if program_id:
        query = query.filter_by(program_id=program_id)

    if start_date:
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(VenueBooking.date >= start)
        except ValueError:
            pass

    if end_date:
        try:
            end = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(VenueBooking.date <= end)
        except ValueError:
            pass

    if status:
        query = query.filter_by(status=status)

    bookings = query.order_by(VenueBooking.date.desc(), VenueBooking.start_time).all()

    return jsonify({
        'bookings': [b.to_dict(include_venue=True, include_program=True) for b in bookings]
    })


@bookings_bp.route('', methods=['POST'])
@login_required
def create_booking():
    """Create a new booking (direct confirmation)."""
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供预订信息'}), 400

    venue_id = data.get('venue_id')
    if not venue_id:
        return jsonify({'error': '请选择场地'}), 400

    venue = Venue.query.get(venue_id)
    if not venue:
        return jsonify({'error': '场地不存在'}), 404

    if not venue.is_active:
        return jsonify({'error': '该场地已停用'}), 400

    date_str = data.get('date')
    start_time_str = data.get('start_time')
    end_time_str = data.get('end_time')

    if not date_str or not start_time_str or not end_time_str:
        return jsonify({'error': '请填写完整的日期和时间'}), 400

    try:
        booking_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        start_time = datetime.strptime(start_time_str, '%H:%M').time()
        end_time = datetime.strptime(end_time_str, '%H:%M').time()
    except ValueError:
        return jsonify({'error': '日期或时间格式无效'}), 400

    if start_time >= end_time:
        return jsonify({'error': '开始时间必须早于结束时间'}), 400

    # Check for conflicts
    conflict = VenueBooking.check_conflict(venue_id, booking_date, start_time, end_time)
    if conflict:
        return jsonify({'error': f'与现有预订冲突: {conflict.start_time.strftime("%H:%M")}-{conflict.end_time.strftime("%H:%M")}'}), 400

    booking = VenueBooking(
        venue_id=venue_id,
        program_id=data.get('program_id'),
        rehearsal_id=data.get('rehearsal_id'),
        date=booking_date,
        start_time=start_time,
        end_time=end_time,
        status=VenueBooking.STATUS_CONFIRMED,
        booked_by=g.current_user.id,
        notes=data.get('notes', '').strip() or None
    )

    db.session.add(booking)
    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_CREATE,
        user=g.current_user,
        module='venue',
        resource_type='booking',
        resource_id=booking.id,
        details={'venue_id': venue_id, 'date': date_str},
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '预订成功',
        'booking': booking.to_dict(include_venue=True, include_program=True)
    }), 201


@bookings_bp.route('/<int:booking_id>', methods=['GET'])
@login_required
def get_booking(booking_id):
    """Get booking by ID."""
    booking = VenueBooking.query.get_or_404(booking_id)

    return jsonify({
        'booking': booking.to_dict(include_venue=True, include_program=True)
    })


@bookings_bp.route('/<int:booking_id>', methods=['PUT'])
@login_required
def update_booking(booking_id):
    """Update a booking."""
    booking = VenueBooking.query.get_or_404(booking_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    user = g.current_user
    # Only admin/committee or the person who made the booking can update
    if not (user.is_admin() or user.is_committee() or booking.booked_by == user.id):
        return jsonify({'error': '无权修改该预订'}), 403

    if 'date' in data or 'start_time' in data or 'end_time' in data:
        date_str = data.get('date', booking.date.isoformat())
        start_time_str = data.get('start_time', booking.start_time.strftime('%H:%M'))
        end_time_str = data.get('end_time', booking.end_time.strftime('%H:%M'))

        try:
            booking_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            start_time = datetime.strptime(start_time_str, '%H:%M').time()
            end_time = datetime.strptime(end_time_str, '%H:%M').time()
        except ValueError:
            return jsonify({'error': '日期或时间格式无效'}), 400

        if start_time >= end_time:
            return jsonify({'error': '开始时间必须早于结束时间'}), 400

        # Check for conflicts (excluding this booking)
        conflict = VenueBooking.check_conflict(
            booking.venue_id, booking_date, start_time, end_time, exclude_id=booking_id
        )
        if conflict:
            return jsonify({'error': f'与现有预订冲突: {conflict.start_time.strftime("%H:%M")}-{conflict.end_time.strftime("%H:%M")}'}), 400

        booking.date = booking_date
        booking.start_time = start_time
        booking.end_time = end_time

    if 'program_id' in data:
        booking.program_id = data['program_id']

    if 'rehearsal_id' in data:
        booking.rehearsal_id = data['rehearsal_id']

    if 'notes' in data:
        booking.notes = data['notes'].strip() or None

    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_UPDATE,
        user=user,
        module='venue',
        resource_type='booking',
        resource_id=booking_id,
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '预订更新成功',
        'booking': booking.to_dict(include_venue=True, include_program=True)
    })


@bookings_bp.route('/<int:booking_id>', methods=['DELETE'])
@login_required
def cancel_booking(booking_id):
    """Cancel a booking."""
    booking = VenueBooking.query.get_or_404(booking_id)

    user = g.current_user
    # Only admin/committee or the person who made the booking can cancel
    if not (user.is_admin() or user.is_committee() or booking.booked_by == user.id):
        return jsonify({'error': '无权取消该预订'}), 403

    booking.status = VenueBooking.STATUS_CANCELLED
    db.session.commit()

    AuditLog.log(
        action=AuditLog.ACTION_DELETE,
        user=user,
        module='venue',
        resource_type='booking',
        resource_id=booking_id,
        ip_address=request.remote_addr
    )

    return jsonify({'message': '预订已取消'})


# Public venue schedule endpoint
public_venues_bp = Blueprint('public_venues', __name__)


@public_venues_bp.route('/schedule', methods=['GET'])
def get_public_schedule():
    """Get public venue schedule."""
    venue_id = request.args.get('venue_id', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not start_date:
        start_date = datetime.now().date()
    else:
        try:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        except ValueError:
            start_date = datetime.now().date()

    if not end_date:
        end_date = start_date + timedelta(days=7)
    else:
        try:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        except ValueError:
            end_date = start_date + timedelta(days=7)

    # Get active venues
    if venue_id:
        venues = Venue.query.filter_by(id=venue_id, is_active=True).all()
    else:
        venues = Venue.query.filter_by(is_active=True).order_by(Venue.name).all()

    current_semester = Semester.get_current()

    result = []
    for venue in venues:
        # Get time slots
        time_slots = []
        if current_semester:
            time_slots = VenueTimeSlot.query.filter_by(
                venue_id=venue.id,
                semester_id=current_semester.id
            ).all()

        # Get bookings
        bookings = VenueBooking.query.filter(
            VenueBooking.venue_id == venue.id,
            VenueBooking.date >= start_date,
            VenueBooking.date <= end_date,
            VenueBooking.status == VenueBooking.STATUS_CONFIRMED
        ).order_by(VenueBooking.date, VenueBooking.start_time).all()

        # Build schedule
        schedule = {}
        current = start_date
        while current <= end_date:
            day_of_week = current.weekday()
            date_str = current.isoformat()

            day_slots = [ts.to_dict() for ts in time_slots
                         if ts.day_of_week == day_of_week and ts.is_available]

            day_bookings = [{
                'id': b.id,
                'date': b.date.isoformat(),
                'start_time': b.start_time.strftime('%H:%M'),
                'end_time': b.end_time.strftime('%H:%M'),
                'program_name': b.program.name if b.program else None,
            } for b in bookings if b.date == current]

            schedule[date_str] = {
                'date': date_str,
                'day_of_week': day_of_week,
                'day_name': VenueTimeSlot.DAY_NAMES[day_of_week],
                'available_slots': day_slots,
                'bookings': day_bookings,
            }

            current += timedelta(days=1)

        result.append({
            'venue': venue.to_dict(),
            'schedule': schedule,
        })

    return jsonify({
        'venues': result,
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
    })
