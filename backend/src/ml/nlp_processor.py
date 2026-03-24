"""
Natural Language Processor Module
Advanced NLP processing for query understanding, intent recognition, and multilingual support
"""

import re
import spacy
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.stem import WordNetLemmatizer
from nltk.sentiment import SentimentIntensityAnalyzer
from typing import Dict, List, Tuple, Optional, Any, Set
import json
import logging
from datetime import datetime
from dataclasses import dataclass
from abc import ABC, abstractmethod
import pickle
from pathlib import Path
from collections import Counter, defaultdict
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Download required NLTK data
try:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
    nltk.download('wordnet', quiet=True)
    nltk.download('vader_lexicon', quiet=True)
except Exception as e:
    logger.warning(f"NLTK download failed: {e}")

@dataclass
class QueryEntity:
    """Represents an extracted entity from a query"""
    text: str
    label: str
    start: int
    end: int
    confidence: float
    normalized_value: Optional[str] = None

@dataclass
class SearchIntent:
    """Represents the recognized search intent"""
    type: str
    confidence: float
    entities: Dict[str, Any]
    sentiment: str
    urgency: str
    complexity: str
    language: str
    keywords: List[str]
    phrases: List[str]

@dataclass
class ProcessedQuery:
    """Represents a processed query with all NLP analysis"""
    original_query: str
    processed_query: str
    language: str
    intent: SearchIntent
    entities: List[QueryEntity]
    suggestions: List[str]
    confidence: float
    processing_time: float

@dataclass
class NLPMetrics:
    """NLP processing metrics"""
    processing_time: float
    entity_extraction_time: float
    intent_recognition_time: float
    sentiment_analysis_time: float
    language_detection_time: float
    total_entities: int
    confidence_score: float

