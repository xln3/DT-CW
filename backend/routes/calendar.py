"""Calendar event management routes."""
from datetime import datetime, date, time
from flask import Blueprint, request, jsonify, g

from database import db
from models import CalendarEvent, EventType, Program, Rehearsal, AuditLog
from auth.decorators import login_required
from auth.permissions import Permission, check_program_permission
from services.notification_service import NotificationService

calendar_bp = Blueprint('calendar', __name__)


@calendar_bp.route('/event-types', methods=['GET'])
@login_required
def list_event_types():
    """获取所有事件类型"""
    event_types = EventType.query.order_by(EventType.sort_order).all()
    return jsonify({
        'event_types': [et.to_dict() for et in event_types]
    })


@calendar_bp.route('/events', methods=['GET'])
@login_required
def list_events():
    """获取事件列表"""
    # 查询参数
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    event_type_id = request.args.get('event_type_id', type=int)
    program_id = request.args.get('program_id', type=int)
    status = request.args.get('status', 'active')

    query = CalendarEvent.query.filter_by(status=status)

    # 日期范围过滤
    if start_date:
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(CalendarEvent.start_date >= start)
        except ValueError:
            pass

    if end_date:
        try:
            end = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(CalendarEvent.start_date <= end)
        except ValueError:
            pass

    # 事件类型过滤
    if event_type_id:
        query = query.filter_by(event_type_id=event_type_id)

    # 节目过滤
    if program_id:
        query = query.filter_by(program_id=program_id)

    # 权限过滤：节目负责人只能看自己负责的节目事件
    user = g.current_user
    if user.is_program_manager():
        managed_ids = [up.program_id for up in user.managed_programs]
        query = query.filter(
            db.or_(
                CalendarEvent.program_id.in_(managed_ids),
                CalendarEvent.program_id.is_(None)  # 全团事件
            )
        )

    events = query.order_by(CalendarEvent.start_date.desc(), CalendarEvent.start_time.desc()).all()

    return jsonify({
        'events': [e.to_dict(include_details=False) for e in events]
    })


@calendar_bp.route('/events/<int:event_id>', methods=['GET'])
@login_required
def get_event(event_id):
    """获取事件详情"""
    event = CalendarEvent.query.get_or_404(event_id)

    # 权限检查
    user = g.current_user
    if user.is_program_manager() and event.program_id:
        if not user.can_manage_program(event.program_id):
            return jsonify({'error': '无权访问该事件'}), 403

    return jsonify({
        'event': event.to_dict(include_details=True)
    })


@calendar_bp.route('/events', methods=['POST'])
@login_required
def create_event():
    """创建新事件"""
    data = request.get_json()

    if not data:
        return jsonify({'error': '请提供事件信息'}), 400

    # 验证必填字段
    if not data.get('title'):
        return jsonify({'error': '请输入事件标题'}), 400

    if not data.get('event_type_id'):
        return jsonify({'error': '请选择事件类型'}), 400

    if not data.get('start_date'):
        return jsonify({'error': '请选择开始日期'}), 400

    # 权限检查
    program_id = data.get('program_id')
    user = g.current_user
    if program_id:
        if not check_program_permission(user, Permission.PROGRAM_EDIT, program_id):
            return jsonify({'error': '无权为该节目创建事件'}), 403

    # 解析日期时间
    try:
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': '开始日期格式错误'}), 400

    end_date = None
    if data.get('end_date'):
        try:
            end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '结束日期格式错误'}), 400

    start_time = None
    if data.get('start_time'):
        try:
            start_time = datetime.strptime(data['start_time'], '%H:%M').time()
        except ValueError:
            return jsonify({'error': '开始时间格式错误'}), 400

    end_time = None
    if data.get('end_time'):
        try:
            end_time = datetime.strptime(data['end_time'], '%H:%M').time()
        except ValueError:
            return jsonify({'error': '结束时间格式错误'}), 400

    # 创建事件
    event = CalendarEvent(
        event_type_id=data['event_type_id'],
        title=data['title'].strip(),
        description=data.get('description', '').strip() or None,
        program_id=program_id,
        start_date=start_date,
        end_date=end_date,
        start_time=start_time,
        end_time=end_time,
        is_all_day=data.get('is_all_day', False),
        location=data.get('location', '').strip() or None,
        is_recurring=data.get('is_recurring', False),
        recurrence_rule=data.get('recurrence_rule'),
        reminder_minutes=data.get('reminder_minutes'),
        rehearsal_id=data.get('rehearsal_id'),
        notify_members=data.get('notify_members', False),
        status='active',
        created_by=user.id
    )

    db.session.add(event)
    db.session.commit()

    # 记录日志
    AuditLog.log(
        action=AuditLog.ACTION_CREATE,
        user=user,
        module='calendar',
        resource_type='event',
        resource_id=event.id,
        details={'title': event.title},
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '事件创建成功',
        'event': event.to_dict(include_details=True)
    }), 201


