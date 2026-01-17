"""Face recognition core algorithms."""

from .feature_extractor import FeatureExtractor, get_feature_extractor
from .face_matcher import FaceMatcher
from .distinguishability_checker import DistinguishabilityChecker, DistinguishabilityStatus
from .embedding_aggregator import EmbeddingAggregator

__all__ = [
    'FeatureExtractor',
    'get_feature_extractor',
    'FaceMatcher',
    'DistinguishabilityChecker',
    'DistinguishabilityStatus',
    'EmbeddingAggregator',
]
