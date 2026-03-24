"""
Ranking Algorithm Module
Advanced ML-powered ranking algorithm with personalization and learning capabilities
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any, Union
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
import json
import logging
from datetime import datetime, timedelta
import pickle
from pathlib import Path
from collections import defaultdict, Counter
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
import joblib
from scipy.sparse import csr_matrix
import math

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class RankingFeatures:
    """Features used for ranking"""
    # Content relevance features
    text_relevance: float = 0.0
    semantic_similarity: float = 0.0
    keyword_match_score: float = 0.0
    phrase_match_score: float = 0.0
    
    # Quality features
    rating_score: float = 0.0
    review_count_score: float = 0.0
    instructor_quality: float = 0.0
    content_completeness: float = 0.0
    
    # Popularity features
    enrollment_count: float = 0.0
    completion_rate: float = 0.0
    engagement_score: float = 0.0
    trending_score: float = 0.0
    
    # Recency features
    content_freshness: float = 0.0
    last_updated: float = 0.0
    
    # Personalization features
    user_preference_match: float = 0.0
    skill_interest_alignment: float = 0.0
    learning_goal_alignment: float = 0.0
    historical_performance: float = 0.0
    
    # Business features
    price_score: float = 0.0
    duration_match: float = 0.0
    level_match: float = 0.0
    language_match: float = 0.0
    
    # Context features
    query_complexity: float = 0.0
    user_expertise_level: float = 0.0
    session_context: float = 0.0

@dataclass
class UserProfile:
    """User profile for personalization"""
    user_id: str
    enrolled_courses: List[str] = field(default_factory=list)
    completed_courses: List[str] = field(default_factory=list)
    preferred_categories: List[str] = field(default_factory=list)
    preferred_levels: List[str] = field(default_factory=list)
    preferred_instructors: List[str] = field(default_factory=list)
    skill_interests: List[str] = field(default_factory=list)
    learning_goals: List[str] = field(default_factory=list)
    price_sensitivity: float = 0.5  # 0 = price insensitive, 1 = very sensitive
    time_commitment: float = 0.5  # 0 = low, 1 = high
    expertise_level: float = 0.5  # 0 = beginner, 1 = expert
    search_history: List[Dict[str, Any]] = field(default_factory=list)
    interaction_data: Dict[str, float] = field(default_factory=dict)

@dataclass
class RankingContext:
    """Context for ranking calculation"""
    query: str
    user_profile: Optional[UserProfile]
    search_intent: Dict[str, Any]
    current_time: datetime
    session_data: Dict[str, Any]
    global_trends: Dict[str, float]
    seasonal_factors: Dict[str, float]

@dataclass
class RankedItem:
    """An item with ranking information"""
    item_id: str
    original_score: float
    final_score: float
    ranking_features: RankingFeatures
    explanation: List[str]
    confidence: float
    diversity_penalty: float = 0.0
    novelty_bonus: float = 0.0

@dataclass
class RankingMetrics:
    """Metrics for ranking performance"""
    accuracy: float = 0.0
    precision: float = 0.0
    recall: float = 0.0
    ndcg: float = 0.0
    diversity_score: float = 0.0
    novelty_score: float = 0.0
    coverage_score: float = 0.0
    user_satisfaction: float = 0.0
    processing_time: float = 0.0

class FeatureExtractor:
    """Extract features for ranking"""
    
    def __init__(self):
        """Initialize feature extractor"""
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=5000,
            stop_words='english',
            ngram_range=(1, 2)
        )
        self.is_fitted = False
    
    def extract_features(
        self,
        items: List[Dict[str, Any]],
        query: str,
        context: RankingContext
    ) -> List[RankingFeatures]:
        """
        Extract ranking features for items
        
        Args:
            items: List of items to rank
            query: Search query
            context: Ranking context
            
        Returns:
            List of ranking features
        """
        features = []
        
        for item in items:
            item_features = self._extract_item_features(item, query, context)
            features.append(item_features)
        
        return features
    
    def _extract_item_features(self, item: Dict[str, Any], query: str, context: RankingContext) -> RankingFeatures:
        """Extract features for a single item"""
        features = RankingFeatures()
        
        # Text relevance features
        features.text_relevance = self._calculate_text_relevance(item, query)
        features.semantic_similarity = self._calculate_semantic_similarity(item, query)
        features.keyword_match_score = self._calculate_keyword_match(item, query)
        features.phrase_match_score = self._calculate_phrase_match(item, query)
        
        # Quality features
        features.rating_score = self._normalize_rating(item.get('rating', 0))
        features.review_count_score = self._normalize_review_count(item.get('rating_count', 0))
        features.instructor_quality = self._calculate_instructor_quality(item)
        features.content_completeness = self._calculate_content_completeness(item)
        
        # Popularity features
        features.enrollment_count = self._normalize_enrollment(item.get('enrollment_count', 0))
        features.completion_rate = item.get('completion_rate', 0.5)  # Default 50%
        features.engagement_score = self._calculate_engagement_score(item)
        features.trending_score = self._calculate_trending_score(item, context)
        
        # Recency features
        features.content_freshness = self._calculate_freshness(item, context.current_time)
        features.last_updated = self._calculate_last_updated(item, context.current_time)
        
        # Personalization features
        if context.user_profile:
            features.user_preference_match = self._calculate_preference_match(item, context.user_profile)
            features.skill_interest_alignment = self._calculate_skill_alignment(item, context.user_profile)
            features.learning_goal_alignment = self._calculate_goal_alignment(item, context.user_profile)
            features.historical_performance = self._calculate_historical_performance(item, context.user_profile)
        
        # Business features
        features.price_score = self._calculate_price_score(item, context.user_profile)
        features.duration_match = self._calculate_duration_match(item, context.user_profile)
        features.level_match = self._calculate_level_match(item, context.user_profile)
        features.language_match = self._calculate_language_match(item, context.user_profile)
        
        # Context features
        features.query_complexity = self._calculate_query_complexity(query)
        if context.user_profile:
            features.user_expertise_level = context.user_profile.expertise_level
        features.session_context = self._calculate_session_context(item, context)
        
        return features
    
    def _calculate_text_relevance(self, item: Dict[str, Any], query: str) -> float:
        """Calculate text relevance score"""
        query_words = set(query.lower().split())
        
        # Get searchable text from item
        item_text = self._get_searchable_text(item)
        item_words = set(item_text.lower().split())
        
        # Calculate Jaccard similarity
        intersection = query_words.intersection(item_words)
        union = query_words.union(item_words)
        
        if not union:
            return 0.0
        
        return len(intersection) / len(union)
    
    def _calculate_semantic_similarity(self, item: Dict[str, Any], query: str) -> float:
        """Calculate semantic similarity (simplified version)"""
        # In production, this would use pre-trained embeddings
        item_text = self._get_searchable_text(item)
        
        # Simple word overlap as proxy for semantic similarity
        query_words = set(query.lower().split())
        item_words = set(item_text.lower().split())
        
        # Calculate overlap with synonyms (simplified)
        synonyms = {
            'javascript': ['js', 'ecmascript'],
            'python': ['py', 'python3'],
            'react': ['reactjs', 'react.js'],
            'machine learning': ['ml', 'artificial intelligence'],
            'web development': ['web dev', 'frontend', 'backend']
        }
        
        expanded_query = set(query_words)
        for word in query_words:
            for synonym_group in synonyms.values():
                if word in synonym_group:
                    expanded_query.update(synonym_group)
        
        intersection = expanded_query.intersection(item_words)
        return len(intersection) / len(item_words) if item_words else 0.0
    
    def _calculate_keyword_match(self, item: Dict[str, Any], query: str) -> float:
        """Calculate keyword match score"""
        query_words = query.lower().split()
        item_text = self._get_searchable_text(item).lower()
        
        matches = 0
        for word in query_words:
            if word in item_text:
                matches += 1
                # Bonus for exact word matches
                if f" {word} " in f" {item_text} ":
                    matches += 0.5
        
        return min(matches / len(query_words), 1.0) if query_words else 0.0
    
    def _calculate_phrase_match(self, item: Dict[str, Any], query: str) -> float:
        """Calculate phrase match score"""
        item_text = self._get_searchable_text(item).lower()
        query_lower = query.lower()
        
        # Exact phrase match
        if query_lower in item_text:
            return 1.0
        
        # Partial phrase matches
        query_words = query_lower.split()
        if len(query_words) >= 2:
            for i in range(len(query_words) - 1):
                phrase = f"{query_words[i]} {query_words[i+1]}"
                if phrase in item_text:
                    return 0.7
        
        return 0.0
    
    def _normalize_rating(self, rating: float) -> float:
        """Normalize rating to 0-1 scale"""
        return min(max(rating / 5.0, 0.0), 1.0)
    
    def _normalize_review_count(self, count: int) -> float:
        """Normalize review count"""
        return min(math.log(count + 1) / math.log(1000), 1.0)
    
    def _calculate_instructor_quality(self, item: Dict[str, Any]) -> float:
        """Calculate instructor quality score"""
        instructor = item.get('instructor', {})
        instructor_rating = instructor.get('rating', 0)
        
        # Normalize instructor rating
        return min(instructor_rating / 5.0, 1.0)
    
    def _calculate_content_completeness(self, item: Dict[str, Any]) -> float:
        """Calculate content completeness score"""
        completeness_factors = 0
        total_factors = 0
        
        # Check for key content elements
        if item.get('description'):
            completeness_factors += 1
        total_factors += 1
        
        if item.get('curriculum'):
            completeness_factors += 1
        total_factors += 1
        
        if item.get('objectives'):
            completeness_factors += 1
        total_factors += 1
        
        if item.get('prerequisites'):
            completeness_factors += 1
        total_factors += 1
        
        if item.get('resources'):
            completeness_factors += 1
        total_factors += 1
        
        return completeness_factors / total_factors if total_factors > 0 else 0.0
    
    def _normalize_enrollment(self, count: int) -> float:
        """Normalize enrollment count"""
        return min(math.log(count + 1) / math.log(10000), 1.0)
    
    def _calculate_engagement_score(self, item: Dict[str, Any]) -> float:
        """Calculate engagement score"""
        # Mock engagement calculation
        rating = item.get('rating', 0)
        completion_rate = item.get('completion_rate', 0.5)
        review_count = item.get('rating_count', 0)
        
        # Combine factors
        engagement = (rating / 5.0) * 0.4 + completion_rate * 0.4 + min(review_count / 100, 1.0) * 0.2
        return engagement
    
    def _calculate_trending_score(self, item: Dict[str, Any], context: RankingContext) -> float:
        """Calculate trending score based on global trends"""
        category = item.get('category', {}).get('name', '').lower()
        trend_multiplier = context.global_trends.get(category, 1.0)
        seasonal_multiplier = context.seasonal_factors.get(category, 1.0)
        
        # Base trending score
        base_score = 0.5
        
        # Apply multipliers
        return min(base_score * trend_multiplier * seasonal_multiplier, 1.0)
    
    def _calculate_freshness(self, item: Dict[str, Any], current_time: datetime) -> float:
        """Calculate content freshness score"""
        created_date = item.get('created_at')
        if not created_date:
            return 0.5  # Default score
        
        if isinstance(created_date, str):
            created_date = datetime.fromisoformat(created_date.replace('Z', '+00:00'))
        
        days_old = (current_time - created_date).days
        
        # Exponential decay
        freshness = math.exp(-days_old / 365)  # Half-life of 1 year
        return min(freshness, 1.0)
    
    def _calculate_last_updated(self, item: Dict[str, Any], current_time: datetime) -> float:
        """Calculate last updated score"""
        updated_date = item.get('updated_at')
        if not updated_date:
            return self._calculate_freshness(item, current_time)
        
        if isinstance(updated_date, str):
            updated_date = datetime.fromisoformat(updated_date.replace('Z', '+00:00'))
        
        days_old = (current_time - updated_date).days
        freshness = math.exp(-days_old / 180)  # Half-life of 6 months
        return min(freshness, 1.0)
    
    def _calculate_preference_match(self, item: Dict[str, Any], user_profile: UserProfile) -> float:
        """Calculate user preference match score"""
        score = 0.0
        total_checks = 0
        
        # Category preference
        item_category = item.get('category', {}).get('name', '').lower()
        if item_category in [cat.lower() for cat in user_profile.preferred_categories]:
            score += 1.0
        total_checks += 1
        
        # Instructor preference
        instructor_id = item.get('instructor', {}).get('id')
        if instructor_id in user_profile.preferred_instructors:
            score += 1.0
        total_checks += 1
        
        # Level preference
        item_level = item.get('level', '').lower()
        if item_level in [level.lower() for level in user_profile.preferred_levels]:
            score += 1.0
        total_checks += 1
        
        return score / total_checks if total_checks > 0 else 0.0
    
    def _calculate_skill_alignment(self, item: Dict[str, Any], user_profile: UserProfile) -> float:
        """Calculate skill interest alignment"""
        item_skills = [skill.lower() for skill in item.get('skills', [])]
        user_skills = [skill.lower() for skill in user_profile.skill_interests]
        
        if not user_skills:
            return 0.0
        
        matches = set(item_skills).intersection(set(user_skills))
        return len(matches) / len(user_skills)
    
    def _calculate_goal_alignment(self, item: Dict[str, Any], user_profile: UserProfile) -> float:
        """Calculate learning goal alignment"""
        item_objectives = [obj.lower() for obj in item.get('objectives', [])]
        user_goals = [goal.lower() for goal in user_profile.learning_goals]
        
        if not user_goals:
            return 0.0
        
        # Check if any user goal is mentioned in item objectives
        for goal in user_goals:
            for objective in item_objectives:
                if goal in objective or objective in goal:
                    return 1.0
        
        return 0.0
    
    def _calculate_historical_performance(self, item: Dict[str, Any], user_profile: UserProfile) -> float:
        """Calculate historical performance score"""
        # Check if user has interacted with similar items
        category = item.get('category', {}).get('name', '').lower()
        instructor_id = item.get('instructor', {}).get('id')
        
        # Get historical performance for this category/instructor
        category_performance = user_profile.interaction_data.get(f"category_{category}", 0.5)
        instructor_performance = user_profile.interaction_data.get(f"instructor_{instructor_id}", 0.5)
        
        return (category_performance + instructor_performance) / 2.0
    
    def _calculate_price_score(self, item: Dict[str, Any], user_profile: Optional[UserProfile]) -> float:
        """Calculate price score based on user preferences"""
        price = item.get('price', 0)
        
        if not user_profile:
            # Default: prefer free courses
            return 1.0 - min(price / 100, 1.0)
        
        price_sensitivity = user_profile.price_sensitivity
        
        if price_sensitivity > 0.7:  # Highly price sensitive
            return 1.0 - min(price / 50, 1.0)
        elif price_sensitivity > 0.3:  # Medium price sensitivity
            return 1.0 - min(price / 200, 1.0)
        else:  # Price insensitive
            return 0.8 + 0.2 * min(price / 500, 1.0)
    
    def _calculate_duration_match(self, item: Dict[str, Any], user_profile: Optional[UserProfile]) -> float:
        """Calculate duration match score"""
        duration = item.get('duration', 0)  # in hours
        
        if not user_profile:
            # Default: prefer medium duration
            return 1.0 - abs(duration - 20) / 40
        
        time_commitment = user_profile.time_commitment
        
        if time_commitment < 0.3:  # Low time commitment
            return 1.0 - min(duration / 20, 1.0)
        elif time_commitment < 0.7:  # Medium time commitment
            return 1.0 - abs(duration - 20) / 40
        else:  # High time commitment
            return min(duration / 40, 1.0)
    
    def _calculate_level_match(self, item: Dict[str, Any], user_profile: Optional[UserProfile]) -> float:
        """Calculate level match score"""
        item_level = item.get('level', '').lower()
        
        if not user_profile or not user_profile.preferred_levels:
            return 0.5  # Neutral score
        
        preferred_levels = [level.lower() for level in user_profile.preferred_levels]
        return 1.0 if item_level in preferred_levels else 0.2
    
    def _calculate_language_match(self, item: Dict[str, Any], user_profile: Optional[UserProfile]) -> float:
        """Calculate language match score"""
        item_language = item.get('language', 'en').lower()
        
        if not user_profile:
            return 1.0 if item_language == 'en' else 0.5
        
        # Assume user prefers English unless specified
        user_languages = ['en']  # Would be stored in user profile
        
        return 1.0 if item_language in user_languages else 0.3
    
    def _calculate_query_complexity(self, query: str) -> float:
        """Calculate query complexity score"""
        word_count = len(query.split())
        has_operators = any(op in query.lower() for op in ['and', 'or', 'not', 'vs', 'compare'])
        has_filters = any(filter_word in query.lower() for filter_word in ['under', 'above', 'between', 'free'])
        
        complexity = 0.0
        if word_count > 5:
            complexity += 0.3
        if has_operators:
            complexity += 0.4
        if has_filters:
            complexity += 0.3
        
        return min(complexity, 1.0)
    
    def _calculate_session_context(self, item: Dict[str, Any], context: RankingContext) -> float:
        """Calculate session context score"""
        # Mock session context calculation
        session_data = context.session_data
        
        # Check if item matches session trends
        session_categories = session_data.get('viewed_categories', [])
        item_category = item.get('category', {}).get('name', '')
        
        if item_category in session_categories:
            return 0.8
        
        return 0.5
    
    def _get_searchable_text(self, item: Dict[str, Any]) -> str:
        """Get searchable text from item"""
        text_parts = [
            item.get('title', ''),
            item.get('description', ''),
            item.get('short_description', ''),
            ' '.join(item.get('tags', [])),
            ' '.join(item.get('skills', [])),
            item.get('category', {}).get('name', ''),
            item.get('instructor', {}).get('name', ''),
            ' '.join(item.get('objectives', []))
        ]
        
        return ' '.join(filter(None, text_parts))

class MLRankingModel:
    """Machine learning ranking model"""
    
    def __init__(self, model_type: str = 'random_forest'):
        """
        Initialize ML ranking model
        
        Args:
            model_type: Type of model to use ('random_forest', 'gradient_boosting')
        """
        self.model_type = model_type
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = []
        self.is_trained = False
        
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize the ML model"""
        if self.model_type == 'random_forest':
            self.model = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )
        elif self.model_type == 'gradient_boosting':
            self.model = GradientBoostingRegressor(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                random_state=42
            )
        else:
            raise ValueError(f"Unsupported model type: {self.model_type}")
    
    def train(self, features: List[RankingFeatures], target_scores: List[float]) -> Dict[str, float]:
        """
        Train the ranking model
        
        Args:
            features: List of ranking features
            target_scores: Target relevance scores
            
        Returns:
            Training metrics
        """
        # Convert features to numpy array
        X = self._features_to_array(features)
        y = np.array(target_scores)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train model
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate
        train_score = self.model.score(X_train_scaled, y_train)
        test_score = self.model.score(X_test_scaled, y_test)
        cv_scores = cross_val_score(self.model, X_train_scaled, y_train, cv=5)
        
        self.is_trained = True
        
        metrics = {
            'train_score': train_score,
            'test_score': test_score,
            'cv_mean': cv_scores.mean(),
            'cv_std': cv_scores.std()
        }
        
        logger.info(f"Model trained - Test score: {test_score:.3f}, CV score: {cv_scores.mean():.3f}")
        
        return metrics
    
    def predict(self, features: List[RankingFeatures]) -> np.ndarray:
        """
        Predict relevance scores
        
        Args:
            features: List of ranking features
            
        Returns:
            Predicted scores
        """
        if not self.is_trained:
            raise RuntimeError("Model must be trained before prediction")
        
        X = self._features_to_array(features)
        X_scaled = self.scaler.transform(X)
        
        return self.model.predict(X_scaled)
    
    def _features_to_array(self, features: List[RankingFeatures]) -> np.ndarray:
        """Convert features to numpy array"""
        if not features:
            return np.array([]).reshape(0, 0)
        
        # Get all feature fields
        feature_fields = [
            'text_relevance', 'semantic_similarity', 'keyword_match_score', 'phrase_match_score',
            'rating_score', 'review_count_score', 'instructor_quality', 'content_completeness',
            'enrollment_count', 'completion_rate', 'engagement_score', 'trending_score',
            'content_freshness', 'last_updated', 'user_preference_match', 'skill_interest_alignment',
            'learning_goal_alignment', 'historical_performance', 'price_score', 'duration_match',
            'level_match', 'language_match', 'query_complexity', 'user_expertise_level', 'session_context'
        ]
        
        self.feature_names = feature_fields
        
        # Convert to array
        data = []
        for feature in features:
            row = [getattr(feature, field) for field in feature_fields]
            data.append(row)
        
        return np.array(data)
    
    def get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance from trained model"""
        if not self.is_trained:
            return {}
        
        if hasattr(self.model, 'feature_importances_'):
            importances = self.model.feature_importances_
            return dict(zip(self.feature_names, importances))
        
        return {}
    
    def save_model(self, filepath: str):
        """Save the trained model"""
        if not self.is_trained:
            raise RuntimeError("Model must be trained before saving")
        
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names,
            'model_type': self.model_type,
            'is_trained': self.is_trained
        }
        
        joblib.dump(model_data, filepath)
        logger.info(f"Model saved to {filepath}")
    
    def load_model(self, filepath: str):
        """Load a trained model"""
        model_data = joblib.load(filepath)
        
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.feature_names = model_data['feature_names']
        self.model_type = model_data['model_type']
        self.is_trained = model_data['is_trained']
        
        logger.info(f"Model loaded from {filepath}")

class RankingAlgorithm:
    """Main ranking algorithm class"""
    
    def __init__(self, use_ml: bool = True, model_type: str = 'random_forest'):
        """
        Initialize ranking algorithm
        
        Args:
            use_ml: Whether to use ML model for ranking
            model_type: Type of ML model to use
        """
        self.feature_extractor = FeatureExtractor()
        self.use_ml = use_ml
        self.ml_model = MLRankingModel(model_type) if use_ml else None
        
        # Ranking weights for non-ML approach
        self.ranking_weights = {
            'text_relevance': 0.20,
            'semantic_similarity': 0.15,
            'rating_score': 0.12,
            'popularity_score': 0.10,
            'personalization_score': 0.15,
            'quality_score': 0.10,
            'freshness_score': 0.08,
            'context_score': 0.10
        }
        
        # Performance tracking
        self.ranking_history = []
        self.performance_metrics = []
    
    def rank_items(
        self,
        items: List[Dict[str, Any]],
        query: str,
        context: RankingContext,
        k: int = 10
    ) -> Tuple[List[RankedItem], RankingMetrics]:
        """
        Rank items based on relevance and other factors
        
        Args:
            items: List of items to rank
            query: Search query
            context: Ranking context
            k: Number of top results to return
            
        Returns:
            Tuple of (ranked items, metrics)
        """
        start_time = datetime.now()
        
        # Extract features
        features = self.feature_extractor.extract_features(items, query, context)
        
        # Calculate scores
        if self.use_ml and self.ml_model and self.ml_model.is_trained:
            scores = self.ml_model.predict(features)
        else:
            scores = self._calculate_traditional_scores(features, context)
        
        # Create ranked items
        ranked_items = []
        for i, (item, feature, score) in enumerate(zip(items, features, scores)):
            explanation = self._generate_explanation(feature, score)
            confidence = self._calculate_confidence(feature, score)
            
            ranked_item = RankedItem(
                item_id=item.get('id', str(i)),
                original_score=item.get('score', 0.0),
                final_score=score,
                ranking_features=feature,
                explanation=explanation,
                confidence=confidence
            )
            
            ranked_items.append(ranked_item)
        
        # Apply diversity and novelty adjustments
        ranked_items = self._apply_diversity_adjustments(ranked_items, context)
        ranked_items = self._apply_novelty_adjustments(ranked_items, context)
        
        # Sort by final score
        ranked_items.sort(key=lambda x: x.final_score, reverse=True)
        
        # Limit to k results
        ranked_items = ranked_items[:k]
        
        # Calculate metrics
        processing_time = (datetime.now() - start_time).total_seconds()
        metrics = self._calculate_metrics(ranked_items, processing_time)
        
        # Store ranking history
        self.ranking_history.append({
            'query': query,
            'items_count': len(items),
            'results_count': len(ranked_items),
            'processing_time': processing_time,
            'timestamp': start_time
        })
        
        logger.info(f"Ranked {len(items)} items to {len(ranked_items)} results in {processing_time:.3f}s")
        
        return ranked_items, metrics
    
    def _calculate_traditional_scores(self, features: List[RankingFeatures], context: RankingContext) -> np.ndarray:
        """Calculate scores using traditional weighted approach"""
        scores = []
        
        for feature in features:
            score = 0.0
            
            # Apply weights
            score += feature.text_relevance * self.ranking_weights['text_relevance']
            score += feature.semantic_similarity * self.ranking_weights['semantic_similarity']
            score += feature.rating_score * self.ranking_weights['rating_score']
            
            # Combine popularity features
            popularity_score = (
                feature.enrollment_count * 0.4 +
                feature.engagement_score * 0.3 +
                feature.trending_score * 0.3
            )
            score += popularity_score * self.ranking_weights['popularity_score']
            
            # Combine personalization features
            personalization_score = (
                feature.user_preference_match * 0.4 +
                feature.skill_interest_alignment * 0.3 +
                feature.learning_goal_alignment * 0.3
            )
            score += personalization_score * self.ranking_weights['personalization_score']
            
            # Combine quality features
            quality_score = (
                feature.instructor_quality * 0.3 +
                feature.content_completeness * 0.4 +
                feature.review_count_score * 0.3
            )
            score += quality_score * self.ranking_weights['quality_score']
            
            # Combine freshness features
            freshness_score = (
                feature.content_freshness * 0.6 +
                feature.last_updated * 0.4
            )
            score += freshness_score * self.ranking_weights['freshness_score']
            
            # Context score
            context_score = (
                feature.query_complexity * 0.3 +
                feature.session_context * 0.7
            )
            score += context_score * self.ranking_weights['context_score']
            
            scores.append(min(score, 1.0))
        
        return np.array(scores)
    
    def _apply_diversity_adjustments(self, items: List[RankedItem], context: RankingContext) -> List[RankedItem]:
        """Apply diversity adjustments to ranking"""
        category_count = defaultdict(int)
        instructor_count = defaultdict(int)
        
        for item in items:
            # Would need to access original item data for categories/instructors
            # For now, apply generic diversity penalty
            category_count[item.item_id] += 1
            instructor_count[item.item_id] += 1
        
        # Apply penalties for over-representation
        for item in items:
            if category_count[item.item_id] > 2:
                item.diversity_penalty = 0.1
            if instructor_count[item.item_id] > 1:
                item.diversity_penalty += 0.05
            
            # Adjust final score
            item.final_score *= (1.0 - item.diversity_penalty)
        
        return items
    
    def _apply_novelty_adjustments(self, items: List[RankedItem], context: RankingContext) -> List[RankedItem]:
        """Apply novelty adjustments to ranking"""
        # Boost newer or less popular items slightly
        for item in items:
            if item.ranking_features.trending_score < 0.3:
                item.novelty_bonus = 0.1
                item.final_score *= (1.0 + item.novelty_bonus)
        
        return items
    
    def _generate_explanation(self, features: RankingFeatures, score: float) -> List[str]:
        """Generate explanation for ranking score"""
        explanations = []
        
        if features.text_relevance > 0.7:
            explanations.append("Highly relevant to search terms")
        
        if features.semantic_similarity > 0.6:
            explanations.append("Semantically similar to query")
        
        if features.rating_score > 0.8:
            explanations.append("Excellent user ratings")
        
        if features.enrollment_count > 0.7:
            explanations.append("Popular among students")
        
        if features.user_preference_match > 0.5:
            explanations.append("Matches your preferences")
        
        if features.skill_interest_alignment > 0.5:
            explanations.append("Aligns with your skill interests")
        
        if features.price_score > 0.8:
            explanations.append("Great value for money")
        
        if features.content_freshness > 0.7:
            explanations.append("Recently updated content")
        
        return explanations
    
    def _calculate_confidence(self, features: RankingFeatures, score: float) -> float:
        """Calculate confidence in ranking score"""
        # Base confidence on score consistency and feature completeness
        feature_values = [
            features.text_relevance, features.semantic_similarity, features.rating_score,
            features.enrollment_count, features.user_preference_match
        ]
        
        # Calculate variance (lower variance = higher confidence)
        mean_val = np.mean(feature_values)
        variance = np.var(feature_values)
        
        confidence = 1.0 - min(variance, 1.0)
        
        # Boost confidence for high scores
        if score > 0.8:
            confidence += 0.1
        
        return min(confidence, 1.0)
    
    def _calculate_metrics(self, ranked_items: List[RankedItem], processing_time: float) -> RankingMetrics:
        """Calculate ranking metrics"""
        if not ranked_items:
            return RankingMetrics(processing_time=processing_time)
        
        # Calculate diversity
        categories = set()  # Would extract from item data
        instructors = set()  # Would extract from item data
        diversity_score = (len(categories) + len(instructors)) / (len(ranked_items) * 2)
        
        # Calculate novelty
        novelty_items = [item for item in ranked_items if item.novelty_bonus > 0]
        novelty_score = len(novelty_items) / len(ranked_items)
        
        # Calculate coverage
        levels = set()  # Would extract from item data
        price_ranges = set()  # Would extract from item data
        coverage_score = (len(levels) + len(price_ranges)) / 10
        
        # Average confidence
        avg_confidence = np.mean([item.confidence for item in ranked_items])
        
        return RankingMetrics(
            diversity_score=diversity_score,
            novelty_score=novelty_score,
            coverage_score=coverage_score,
            processing_time=processing_time,
            accuracy=avg_confidence  # Mock accuracy
        )
    
    def train_model(self, training_data: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        Train the ML ranking model
        
        Args:
            training_data: List of training examples with features and target scores
            
        Returns:
            Training metrics
        """
        if not self.use_ml or not self.ml_model:
            raise RuntimeError("ML ranking not enabled")
        
        # Extract features and targets from training data
        features = []
        targets = []
        
        for example in training_data:
            # Convert training example to RankingFeatures
            feature_data = example.get('features', {})
            feature = RankingFeatures(**feature_data)
            features.append(feature)
            targets.append(example.get('target_score', 0.0))
        
        # Train model
        metrics = self.ml_model.train(features, targets)
        
        logger.info("ML ranking model trained successfully")
        return metrics
    
    def save_model(self, filepath: str):
        """Save the ranking model"""
        if self.ml_model:
            self.ml_model.save_model(filepath)
    
    def load_model(self, filepath: str):
        """Load the ranking model"""
        if self.ml_model:
            self.ml_model.load_model(filepath)
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get ranking statistics"""
        if not self.ranking_history:
            return {
                "total_rankings": 0,
                "average_processing_time": 0,
                "average_items_per_ranking": 0,
                "feature_importance": {}
            }
        
        total_rankings = len(self.ranking_history)
        avg_processing_time = np.mean([r['processing_time'] for r in self.ranking_history])
        avg_items = np.mean([r['items_count'] for r in self.ranking_history])
        
        feature_importance = {}
        if self.ml_model and self.ml_model.is_trained:
            feature_importance = self.ml_model.get_feature_importance()
        
        return {
            "total_rankings": total_rankings,
            "average_processing_time": avg_processing_time,
            "average_items_per_ranking": avg_items,
            "feature_importance": feature_importance,
            "model_type": self.ml_model.model_type if self.ml_model else "traditional",
            "use_ml": self.use_ml
        }

# Example usage and testing
if __name__ == "__main__":
    # Create sample items
    sample_items = [
        {
            "id": "1",
            "title": "Python Programming for Beginners",
            "description": "Learn Python from scratch with hands-on exercises",
            "rating": 4.5,
            "rating_count": 1200,
            "enrollment_count": 5000,
            "category": {"name": "Programming"},
            "level": "beginner",
            "price": 29.99,
            "duration": 20,
            "skills": ["python", "programming"],
            "instructor": {"name": "John Doe", "rating": 4.7}
        },
        {
            "id": "2",
            "title": "Advanced Machine Learning",
            "description": "Deep dive into ML algorithms and neural networks",
            "rating": 4.8,
            "rating_count": 800,
            "enrollment_count": 2000,
            "category": {"name": "Data Science"},
            "level": "advanced",
            "price": 99.99,
            "duration": 40,
            "skills": ["machine learning", "python"],
            "instructor": {"name": "Jane Smith", "rating": 4.9}
        }
    ]
    
    # Create ranking context
    user_profile = UserProfile(
        user_id="user123",
        preferred_categories=["Programming"],
        skill_interests=["python"],
        price_sensitivity=0.7
    )
    
    context = RankingContext(
        query="python programming",
        user_profile=user_profile,
        search_intent={"type": "skill_search", "confidence": 0.8},
        current_time=datetime.now(),
        session_data={},
        global_trends={"programming": 1.2},
        seasonal_factors={"programming": 1.0}
    )
    
    # Initialize ranking algorithm
    algorithm = RankingAlgorithm(use_ml=False)
    
    # Rank items
    ranked_items, metrics = algorithm.rank_items(sample_items, "python programming", context, k=5)
    
    print("Ranking Results:")
    print("=" * 50)
    
    for i, item in enumerate(ranked_items, 1):
        print(f"{i}. Item {item.item_id}: {item.final_score:.3f}")
        print(f"   Confidence: {item.confidence:.3f}")
        if item.explanation:
            print(f"   Reasons: {', '.join(item.explanation)}")
        print()
    
    print("Metrics:")
    print(f"Processing time: {metrics.processing_time:.3f}s")
    print(f"Diversity score: {metrics.diversity_score:.3f}")
    print(f"Novelty score: {metrics.novelty_score:.3f}")
    
    # Print statistics
    print("\nAlgorithm Statistics:")
    stats = algorithm.get_statistics()
    for key, value in stats.items():
        print(f"{key}: {value}")