@calendar_bp.route('/events/<int:event_id>', methods=['PUT'])
@login_required
def update_event(event_id):
    """更新事件"""
    event = CalendarEvent.query.get_or_404(event_id)
    user = g.current_user

    # 权限检查
    if event.program_id:
        if not check_program_permission(user, Permission.PROGRAM_EDIT, event.program_id):
            return jsonify({'error': '无权修改该事件'}), 403

    data = request.get_json()
    if not data:
        return jsonify({'error': '请提供更新信息'}), 400

    # 更新字段
    if 'title' in data:
        title = data['title'].strip()
        if not title:
            return jsonify({'error': '事件标题不能为空'}), 400
        event.title = title

    if 'description' in data:
        event.description = data['description'].strip() or None

    if 'event_type_id' in data:
        event.event_type_id = data['event_type_id']

    if 'start_date' in data:
        try:
            event.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '开始日期格式错误'}), 400

    if 'end_date' in data:
        if data['end_date']:
            try:
                event.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': '结束日期格式错误'}), 400
        else:
            event.end_date = None

    if 'start_time' in data:
        if data['start_time']:
            try:
                event.start_time = datetime.strptime(data['start_time'], '%H:%M').time()
            except ValueError:
                return jsonify({'error': '开始时间格式错误'}), 400
        else:
            event.start_time = None

    if 'end_time' in data:
        if data['end_time']:
            try:
                event.end_time = datetime.strptime(data['end_time'], '%H:%M').time()
            except ValueError:
                return jsonify({'error': '结束时间格式错误'}), 400
        else:
            event.end_time = None

    if 'is_all_day' in data:
        event.is_all_day = data['is_all_day']

    if 'location' in data:
        event.location = data['location'].strip() or None

    if 'is_recurring' in data:
        event.is_recurring = data['is_recurring']

    if 'recurrence_rule' in data:
        event.recurrence_rule = data['recurrence_rule']

    if 'reminder_minutes' in data:
        event.reminder_minutes = data['reminder_minutes']

    if 'notify_members' in data:
        event.notify_members = data['notify_members']

    if 'status' in data and user.is_admin_or_committee():
        event.status = data['status']

    event.updated_at = datetime.utcnow()
    db.session.commit()

    # 记录日志
    AuditLog.log(
        action=AuditLog.ACTION_UPDATE,
        user=user,
        module='calendar',
        resource_type='event',
        resource_id=event.id,
        ip_address=request.remote_addr
    )

    return jsonify({
        'message': '事件更新成功',
        'event': event.to_dict(include_details=True)
    })


@calendar_bp.route('/events/<int:event_id>', methods=['DELETE'])
@login_required
def delete_event(event_id):
    """删除事件"""
    event = CalendarEvent.query.get_or_404(event_id)
    user = g.current_user

    # 权限检查
    if event.program_id:
        if not check_program_permission(user, Permission.PROGRAM_EDIT, event.program_id):
            return jsonify({'error': '无权删除该事件'}), 403
    elif not user.is_admin_or_committee():
        return jsonify({'error': '无权删除全团事件'}), 403

    title = event.title
    db.session.delete(event)
    db.session.commit()

    # 记录日志
    AuditLog.log(
        action=AuditLog.ACTION_DELETE,
        user=user,
        module='calendar',
        resource_type='event',
        resource_id=event_id,
        details={'title': title},
        ip_address=request.remote_addr
    )

    return jsonify({'message': '事件已删除'})


