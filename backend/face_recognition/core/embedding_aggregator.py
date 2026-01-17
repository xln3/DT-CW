"""
Embedding aggregator for combining multiple face embeddings.

When a member has multiple photos, their embeddings need to be
aggregated into a single representative embedding.
"""

import logging
from typing import List, Optional
import numpy as np

logger = logging.getLogger(__name__)


class EmbeddingAggregator:
    """
    Aggregates multiple face embeddings into one representative embedding.
    
    Supports multiple strategies:
    - Mean: Simple average
    - Weighted mean: Quality-weighted average
    - Cluster center: Remove outliers then average
    """
    
    @staticmethod
    def aggregate_mean(embeddings: List[List[float]]) -> List[float]:
        """
        Simple mean aggregation.
        
        Args:
            embeddings: List of 512-dim embeddings
            
        Returns:
            Aggregated 512-dim embedding
        """
        if not embeddings:
            raise ValueError("No embeddings to aggregate")
        
        stacked = np.array(embeddings, dtype=np.float32)
        mean_embedding = np.mean(stacked, axis=0)
        
        # L2 normalize
        mean_embedding = mean_embedding / np.linalg.norm(mean_embedding)
        
        return mean_embedding.tolist()
    
    @staticmethod
    def aggregate_weighted(
        embeddings: List[List[float]], 
        quality_scores: List[float]
    ) -> List[float]:
        """
        Quality-weighted mean aggregation.
        
        Higher quality photos contribute more to the final embedding.
        
        Args:
            embeddings: List of 512-dim embeddings
            quality_scores: List of quality scores (0-1)
            
        Returns:
            Aggregated 512-dim embedding
        """
        if not embeddings:
            raise ValueError("No embeddings to aggregate")
        
        if len(embeddings) != len(quality_scores):
            raise ValueError("Embeddings and quality scores must have same length")
        
        stacked = np.array(embeddings, dtype=np.float32)
        weights = np.array(quality_scores, dtype=np.float32)
        
        # Normalize weights
        weights = weights / weights.sum()
        
        # Weighted average
        weighted_mean = np.average(stacked, axis=0, weights=weights)
        
        # L2 normalize
        weighted_mean = weighted_mean / np.linalg.norm(weighted_mean)
        
        return weighted_mean.tolist()
    
    @staticmethod
    def aggregate_cluster_center(
        embeddings: List[List[float]],
        outlier_threshold: float = 2.0
    ) -> List[float]:
        """
        Cluster center aggregation with outlier removal.
        
        Removes embeddings that are too far from the mean before averaging.
        Useful when some photos might be poor quality or mislabeled.
        
        Args:
            embeddings: List of 512-dim embeddings
            outlier_threshold: Standard deviations for outlier detection
            
        Returns:
            Aggregated 512-dim embedding
        """
        if not embeddings:
            raise ValueError("No embeddings to aggregate")
        
        if len(embeddings) == 1:
            return embeddings[0]
        
        stacked = np.array(embeddings, dtype=np.float32)
        
        # Calculate initial mean
        mean = np.mean(stacked, axis=0)
        
        # Calculate distances from mean
        distances = np.linalg.norm(stacked - mean, axis=1)
        
        # Find outliers
        mean_dist = np.mean(distances)
        std_dist = np.std(distances)
        
        if std_dist > 0:
            mask = distances < (mean_dist + outlier_threshold * std_dist)
            filtered = stacked[mask]
        else:
            filtered = stacked
        
        # If all filtered out, use original
        if len(filtered) == 0:
            filtered = stacked
        
        # Calculate center of filtered embeddings
        center = np.mean(filtered, axis=0)
        
        # L2 normalize
        center = center / np.linalg.norm(center)
        
        return center.tolist()
    
    @classmethod
    def aggregate(
        cls,
        embeddings: List[List[float]],
        quality_scores: Optional[List[float]] = None,
        method: str = 'weighted'
    ) -> List[float]:
        """
        Aggregate embeddings using specified method.
        
        Args:
            embeddings: List of 512-dim embeddings
            quality_scores: Optional quality scores for weighted method
            method: 'mean', 'weighted', or 'cluster'
            
        Returns:
            Aggregated 512-dim embedding
        """
        if method == 'mean':
            return cls.aggregate_mean(embeddings)
        elif method == 'weighted':
            if quality_scores is None:
                # Fall back to equal weights
                quality_scores = [1.0] * len(embeddings)
            return cls.aggregate_weighted(embeddings, quality_scores)
        elif method == 'cluster':
            return cls.aggregate_cluster_center(embeddings)
        else:
            raise ValueError(f"Unknown aggregation method: {method}")
