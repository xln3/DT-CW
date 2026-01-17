"""Face recognition module configuration."""
import os


class FaceRecognitionConfig:
    """Configuration for face recognition module."""
    
    # Model configuration
    MODEL_PACK = os.environ.get('FACE_MODEL_PACK', 'buffalo_l')
    MODEL_PATH = os.environ.get('FACE_MODEL_PATH', './models/insightface')
    EMBEDDING_DIM = 512
    
    # Detection configuration
    DET_SIZE = (640, 640)
    DET_THRESHOLD = 0.5
    
    # Matching thresholds
    MATCH_THRESHOLD_CONFIRMED = 0.55   # > this = confirmed match
    MATCH_THRESHOLD_UNCERTAIN = 0.35   # > this = uncertain, needs review
    # < UNCERTAIN = unmatched
    
    # Distinguishability thresholds
    DISTINGUISHABLE_THRESHOLD = 0.50   # < this = distinguishable (can register)
    BORDERLINE_THRESHOLD = 0.65        # < this = borderline (needs more data)
    # >= BORDERLINE = conflict
    
    # Calibration configuration
    CALIBRATION_REQUIRED_CORRECT = 3   # Consecutive correct answers needed
    CHALLENGE_EXPIRE_SECONDS = 300     # 5 minutes
    
    # Photo configuration
    MAX_PHOTOS_PER_MEMBER = 10
    MIN_PHOTO_QUALITY = 0.3
    MIN_REGISTRATION_PHOTOS = 1        # Minimum photos for upload registration
    MIN_GROUP_SELECTIONS = 3           # Minimum selections for group photo registration
    
    # Difficulty ranges for challenges (similarity range)
    DIFFICULTY_RANGES = {
        'easy': (0.20, 0.40),
        'medium': (0.35, 0.55),
        'hard': (0.50, 0.65),
    }
    
    # Error analysis configuration
    ERROR_COUNT_THRESHOLD = 3          # Errors before triggering calibration
    CONFUSION_COUNT_THRESHOLD = 2      # Confusions before flagging pair
    ANALYSIS_PERIOD_DAYS = 30
    
    # Mock mode for testing
    USE_MOCK_MODE = os.environ.get('FACE_MOCK_MODE', 'false').lower() == 'true'
    
    @classmethod
    def get_difficulty_range(cls, difficulty):
        return cls.DIFFICULTY_RANGES.get(difficulty, cls.DIFFICULTY_RANGES['medium'])
