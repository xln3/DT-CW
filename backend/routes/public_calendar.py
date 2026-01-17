"""Public calendar routes (no authentication required)."""
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify

from models import CalendarEvent, EventType

public_calendar_bp = Blueprint('public_calendar', __name__)


@public_calendar_bp.route('/month/<year>/<month>', methods=['GET'])
def get_month_events(year, month):
    """获取指定月份的所有事件（月视图）"""
    try:
        year = int(year)
        month = int(month)

        # 计算月份范围
        start_date = datetime(year, month, 1).date()
        if month == 12:
            end_date = datetime(year + 1, 1, 1).date()
        else:
            end_date = datetime(year, month + 1, 1).date()

        # 查询该月的事件
        events = CalendarEvent.query.filter(
            CalendarEvent.status == 'active',
            CalendarEvent.start_date >= start_date,
            CalendarEvent.start_date < end_date
        ).order_by(CalendarEvent.start_date, CalendarEvent.start_time).all()

        # 按日期分组
        events_by_date = {}
        for event in events:
            date_key = event.start_date.isoformat()
            if date_key not in events_by_date:
                events_by_date[date_key] = []
            events_by_date[date_key].append(event.to_dict())

        return jsonify({
            'year': year,
            'month': month,
            'events_by_date': events_by_date,
            'total_events': len(events)
        })

    except ValueError:
        return jsonify({'error': '无效的年份或月份'}), 400


@public_calendar_bp.route('/week', methods=['GET'])
def get_week_events():
    """获取本周事件（周视图）"""
    # 获取查询参数中的日期，默认为今天
    date_str = request.args.get('date')
    if date_str:
        try:
            base_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '日期格式错误'}), 400
    else:
        base_date = datetime.now().date()

    # 计算本周的开始和结束（周一到周日）
    weekday = base_date.weekday()  # 0=Monday, 6=Sunday
    week_start = base_date - timedelta(days=weekday)
    week_end = week_start + timedelta(days=6)

    # 查询本周的事件
    events = CalendarEvent.query.filter(
        CalendarEvent.status == 'active',
        CalendarEvent.start_date >= week_start,
        CalendarEvent.start_date <= week_end
    ).order_by(CalendarEvent.start_date, CalendarEvent.start_time).all()

    # 按日期分组
    events_by_date = {}
    for event in events:
        date_key = event.start_date.isoformat()
        if date_key not in events_by_date:
            events_by_date[date_key] = []
        events_by_date[date_key].append(event.to_dict(include_details=True))

    return jsonify({
        'week_start': week_start.isoformat(),
        'week_end': week_end.isoformat(),
        'events_by_date': events_by_date,
        'total_events': len(events)
    })


@public_calendar_bp.route('/upcoming', methods=['GET'])
def get_upcoming_events():
    """获取即将到来的事件"""
    days = request.args.get('days', 7, type=int)  # 默认7天
    limit = request.args.get('limit', 10, type=int)  # 默认10条

    today = datetime.now().date()
    end_date = today + timedelta(days=days)

    events = CalendarEvent.query.filter(
        CalendarEvent.status == 'active',
        CalendarEvent.start_date >= today,
        CalendarEvent.start_date <= end_date
    ).order_by(CalendarEvent.start_date, CalendarEvent.start_time).limit(limit).all()

    return jsonify({
        'events': [e.to_dict(include_details=True) for e in events],
        'start_date': today.isoformat(),
        'end_date': end_date.isoformat()
    })


@public_calendar_bp.route('/today', methods=['GET'])
def get_today_events():
    """获取今日事件"""
    today = datetime.now().date()

    events = CalendarEvent.query.filter(
        CalendarEvent.status == 'active',
        CalendarEvent.start_date == today
    ).order_by(CalendarEvent.start_time).all()

    return jsonify({
        'date': today.isoformat(),
        'events': [e.to_dict(include_details=True) for e in events],
        'total': len(events)
    })


@public_calendar_bp.route('/event-types', methods=['GET'])
def list_event_types():
    """获取所有事件类型（公开）"""
    event_types = EventType.query.order_by(EventType.sort_order).all()
    return jsonify({
        'event_types': [et.to_dict() for et in event_types]
    })


@public_calendar_bp.route('/events/<int:event_id>', methods=['GET'])
def get_event_detail(event_id):
    """获取事件详情（公开）"""
    event = CalendarEvent.query.filter_by(id=event_id, status='active').first()

    if not event:
        return jsonify({'error': '事件不存在'}), 404

    return jsonify({
        'event': event.to_dict(include_details=True)
    })


@public_calendar_bp.route('/stats', methods=['GET'])
def get_calendar_stats():
    """获取日历统计信息"""
    today = datetime.now().date()

    # 本月事件数
    month_start = datetime(today.year, today.month, 1).date()
    if today.month == 12:
        month_end = datetime(today.year + 1, 1, 1).date()
    else:
        month_end = datetime(today.year, today.month + 1, 1).date()

    month_events = CalendarEvent.query.filter(
        CalendarEvent.status == 'active',
        CalendarEvent.start_date >= month_start,
        CalendarEvent.start_date < month_end
    ).count()

    # 本周事件数
    weekday = today.weekday()
    week_start = today - timedelta(days=weekday)
    week_end = week_start + timedelta(days=6)

    week_events = CalendarEvent.query.filter(
        CalendarEvent.status == 'active',
        CalendarEvent.start_date >= week_start,
        CalendarEvent.start_date <= week_end
    ).count()

    # 今日事件数
    today_events = CalendarEvent.query.filter(
        CalendarEvent.status == 'active',
        CalendarEvent.start_date == today
    ).count()

    # 按类型统计本月事件
    type_stats = []
    event_types = EventType.query.all()
    for et in event_types:
        count = CalendarEvent.query.filter(
            CalendarEvent.status == 'active',
            CalendarEvent.event_type_id == et.id,
            CalendarEvent.start_date >= month_start,
            CalendarEvent.start_date < month_end
        ).count()
        if count > 0:
            type_stats.append({
                'event_type': et.to_dict(),
                'count': count
            })

    return jsonify({
        'today_events': today_events,
        'week_events': week_events,
        'month_events': month_events,
        'month_type_stats': type_stats
    })
