"""Event type model for calendar."""
from datetime import datetime
from database import db


class EventType(db.Model):
    """事件类型模型"""
    __tablename__ = 'event_types'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)  # 演出/审核/排练/会议/其他
    color = db.Column(db.String(20), nullable=False)  # 显示颜色
    icon = db.Column(db.String(50))  # 图标
    sort_order = db.Column(db.Integer, default=0)  # 排序
    is_system = db.Column(db.Boolean, default=False)  # 是否系统预置
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    events = db.relationship('CalendarEvent', back_populates='event_type', lazy='dynamic')

    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'name': self.name,
            'color': self.color,
            'icon': self.icon,
            'sort_order': self.sort_order,
            'is_system': self.is_system,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    @staticmethod
    def init_default_types():
        """初始化默认事件类型"""
        default_types = [
            {'name': '演出', 'color': '#E74C3C', 'icon': '🎭', 'sort_order': 1, 'is_system': True},
            {'name': '审核', 'color': '#9B59B6', 'icon': '📋', 'sort_order': 2, 'is_system': True},
            {'name': '排练', 'color': '#3498DB', 'icon': '🎵', 'sort_order': 3, 'is_system': True},
            {'name': '会议', 'color': '#F39C12', 'icon': '👥', 'sort_order': 4, 'is_system': True},
            {'name': '其他', 'color': '#95A5A6', 'icon': '📌', 'sort_order': 5, 'is_system': True}
        ]

        for type_data in default_types:
            if not EventType.query.filter_by(name=type_data['name']).first():
                event_type = EventType(**type_data)
                db.session.add(event_type)

        db.session.commit()