class LanguageDetector:
    """Language detection using statistical methods"""
    
    def __init__(self):
        """Initialize language detector"""
        self.language_patterns = {
            'en': {
                'common_words': {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'},
                'pattern': re.compile(r'\b(the|and|or|but|in|on|at|to|for|of|with|by)\b', re.IGNORECASE)
            },
            'es': {
                'common_words': {'el', 'la', 'y', 'o', 'pero', 'en', 'de', 'para', 'con', 'por'},
                'pattern': re.compile(r'\b(el|la|y|o|pero|en|de|para|con|por)\b', re.IGNORECASE)
            },
            'fr': {
                'common_words': {'le', 'la', 'et', 'ou', 'mais', 'dans', 'de', 'pour', 'avec', 'par'},
                'pattern': re.compile(r'\b(le|la|et|ou|mais|dans|de|pour|avec|par)\b', re.IGNORECASE)
            },
            'de': {
                'common_words': {'der', 'die', 'das', 'und', 'oder', 'aber', 'in', 'zu', 'für', 'mit', 'von'},
                'pattern': re.compile(r'\b(der|die|das|und|oder|aber|in|zu|für|mit|von)\b', re.IGNORECASE)
            }
        }
    
    def detect_language(self, text: str) -> Tuple[str, float]:
        """
        Detect the language of the given text
        
        Args:
            text: Text to analyze
            
        Returns:
            Tuple of (language_code, confidence)
        """
        text_lower = text.lower()
        language_scores = {}
        
        for lang_code, lang_data in self.language_patterns.items():
            matches = len(lang_data['pattern'].findall(text_lower))
            word_count = len(text_lower.split())
            
            if word_count > 0:
                score = matches / word_count
                language_scores[lang_code] = score
        
        if not language_scores:
            return 'en', 0.5  # Default to English
        
        best_language = max(language_scores, key=language_scores.get)
        confidence = language_scores[best_language]
        
        return best_language, min(confidence * 2, 1.0)  # Scale confidence

class EntityExtractor:
    """Entity extraction using patterns and rules"""
    
    def __init__(self):
        """Initialize entity extractor"""
        # Load spaCy model if available
        try:
            self.nlp = spacy.load("en_core_web_sm")
            self.use_spacy = True
        except OSError:
            logger.warning("spaCy model not found, using rule-based extraction")
            self.nlp = None
            self.use_spacy = False
        
        # Define patterns for different entity types
        self.patterns = {
            'skill': [
                re.compile(r'\b(javascript|python|java|react|node\.?js|html|css|sql|mongodb|aws|docker|kubernetes|git|machine learning|artificial intelligence|data science|web development|mobile development|devops|testing|ui|ux|design|blockchain|security)\b', re.IGNORECASE),
                re.compile(r'\b(angular|vue\.?js|django|flask|spring|laravel|rails|express|next\.?js|gatsby)\b', re.IGNORECASE)
            ],
            'level': [
                re.compile(r'\b(beginner|intro|introduction|basic|fundamentals|intermediate|advanced|expert|professional|master)\b', re.IGNORECASE)
            ],
            'price': [
                re.compile(r'\$(\d+)(?:\s*[-to]\s*\$?(\d+))?'),
                re.compile(r'(\d+)\s*(?:dollars?|usd)\s*(?:[-to]\s*(\d+)\s*(?:dollars?|usd))?'),
                re.compile(r'\b(free|no cost|complimentary)\b', re.IGNORECASE)
            ],
            'duration': [
                re.compile(r'(\d+)\s*(?:hours?|hrs?)\s*(?:[-to]\s*(\d+)\s*(?:hours?|hrs?))?'),
                re.compile(r'(\d+)\s*(?:days?)\s*(?:[-to]\s*(\d+)\s*(?:days?))?'),
                re.compile(r'(\d+)\s*(?:weeks?)\s*(?:[-to]\s*(\d+)\s*(?:weeks?))?')
            ],
            'rating': [
                re.compile(r'(\d+)\s*(?:stars?|rating)', re.IGNORECASE),
                re.compile(r'rating\s*[:]\s*(\d+)', re.IGNORECASE)
            ],
            'category': [
                re.compile(r'\b(programming|coding|development|software|design|ui|ux|graphic|creative|business|marketing|sales|finance|entrepreneurship|data science|analytics|big data|statistics|web development|website|frontend|backend|fullstack)\b', re.IGNORECASE)
            ],
            'language': [
                re.compile(r'\b(english|spanish|french|german|chinese|japanese|korean|arabic|russian|portuguese)\b', re.IGNORECASE)
            ]
        }
        
        # Skill keywords for fuzzy matching
        self.skill_keywords = {
            'javascript', 'python', 'java', 'react', 'nodejs', 'html', 'css', 'sql',
            'mongodb', 'aws', 'docker', 'kubernetes', 'git', 'machine learning',
            'artificial intelligence', 'data science', 'web development',
            'mobile development', 'devops', 'testing', 'ui', 'ux', 'design',
            'blockchain', 'security', 'angular', 'vuejs', 'django', 'flask',
            'spring', 'laravel', 'rails', 'express', 'nextjs', 'gatsby'
        }
    
    def extract_entities(self, text: str, language: str = 'en') -> List[QueryEntity]:
        """
        Extract entities from the given text
        
        Args:
            text: Text to analyze
            language: Language code
            
        Returns:
            List of extracted entities
        """
        entities = []
        
        # Use spaCy if available
        if self.use_spacy and language == 'en':
            entities.extend(self._extract_with_spacy(text))
        
        # Use pattern-based extraction
        entities.extend(self._extract_with_patterns(text))
        
        # Remove duplicates and sort by confidence
        unique_entities = self._deduplicate_entities(entities)
        unique_entities.sort(key=lambda x: x.confidence, reverse=True)
        
        return unique_entities
    
    def _extract_with_spacy(self, text: str) -> List[QueryEntity]:
        """Extract entities using spaCy"""
        entities = []
        
        try:
            doc = self.nlp(text)
            
            for ent in doc.ents:
                # Map spaCy labels to our entity types
                label_map = {
                    'PERSON': 'instructor',
                    'ORG': 'organization',
                    'PRODUCT': 'tool',
                    'EVENT': 'event',
                    'WORK_OF_ART': 'content',
                    'LANGUAGE': 'language',
                    'GPE': 'location',
                    'MONEY': 'price',
                    'QUANTITY': 'duration',
                    'ORDINAL': 'level',
                    'CARDINAL': 'number'
                }
                
                entity_label = label_map.get(ent.label_, 'unknown')
                
                entity = QueryEntity(
                    text=ent.text,
                    label=entity_label,
                    start=ent.start_char,
                    end=ent.end_char,
                    confidence=0.8,  # spaCy confidence
                    normalized_value=ent.text.lower()
                )
                
                entities.append(entity)
        
        except Exception as e:
            logger.warning(f"spaCy entity extraction failed: {e}")
        
        return entities
    
    def _extract_with_patterns(self, text: str) -> List[QueryEntity]:
        """Extract entities using regex patterns"""
        entities = []
        
        for entity_type, patterns in self.patterns.items():
            for pattern in patterns:
                matches = pattern.finditer(text)
                
                for match in matches:
                    # Determine confidence based on pattern specificity
                    confidence = 0.7
                    if entity_type == 'skill':
                        if match.group().lower() in self.skill_keywords:
                            confidence = 0.9
                    
                    # Normalize the value
                    normalized_value = self._normalize_entity_value(
                        match.group(), entity_type, match
                    )
                    
                    entity = QueryEntity(
                        text=match.group(),
                        label=entity_type,
                        start=match.start(),
                        end=match.end(),
                        confidence=confidence,
                        normalized_value=normalized_value
                    )
                    
                    entities.append(entity)
        
        return entities
    
    def _normalize_entity_value(self, text: str, entity_type: str, match) -> Optional[str]:
        """Normalize entity value"""
        text_lower = text.lower()
        
        if entity_type == 'skill':
            return text_lower.replace(' ', '').replace('.', '')
        elif entity_type == 'level':
            if text_lower in ['beginner', 'intro', 'introduction', 'basic', 'fundamentals']:
                return 'beginner'
            elif text_lower == 'intermediate':
                return 'intermediate'
            elif text_lower in ['advanced', 'expert', 'professional', 'master']:
                return 'advanced'
        elif entity_type == 'price':
            if 'free' in text_lower or 'no cost' in text_lower:
                return '0'
            elif match.groups():
                return match.group(1)  # Return the first price value
        elif entity_type == 'duration':
            if match.groups():
                return match.group(1)  # Return the first duration value
        elif entity_type == 'rating':
            if match.groups():
                return match.group(1)
        
        return text_lower
    
    def _deduplicate_entities(self, entities: List[QueryEntity]) -> List[QueryEntity]:
        """Remove duplicate entities"""
        seen = set()
        unique_entities = []
        
        for entity in entities:
            # Create a key for deduplication
            key = (entity.label, entity.normalized_value or entity.text.lower())
            
            if key not in seen:
                seen.add(key)
                unique_entities.append(entity)
        
        return unique_entities

class IntentRecognizer:
    """Intent recognition using pattern matching and ML"""
    
    def __init__(self):
        """Initialize intent recognizer"""
        self.intent_patterns = {
            'skill_search': [
                (re.compile(r'\b(how\s+to|learn|master|study|training|tutorial|course)\b', re.IGNORECASE), 0.8),
                (re.compile(r'\b(want\s+to|need\s+to|looking\s+to)\s+(learn|study|master)\b', re.IGNORECASE), 0.9)
            ],
            'career_path': [
                (re.compile(r'\b(career|path|roadmap|become|professional|job)\b', re.IGNORECASE), 0.8),
                (re.compile(r'\b(want\s+to\s+be|become\s+a|career\s+in)\b', re.IGNORECASE), 0.9)
            ],
            'comparison': [
                (re.compile(r'\b(compare|vs|versus|difference|better|best|which\s+is)\b', re.IGNORECASE), 0.8),
                (re.compile(r'\b(\w+)\s+(vs|versus|or)\s+(\w+)\b', re.IGNORECASE), 0.9)
            ],
            'recommendation': [
                (re.compile(r'\b(recommend|suggest|show\s+me|what\s+should|give\s+me)\b', re.IGNORECASE), 0.8),
                (re.compile(r'\b(looking\s+for|searching\s+for|need)\b', re.IGNORECASE), 0.7)
            ],
            'filter_query': [
                (re.compile(r'\b(under|below|above|more\s+than|less\s+than|between|cheap|expensive|free)\b', re.IGNORECASE), 0.7),
                (re.compile(r'\b(\$\d+|\d+\s+dollars?)\b', re.IGNORECASE), 0.8)
            ],
            'course_search': [
                (re.compile(r'\b(course|class|lesson|tutorial|training)\b', re.IGNORECASE), 0.6)
            ]
        }
        
        # Default intent if no patterns match
        self.default_intent = 'course_search'
    
    def recognize_intent(self, text: str, entities: List[QueryEntity]) -> SearchIntent:
        """
        Recognize the intent of the given text
        
        Args:
            text: Text to analyze
            entities: Extracted entities
            
        Returns:
            Recognized intent
        """
        text_lower = text.lower()
        intent_scores = {}
        
        # Check each intent pattern
        for intent_type, patterns in self.intent_patterns.items():
            max_confidence = 0.0
            
            for pattern, confidence in patterns:
                if pattern.search(text_lower):
                    max_confidence = max(max_confidence, confidence)
            
            if max_confidence > 0:
                intent_scores[intent_type] = max_confidence
        
        # Determine best intent
        if intent_scores:
            best_intent = max(intent_scores, key=intent_scores.get)
            confidence = intent_scores[best_intent]
        else:
            best_intent = self.default_intent
            confidence = 0.5
        
        # Analyze sentiment
        sentiment = self._analyze_sentiment(text)
        
        # Analyze urgency
        urgency = self._analyze_urgency(text)
        
        # Analyze complexity
        complexity = self._analyze_complexity(text, entities)
        
        # Extract keywords and phrases
        keywords, phrases = self._extract_keywords_phrases(text)
        
        # Create entities dictionary
        entities_dict = {}
        for entity in entities:
            if entity.label not in entities_dict:
                entities_dict[entity.label] = []
            entities_dict[entity.label].append(entity.normalized_value or entity.text)
        
        return SearchIntent(
            type=best_intent,
            confidence=confidence,
            entities=entities_dict,
            sentiment=sentiment,
            urgency=urgency,
            complexity=complexity,
            language='en',  # Would be detected separately
            keywords=keywords,
            phrases=phrases
        )
    
    def _analyze_sentiment(self, text: str) -> str:
        """Analyze sentiment of text"""
        try:
            sia = SentimentIntensityAnalyzer()
            scores = sia.polarity_scores(text)
            
            if scores['compound'] >= 0.05:
                return 'positive'
            elif scores['compound'] <= -0.05:
                return 'negative'
            else:
                return 'neutral'
        except:
            # Fallback to simple keyword-based sentiment
            positive_words = {'best', 'excellent', 'amazing', 'great', 'awesome', 'fantastic', 'good', 'love'}
            negative_words = {'bad', 'terrible', 'awful', 'hate', 'worst', 'poor', 'disappointing'}
            
            text_lower = text.lower()
            positive_count = sum(1 for word in positive_words if word in text_lower)
            negative_count = sum(1 for word in negative_words if word in text_lower)
            
            if positive_count > negative_count:
                return 'positive'
            elif negative_count > positive_count:
                return 'negative'
            else:
                return 'neutral'
    
    def _analyze_urgency(self, text: str) -> str:
        """Analyze urgency of text"""
        urgent_words = {'urgent', 'asap', 'immediately', 'now', 'quick', 'fast', 'soon'}
        text_lower = text.lower()
        
        urgent_count = sum(1 for word in urgent_words if word in text_lower)
        
        if urgent_count >= 2:
            return 'high'
        elif urgent_count >= 1:
            return 'medium'
        else:
            return 'low'
    
    def _analyze_complexity(self, text: str, entities: List[QueryEntity]) -> str:
        """Analyze complexity of query"""
        word_count = len(text.split())
        entity_count = len(entities)
        
        if word_count <= 3 and entity_count <= 1:
            return 'simple'
        elif word_count <= 8 and entity_count <= 3:
            return 'moderate'
        else:
            return 'complex'
    
    def _extract_keywords_phrases(self, text: str) -> Tuple[List[str], List[str]]:
        """Extract keywords and phrases from text"""
        # Simple keyword extraction (would use more sophisticated methods in production)
        stop_words = set(stopwords.words('english'))
        words = word_tokenize(text.lower())
        keywords = [word for word in words if word.isalpha() and word not in stop_words and len(word) > 2]
        
        # Extract phrases (quoted text and common patterns)
        phrases = []
        quoted_phrases = re.findall(r'"([^"]+)"', text)
        phrases.extend(quoted_phrases)
        
        # Common skill/technology phrases
        skill_phrases = re.findall(r'\b(machine learning|artificial intelligence|web development|mobile development|data science|user interface|user experience)\b', text, re.IGNORECASE)
        phrases.extend(skill_phrases)
        
        return keywords, phrases

class QueryProcessor:
    """Main query processing class"""
    
    def __init__(self):
        """Initialize query processor"""
        self.language_detector = LanguageDetector()
        self.entity_extractor = EntityExtractor()
        self.intent_recognizer = IntentRecognizer()
        self.lemmatizer = WordNetLemmatizer()
        
        # Cache for processed queries
        self.processing_cache = {}
        self.cache_size = 1000
    
    def process_query(self, query: str) -> ProcessedQuery:
        """
        Process a natural language query
        
        Args:
            query: Query to process
            
        Returns:
            Processed query with all NLP analysis
        """
        start_time = datetime.now()
        
        # Check cache
        if query in self.processing_cache:
            cached_result = self.processing_cache[query]
            cached_result.processing_time = (datetime.now() - start_time).total_seconds()
            return cached_result
        
        # Detect language
        language, language_confidence = self.language_detector.detect_language(query)
        
        # Extract entities
        entities = self.entity_extractor.extract_entities(query, language)
        
        # Recognize intent
        intent = self.intent_recognizer.recognize_intent(query, entities)
        
        # Process query (normalize, lemmatize, etc.)
        processed_query = self._normalize_query(query, language)
        
        # Generate suggestions
        suggestions = self._generate_suggestions(query, intent, entities)
        
        # Calculate overall confidence
        confidence = self._calculate_confidence(intent, entities, language_confidence)
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        result = ProcessedQuery(
            original_query=query,
            processed_query=processed_query,
            language=language,
            intent=intent,
            entities=entities,
            suggestions=suggestions,
            confidence=confidence,
            processing_time=processing_time
        )
        
        # Update cache
        self._update_cache(query, result)
        
        logger.info(f"Processed query: '{query}' -> {intent.type} (confidence: {confidence:.2f}, time: {processing_time:.3f}s)")
        
        return result
    
    def _normalize_query(self, query: str, language: str) -> str:
        """Normalize query for better search"""
        # Convert to lowercase
        normalized = query.lower()
        
        # Remove extra whitespace
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        
        # Expand common abbreviations
        abbreviations = {
            'js': 'javascript',
            'py': 'python',
            'ml': 'machine learning',
            'ai': 'artificial intelligence',
            'ui': 'user interface',
            'ux': 'user experience'
        }
        
        for abbr, full in abbreviations.items():
            normalized = re.sub(r'\b' + re.escape(abbr) + r'\b', full, normalized)
        
        return normalized
    
    def _generate_suggestions(self, query: str, intent: SearchIntent, entities: List[QueryEntity]) -> List[str]:
        """Generate search suggestions"""
        suggestions = []
        
        # Auto-completion based on entities
        for entity in entities:
            if entity.label == 'skill':
                suggestions.extend([
                    f"advanced {entity.text}",
                    f"{entity.text} for beginners",
                    f"{entity.text} projects",
                    f"{entity.text} tutorial"
                ])
        
        # Intent-based suggestions
        if intent.type == 'skill_search':
            suggestions.extend([
                f"learn {query}",
                f"{query} course",
                f"{query} tutorial"
            ])
        elif intent.type == 'career_path':
            suggestions.extend([
                f"{query} career path",
                f"how to become {query}",
                f"{query} professional"
            ])
        
        # Remove duplicates and limit
        unique_suggestions = list(set(suggestions))[:5]
        return unique_suggestions
    
    def _calculate_confidence(self, intent: SearchIntent, entities: List[QueryEntity], language_confidence: float) -> float:
        """Calculate overall processing confidence"""
        confidence = 0.5  # Base confidence
        
        # Intent confidence
        confidence += intent.confidence * 0.3
        
        # Entity extraction confidence
        if entities:
            avg_entity_confidence = sum(e.confidence for e in entities) / len(entities)
            confidence += avg_entity_confidence * 0.2
        
        # Language detection confidence
        confidence += language_confidence * 0.1
        
        return min(confidence, 1.0)
    
    def _update_cache(self, query: str, result: ProcessedQuery):
        """Update processing cache"""
        if len(self.processing_cache) >= self.cache_size:
            # Remove oldest entry
            oldest_key = next(iter(self.processing_cache))
            del self.processing_cache[oldest_key]
        
        self.processing_cache[query] = result
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get processing statistics"""
        if not self.processing_cache:
            return {
                "total_queries": 0,
                "average_processing_time": 0,
                "cache_hit_rate": 0,
                "common_intents": {},
                "common_entities": {}
            }
        
        total_queries = len(self.processing_cache)
        avg_processing_time = np.mean([q.processing_time for q in self.processing_cache.values()])
        
        # Analyze common intents
        intent_counts = Counter([q.intent.type for q in self.processing_cache.values()])
        
        # Analyze common entities
        entity_counts = Counter()
        for query in self.processing_cache.values():
            for entity in query.entities:
                entity_counts[entity.label] += 1
        
        return {
            "total_queries": total_queries,
            "average_processing_time": avg_processing_time,
            "cache_hit_rate": 0.0,  # Would be tracked separately
            "common_intents": dict(intent_counts.most_common(5)),
            "common_entities": dict(entity_counts.most_common(5))
        }

# Example usage and testing
if __name__ == "__main__":
    # Create processor
    processor = QueryProcessor()
    
    # Test queries
    test_queries = [
        "I want to learn Python programming",
        "Find advanced React courses under $50",
        "Compare JavaScript vs Python for web development",
        "Show me machine learning tutorials for beginners",
        "Free data science courses with high ratings"
    ]
    
    print("Testing NLP Processor:")
    print("=" * 50)
    
    for query in test_queries:
        result = processor.process_query(query)
        
        print(f"\nQuery: {query}")
        print(f"Intent: {result.intent.type} (confidence: {result.intent.confidence:.2f})")
        print(f"Language: {result.language}")
        print(f"Entities: {[f'{e.label}:{e.text}' for e in result.entities]}")
        print(f"Sentiment: {result.intent.sentiment}")
        print(f"Complexity: {result.intent.complexity}")
        print(f"Processing time: {result.processing_time:.3f}s")
        
        if result.suggestions:
            print(f"Suggestions: {result.suggestions}")
    
    # Print statistics
    print("\n" + "=" * 50)
    print("Processor Statistics:")
    stats = processor.get_statistics()
    for key, value in stats.items():
        print(f"{key}: {value}")
