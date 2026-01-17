"""Calendar event model."""
from datetime import datetime, date, time
from database import db


class CalendarEvent(db.Model):
    """队历事件模型"""
    __tablename__ = 'calendar_events'

    id = db.Column(db.Integer, primary_key=True)
    event_type_id = db.Column(db.Integer, db.ForeignKey('event_types.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    program_id = db.Column(db.Integer, db.ForeignKey('programs.id'))

    # 时间
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date)  # 多日事件
    start_time = db.Column(db.Time)
    end_time = db.Column(db.Time)
    is_all_day = db.Column(db.Boolean, default=False)

    # 地点
    location = db.Column(db.String(200))

    # 重复设置
    is_recurring = db.Column(db.Boolean, default=False)
    recurrence_rule = db.Column(db.Text)  # iCal RRULE格式

    # 提醒
    reminder_minutes = db.Column(db.Integer)  # 提前多少分钟提醒

    # 关联排练
    rehearsal_id = db.Column(db.Integer, db.ForeignKey('rehearsals.id'))

    # 通知设置
    notify_members = db.Column(db.Boolean, default=False)  # 是否通知队员
    notification_sent = db.Column(db.Boolean, default=False)  # 是否已发送通知
    notification_sent_at = db.Column(db.DateTime)

    # 状态
    status = db.Column(db.String(20), default='active')  # active/cancelled
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    event_type = db.relationship('EventType', back_populates='events')
    program = db.relationship('Program', backref='calendar_events')
    rehearsal = db.relationship('Rehearsal', backref='calendar_event', uselist=False)
    creator = db.relationship('User', backref='created_events')

    def to_dict(self, include_details=False):
        """转换为字典"""
        data = {
            'id': self.id,
            'event_type_id': self.event_type_id,
            'event_type': self.event_type.to_dict() if self.event_type else None,
            'title': self.title,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'is_all_day': self.is_all_day,
            'location': self.location,
            'status': self.status
        }

        if include_details:
            data.update({
                'description': self.description,
                'program_id': self.program_id,
                'program': self.program.to_dict() if self.program else None,
                'is_recurring': self.is_recurring,
                'recurrence_rule': self.recurrence_rule,
                'reminder_minutes': self.reminder_minutes,
                'rehearsal_id': self.rehearsal_id,
                'notify_members': self.notify_members,
                'notification_sent': self.notification_sent,
                'notification_sent_at': self.notification_sent_at.isoformat() if self.notification_sent_at else None,
                'created_by': self.created_by,
                'created_at': self.created_at.isoformat() if self.created_at else None,
                'updated_at': self.updated_at.isoformat() if self.updated_at else None
            })

        return data

    def get_datetime_display(self):
        """获取时间显示文本"""
        if self.is_all_day:
            if self.end_date and self.end_date != self.start_date:
                return f"{self.start_date.strftime('%Y-%m-%d')} 至 {self.end_date.strftime('%Y-%m-%d')} 全天"
            return f"{self.start_date.strftime('%Y-%m-%d')} 全天"

        time_str = ""
        if self.start_time:
            time_str = self.start_time.strftime('%H:%M')
            if self.end_time:
                time_str += f" - {self.end_time.strftime('%H:%M')}"

        date_str = self.start_date.strftime('%Y-%m-%d')
        if self.end_date and self.end_date != self.start_date:
            date_str += f" 至 {self.end_date.strftime('%Y-%m-%d')}"

        return f"{date_str} {time_str}".strip()
