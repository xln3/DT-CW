"""
Face feature extractor using InsightFace.

Supports both real model inference and mock mode for testing.
"""

import os
import logging
from typing import List, Dict, Optional, Tuple
from io import BytesIO
import numpy as np

from ..config import FaceRecognitionConfig

logger = logging.getLogger(__name__)


class FeatureExtractor:
    """
    Face detection and feature extraction using InsightFace.
    
    In mock mode, generates deterministic fake embeddings for testing.
    """
    
    def __init__(self, use_mock: bool = None):
        """
        Initialize the feature extractor.
        
        Args:
            use_mock: Force mock mode. If None, uses config setting.
        """
        self.use_mock = use_mock if use_mock is not None else FaceRecognitionConfig.USE_MOCK_MODE
        self.model = None
        self.embedding_dim = FaceRecognitionConfig.EMBEDDING_DIM
        
        if not self.use_mock:
            self._load_model()
    
    def _load_model(self):
        """Load InsightFace model."""
        try:
            import insightface
            from insightface.app import FaceAnalysis
            
            model_path = FaceRecognitionConfig.MODEL_PATH
            model_pack = FaceRecognitionConfig.MODEL_PACK
            
            # Initialize FaceAnalysis
            self.model = FaceAnalysis(
                name=model_pack,
                root=model_path,
                providers=['CPUExecutionProvider']  # Use CPU; add CUDA for GPU
            )
            
            det_size = FaceRecognitionConfig.DET_SIZE
            self.model.prepare(ctx_id=0, det_size=det_size)
            
            logger.info(f"Loaded InsightFace model: {model_pack}")
            
        except ImportError:
            logger.warning("InsightFace not installed, falling back to mock mode")
            self.use_mock = True
        except Exception as e:
            logger.error(f"Failed to load model: {e}, falling back to mock mode")
            self.use_mock = True
    
    def detect_faces(self, image_data: bytes) -> List[Dict]:
        """
        Detect faces in an image.
        
        Args:
            image_data: Image bytes (JPEG/PNG)
            
        Returns:
            List of detected faces with location and embedding
        """
        if self.use_mock:
            return self._mock_detect_faces(image_data)
        
        return self._real_detect_faces(image_data)
    
    def _real_detect_faces(self, image_data: bytes) -> List[Dict]:
        """Real face detection using InsightFace."""
        import cv2
        
        # Decode image
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            logger.error("Failed to decode image")
            return []
        
        # Detect faces
        faces = self.model.get(img)
        
        results = []
        for i, face in enumerate(faces):
            # Get bounding box
            bbox = face.bbox.astype(int).tolist()
            
            # Get embedding (512-dim)
            embedding = face.embedding
            
            # Normalize embedding
            embedding = embedding / np.linalg.norm(embedding)
            
            # Crop face
            x1, y1, x2, y2 = bbox
            face_crop = img[max(0, y1):y2, max(0, x1):x2]
            
            # Encode face crop as JPEG
            _, face_crop_bytes = cv2.imencode('.jpg', face_crop)
            
            # Calculate quality score (based on face size and detection score)
            face_size = (x2 - x1) * (y2 - y1)
            det_score = float(face.det_score) if hasattr(face, 'det_score') else 0.9
            quality_score = min(1.0, (face_size / 10000) * det_score)
            
            results.append({
                'index': i,
                'bbox': bbox,
                'embedding': embedding.tolist(),
                'face_crop': face_crop_bytes.tobytes(),
                'quality_score': quality_score,
                'det_score': det_score,
            })
        
        return results
    
    def _mock_detect_faces(self, image_data: bytes) -> List[Dict]:
        """
        Mock face detection for testing.
        
        Generates deterministic results based on image hash.
        """
        import hashlib
        
        # Generate deterministic hash from image
        img_hash = hashlib.md5(image_data).hexdigest()
        
        # Use hash to determine number of faces (1-5)
        num_faces = (int(img_hash[:2], 16) % 5) + 1
        
        results = []
        for i in range(num_faces):
            # Generate deterministic embedding from hash + index
            seed_str = f"{img_hash}_{i}"
            seed = int(hashlib.md5(seed_str.encode()).hexdigest()[:8], 16)
            np.random.seed(seed)
            
            embedding = np.random.randn(self.embedding_dim).astype(np.float32)
            embedding = embedding / np.linalg.norm(embedding)
            
            # Generate fake bbox
            x1 = 50 + i * 100
            y1 = 50
            x2 = x1 + 80
            y2 = y1 + 100
            
            results.append({
                'index': i,
                'bbox': [x1, y1, x2, y2],
                'embedding': embedding.tolist(),
                'face_crop': image_data[:1000],  # Placeholder
                'quality_score': 0.7 + (i % 3) * 0.1,
                'det_score': 0.95,
            })
        
        return results
    
    def extract_embedding(self, image_data: bytes) -> Optional[List[float]]:
        """
        Extract face embedding from a single-face image.
        
        Args:
            image_data: Image bytes containing one face
            
        Returns:
            512-dim embedding as list, or None if no face detected
        """
        faces = self.detect_faces(image_data)
        
        if not faces:
            return None
        
        # Return the first (largest) face
        return faces[0]['embedding']
    
    def extract_embedding_with_validation(
        self, 
        image_data: bytes,
        require_single_face: bool = True
    ) -> Tuple[Optional[List[float]], str, Dict]:
        """
        Extract embedding with validation.
        
        Args:
            image_data: Image bytes
            require_single_face: If True, reject images with multiple faces
            
        Returns:
            Tuple of (embedding, status_message, metadata)
        """
        faces = self.detect_faces(image_data)
        
        if not faces:
            return None, "未检测到人脸", {}
        
        if len(faces) > 1 and require_single_face:
            return None, f"检测到{len(faces)}张人脸，请上传单人照片", {
                'face_count': len(faces)
            }
        
        face = faces[0]
        
        if face['quality_score'] < FaceRecognitionConfig.MIN_PHOTO_QUALITY:
            return None, "照片质量太低，请重新拍摄", {
                'quality_score': face['quality_score']
            }
        
        return face['embedding'], "success", {
            'quality_score': face['quality_score'],
            'face_count': len(faces),
            'bbox': face['bbox'],
        }


# Singleton instance
_extractor_instance = None


def get_feature_extractor(use_mock: bool = None) -> FeatureExtractor:
    """Get or create singleton feature extractor instance."""
    global _extractor_instance
    
    if _extractor_instance is None:
        _extractor_instance = FeatureExtractor(use_mock=use_mock)
    
    return _extractor_instance
