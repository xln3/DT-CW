"""System configuration model."""
from datetime import datetime
from database import db


class SystemConfig(db.Model):
    """System configuration key-value store."""
    __tablename__ = 'system_config'

    id = db.Column(db.Integer, primary_key=True)
    config_key = db.Column(db.String(100), unique=True, nullable=False)
    config_value = db.Column(db.Text)
    description = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Default configuration keys
    DEFAULTS = {
        'site_name': ('艺术团综合管理系统', '站点名称'),
        'current_semester_id': ('1', '当前学期ID'),
        'storage_type': ('link_only', '视频存储方式: link_only/webdav'),
        'webdav_url': ('', 'WebDAV服务器地址'),
        'webdav_username': ('', 'WebDAV用户名'),
        'webdav_password': ('', 'WebDAV密码（加密）'),
        'webdav_base_path': ('/艺术团/', 'WebDAV基础路径'),
        'face_recognition_threshold': ('0.6', '人脸识别阈值'),
        'face_confirmation_threshold': ('0.8', '人脸确认阈值（低于此值需人工确认）'),
    }

    @classmethod
    def get(cls, key: str, default=None):
        """Get configuration value by key."""
        config = cls.query.filter_by(config_key=key).first()
        if config:
            return config.config_value
        return default

    @classmethod
    def set(cls, key: str, value: str, description: str = None):
        """Set configuration value."""
        config = cls.query.filter_by(config_key=key).first()
        if config:
            config.config_value = value
            if description:
                config.description = description
        else:
            config = cls(config_key=key, config_value=value, description=description)
            db.session.add(config)
        db.session.commit()
        return config

    @classmethod
    def init_defaults(cls):
        """Initialize default configuration values."""
        for key, (value, description) in cls.DEFAULTS.items():
            if not cls.query.filter_by(config_key=key).first():
                config = cls(config_key=key, config_value=value, description=description)
                db.session.add(config)
        db.session.commit()

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'key': self.config_key,
            'value': self.config_value,
            'description': self.description,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