@calendar_bp.route('/events/from-rehearsal', methods=['POST'])
@login_required
def create_event_from_rehearsal():
    """从排练自动创建事件"""
    data = request.get_json()

    if not data or not data.get('rehearsal_id'):
        return jsonify({'error': '请提供排练ID'}), 400

    rehearsal = Rehearsal.query.get_or_404(data['rehearsal_id'])
    user = g.current_user

    # 权限检查
    if not check_program_permission(user, Permission.REHEARSAL_EDIT, rehearsal.program_id):
        return jsonify({'error': '无权为该排练创建事件'}), 403

    # 检查是否已有关联事件
    if rehearsal.calendar_event:
        return jsonify({'error': '该排练已关联事件'}), 400

    # 获取"排练"事件类型
    rehearsal_type = EventType.query.filter_by(name='排练').first()
    if not rehearsal_type:
        return jsonify({'error': '排练事件类型不存在'}), 500

    # 创建事件
    event = CalendarEvent(
        event_type_id=rehearsal_type.id,
        title=f"{rehearsal.program.name} 排练",
        program_id=rehearsal.program_id,
        start_date=rehearsal.scheduled_date,
        start_time=rehearsal.scheduled_start_time,
        end_time=rehearsal.scheduled_end_time,
        location=rehearsal.location,
        rehearsal_id=rehearsal.id,
        notify_members=data.get('notify_members', False),
        status='active',
        created_by=user.id
    )

    db.session.add(event)
    db.session.commit()

    return jsonify({
        'message': '事件创建成功',
        'event': event.to_dict(include_details=True)
    }), 201


@calendar_bp.route('/events/<int:event_id>/send-notification', methods=['POST'])
@login_required
def send_event_notification(event_id):
    """发送事件通知给队员"""
    event = CalendarEvent.query.get_or_404(event_id)
    user = g.current_user

    # 权限检查
    if event.program_id:
        if not check_program_permission(user, Permission.PROGRAM_EDIT, event.program_id):
            return jsonify({'error': '无权发送该事件的通知'}), 403
    elif not user.is_admin_or_committee():
        return jsonify({'error': '无权发送全团事件通知'}), 403

    # 发送通知
    notification_service = NotificationService()
    result = notification_service.send_event_notification(event)

    if not result['success']:
        return jsonify(result), 400

    # 记录日志
    AuditLog.log(
        action='notification_sent',
        user=user,
        module='calendar',
        resource_type='event',
        resource_id=event.id,
        details={
            'title': event.title,
            'recipients': result['total_recipients'],
            'sent': result['sent_count']
        },
        ip_address=request.remote_addr
    )

    return jsonify(result)


@calendar_bp.route('/events/<int:event_id>/notification-preview', methods=['GET'])
@login_required
def preview_notification(event_id):
    """预览事件通知内容"""
    event = CalendarEvent.query.get_or_404(event_id)
    user = g.current_user

    # 权限检查
    if event.program_id:
        if not check_program_permission(user, Permission.PROGRAM_EDIT, event.program_id):
            return jsonify({'error': '无权访问该事件'}), 403

    notification_service = NotificationService()
    recipients = notification_service.get_event_recipients(event)
    message = notification_service.format_event_message(event)

    return jsonify({
        'message': message,
        'total_recipients': len(recipients),
        'recipients': [
            {
                'id': m.id,
                'name': m.name,
                'phone': m.phone,
                'student_id': m.student_id
            } for m in recipients
        ],
        'notification_sent': event.notification_sent,
        'notification_sent_at': event.notification_sent_at.isoformat() if event.notification_sent_at else None
    })
