"""Face vector model for face recognition."""
from datetime import datetime
from database import db
import json


class FaceVector(db.Model):
    """Face encoding vector for recognition."""
    __tablename__ = 'face_vectors'

    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    encoding = db.Column(db.Text, nullable=False)  # JSON array of face encoding
    source_type = db.Column(db.String(20), nullable=False)  # annotation/upload
    source_id = db.Column(db.Integer)  # ID of source annotation or upload
    quality_score = db.Column(db.Float)  # Face quality score
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    member = db.relationship('Member', back_populates='face_vectors')

    SOURCE_ANNOTATION = 'annotation'
    SOURCE_UPLOAD = 'upload'

    def get_encoding(self) -> list:
        """Parse encoding JSON to list."""
        if self.encoding:
            return json.loads(self.encoding)
        return []

    def set_encoding(self, encoding_list: list):
        """Set encoding from list to JSON."""
        self.encoding = json.dumps(encoding_list)

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'member_id': self.member_id,
            'member_name': self.member.name if self.member else None,
            'source_type': self.source_type,
            'source_id': self.source_id,
            'quality_score': self.quality_score,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
