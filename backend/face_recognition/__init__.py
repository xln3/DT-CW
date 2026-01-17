"""
Face Recognition Module for Arts Troupe Attendance System.

This module provides:
- Face feature extraction using InsightFace
- Member face registration (upload or group photo selection)
- Distinguishability-based registration validation
- Program-scoped group photo recognition
- Error-history-based calibration task generation

Key Design Principles:
1. Embeddings are maintained, not model training
2. Registration requires distinguishability from all other members
3. Group photo matching is scoped to program members only
4. Calibration is triggered by recognition error history
"""

from .config import FaceRecognitionConfig
from .core.feature_extractor import FeatureExtractor
from .core.face_matcher import FaceMatcher
from .core.distinguishability_checker import DistinguishabilityChecker
from .core.embedding_aggregator import EmbeddingAggregator
from .services.registration_service import RegistrationService
from .services.recognition_service import RecognitionService
from .services.group_selection_service import GroupSelectionService
from .services.calibration_service import CalibrationService

__all__ = [
    'FaceRecognitionConfig',
    'FeatureExtractor',
    'FaceMatcher',
    'DistinguishabilityChecker',
    'EmbeddingAggregator',
    'RegistrationService',
    'RecognitionService',
    'GroupSelectionService',
    'CalibrationService',
]

__version__ = '1.0.0'
