"""Face annotation model."""
from datetime import datetime
from database import db
import json


class FaceAnnotation(db.Model):
    """Face annotation record."""
    __tablename__ = 'face_annotations'

    id = db.Column(db.Integer, primary_key=True)
    rehearsal_id = db.Column(db.Integer, db.ForeignKey('rehearsals.id'), nullable=False)
    photo_type = db.Column(db.String(10), nullable=False)  # before/after
    face_index = db.Column(db.Integer, nullable=False)  # Index of face in photo
    face_location = db.Column(db.Text, nullable=False)  # JSON: {top, right, bottom, left}
    face_encoding = db.Column(db.Text)  # JSON array of face encoding
    face_image_path = db.Column(db.String(255))  # Path to cropped face image

    # Auto-recognition results
    auto_member_id = db.Column(db.Integer, db.ForeignKey('members.id'))
    auto_confidence = db.Column(db.Float)

    # Manual annotation
    annotated_member_id = db.Column(db.Integer, db.ForeignKey('members.id'))
    annotation_type = db.Column(db.String(20))  # confirmed/corrected/new
    annotated_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    annotated_at = db.Column(db.DateTime)

    # Special flags
    is_unknown = db.Column(db.Boolean, default=False)  # Face belongs to unknown person
    is_unrecognizable = db.Column(db.Boolean, default=False)  # Face quality too low

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    rehearsal = db.relationship('Rehearsal', back_populates='face_annotations')

    PHOTO_BEFORE = 'before'
    PHOTO_AFTER = 'after'

    ANNOTATION_CONFIRMED = 'confirmed'    # User confirmed auto-recognition
    ANNOTATION_CORRECTED = 'corrected'    # User corrected auto-recognition
    ANNOTATION_NEW = 'new'                # User manually identified

    def get_location(self) -> dict:
        """Parse face location JSON."""
        if self.face_location:
            return json.loads(self.face_location)
        return {}

    def set_location(self, location: dict):
        """Set face location as JSON."""
        self.face_location = json.dumps(location)

    def get_encoding(self) -> list:
        """Parse face encoding JSON."""
        if self.face_encoding:
            return json.loads(self.face_encoding)
        return []

    def set_encoding(self, encoding: list):
        """Set face encoding as JSON."""
        self.face_encoding = json.dumps(encoding)

    def get_final_member_id(self) -> int:
        """Get the final determined member ID (annotated > auto)."""
        return self.annotated_member_id or self.auto_member_id

    def needs_annotation(self) -> bool:
        """Check if this face still needs manual annotation."""
        if self.is_unknown or self.is_unrecognizable:
            return False
        if self.annotated_member_id:
            return False
        # Needs annotation if no auto recognition or low confidence
        return self.auto_member_id is None or (self.auto_confidence and self.auto_confidence < 0.8)

    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'rehearsal_id': self.rehearsal_id,
            'photo_type': self.photo_type,
            'face_index': self.face_index,
            'face_location': self.get_location(),
            'face_image_path': self.face_image_path,
            'auto_member_id': self.auto_member_id,
            'auto_confidence': self.auto_confidence,
            'annotated_member_id': self.annotated_member_id,
            'annotation_type': self.annotation_type,
            'annotated_by': self.annotated_by,
            'annotated_at': self.annotated_at.isoformat() if self.annotated_at else None,
            'is_unknown': self.is_unknown,
            'is_unrecognizable': self.is_unrecognizable,
            'final_member_id': self.get_final_member_id(),
            'needs_annotation': self.needs_annotation(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
