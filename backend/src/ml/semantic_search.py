"""
Semantic Search Module
Advanced semantic search implementation using sentence transformers and vector similarity
"""

import numpy as np
import torch
from sentence_transformers import SentenceTransformer, util
from typing import List, Dict, Tuple, Optional, Any
import json
import logging
from datetime import datetime
import pickle
from pathlib import Path
import faiss
from dataclasses import dataclass
from abc import ABC, abstractmethod

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class Document:
    """Represents a searchable document"""
    id: str
    content: str
    metadata: Dict[str, Any]
    embedding: Optional[np.ndarray] = None
    content_type: str = "text"

@dataclass
class SearchResult:
    """Represents a search result with similarity score"""
    document: Document
    score: float
    explanation: str

@dataclass
class SearchMetrics:
    """Search performance metrics"""
    query_time: float
    index_time: float
    total_documents: int
    results_returned: int
    average_similarity: float
    cache_hit: bool = False

class EmbeddingModel(ABC):
    """Abstract base class for embedding models"""
    
    @abstractmethod
    def encode(self, texts: List[str]) -> np.ndarray:
        """Encode texts into embeddings"""
        pass
    
    @abstractmethod
    def get_dimension(self) -> int:
        """Get embedding dimension"""
        pass

class SentenceTransformerModel(EmbeddingModel):
    """Sentence transformer implementation for embeddings"""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize the sentence transformer model
        
        Args:
            model_name: Name of the pre-trained model to use
        """
        self.model_name = model_name
        self.model = SentenceTransformer(model_name)
        self.dimension = self.model.get_sentence_embedding_dimension()
        logger.info(f"Loaded sentence transformer model: {model_name} (dimension: {self.dimension})")
    
    def encode(self, texts: List[str]) -> np.ndarray:
        """
        Encode texts into embeddings
        
        Args:
            texts: List of texts to encode
            
        Returns:
            Numpy array of embeddings
        """
        try:
            embeddings = self.model.encode(
                texts,
                batch_size=32,
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=True
            )
            return embeddings
        except Exception as e:
            logger.error(f"Error encoding texts: {str(e)}")
            raise
    
    def get_dimension(self) -> int:
        """Get embedding dimension"""
        return self.dimension

class VectorIndex:
    """FAISS-based vector index for efficient similarity search"""
    
    def __init__(self, dimension: int, index_type: str = "flat"):
        """
        Initialize vector index
        
        Args:
            dimension: Embedding dimension
            index_type: Type of FAISS index to use
        """
        self.dimension = dimension
        self.index_type = index_type
        self.index = None
        self.documents = []
        self.document_map = {}
        
        self._create_index()
    
    def _create_index(self):
        """Create FAISS index based on type"""
        if self.index_type == "flat":
            self.index = faiss.IndexFlatIP(self.dimension)  # Inner product for normalized embeddings
        elif self.index_type == "ivf":
            nlist = min(100, len(self.documents) // 10) if self.documents else 100
            quantizer = faiss.IndexFlatIP(self.dimension)
            self.index = faiss.IndexIVFFlat(quantizer, self.dimension, nlist)
        elif self.index_type == "hnsw":
            self.index = faiss.IndexHNSWFlat(self.dimension, 32)
        else:
            raise ValueError(f"Unsupported index type: {self.index_type}")
        
        logger.info(f"Created {self.index_type} index with dimension {self.dimension}")
    
    def add_documents(self, documents: List[Document]):
        """
        Add documents to the index
        
        Args:
            documents: List of documents to add
        """
        if not documents:
            return
        
        # Extract embeddings
        embeddings = np.array([doc.embedding for doc in documents if doc.embedding is not None])
        
        if len(embeddings) == 0:
            logger.warning("No embeddings found in documents")
            return
        
        # Add to FAISS index
        start_idx = len(self.documents)
        self.index.add(embeddings)
        
        # Update document mappings
        for i, doc in enumerate(documents):
            if doc.embedding is not None:
                self.document_map[start_idx + i] = doc
                self.documents.append(doc)
        
        logger.info(f"Added {len(documents)} documents to index (total: {len(self.documents)})")
    
    def search(self, query_embedding: np.ndarray, k: int = 10) -> List[Tuple[Document, float]]:
        """
        Search for similar documents
        
        Args:
            query_embedding: Query embedding
            k: Number of results to return
            
        Returns:
            List of (document, score) tuples
        """
        if self.index.ntotal == 0:
            return []
        
        # Ensure query embedding is 2D
        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)
        
        # Search
        scores, indices = self.index.search(query_embedding, k)
        
        # Convert to results
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and idx in self.document_map:
                doc = self.document_map[idx]
                results.append((doc, float(score)))
        
        return results
    
    def save(self, filepath: str):
        """Save index to file"""
        faiss.write_index(self.index, filepath)
        with open(f"{filepath}_documents.pkl", 'wb') as f:
            pickle.dump(self.document_map, f)
        logger.info(f"Saved index to {filepath}")
    
    def load(self, filepath: str):
        """Load index from file"""
        self.index = faiss.read_index(filepath)
        with open(f"{filepath}_documents.pkl", 'rb') as f:
            self.document_map = pickle.load(f)
        self.documents = list(self.document_map.values())
        logger.info(f"Loaded index from {filepath} with {len(self.documents)} documents")

class SemanticSearchEngine:
    """Main semantic search engine class"""
    
    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        index_type: str = "flat",
        cache_size: int = 1000
    ):
        """
        Initialize semantic search engine
        
        Args:
            model_name: Name of the sentence transformer model
            index_type: Type of vector index to use
            cache_size: Size of query cache
        """
        self.embedding_model = SentenceTransformerModel(model_name)
        self.vector_index = VectorIndex(self.embedding_model.get_dimension(), index_type)
        self.query_cache = {}
        self.cache_size = cache_size
        self.metrics_history = []
        
        logger.info(f"Initialized SemanticSearchEngine with model: {model_name}")
    
    def add_documents(self, documents: List[Document]):
        """
        Add documents to the search index
        
        Args:
            documents: List of documents to index
        """
        # Generate embeddings for documents without embeddings
        documents_to_encode = [doc for doc in documents if doc.embedding is None]
        
        if documents_to_encode:
            texts = [doc.content for doc in documents_to_encode]
            embeddings = self.embedding_model.encode(texts)
            
            for doc, embedding in zip(documents_to_encode, embeddings):
                doc.embedding = embedding
        
        # Add to vector index
        self.vector_index.add_documents(documents)
    
    def search(
        self,
        query: str,
        k: int = 10,
        min_score: float = 0.1,
        include_explanation: bool = True
    ) -> Tuple[List[SearchResult], SearchMetrics]:
        """
        Perform semantic search
        
        Args:
            query: Search query
            k: Number of results to return
            min_score: Minimum similarity score threshold
            include_explanation: Whether to include explanations
            
        Returns:
            Tuple of (search results, metrics)
        """
        start_time = datetime.now()
        
        # Check cache
        cache_key = f"{query}_{k}_{min_score}"
        if cache_key in self.query_cache:
            cached_results = self.query_cache[cache_key]
            metrics = SearchMetrics(
                query_time=(datetime.now() - start_time).total_seconds(),
                index_time=0,
                total_documents=len(self.vector_index.documents),
                results_returned=len(cached_results),
                average_similarity=np.mean([r.score for r in cached_results]) if cached_results else 0,
                cache_hit=True
            )
            return cached_results, metrics
        
        # Encode query
        query_embedding = self.embedding_model.encode([query])[0]
        
        # Search vector index
        raw_results = self.vector_index.search(query_embedding, k * 2)  # Get more for filtering
        
        # Filter and format results
        search_results = []
        for document, score in raw_results:
            if score >= min_score:
                explanation = self._generate_explanation(query, document, score) if include_explanation else ""
                search_results.append(SearchResult(
                    document=document,
                    score=score,
                    explanation=explanation
                ))
        
        # Limit results
        search_results = search_results[:k]
        
        # Calculate metrics
        query_time = (datetime.now() - start_time).total_seconds()
        average_similarity = np.mean([r.score for r in search_results]) if search_results else 0
        
        metrics = SearchMetrics(
            query_time=query_time,
            index_time=0,  # Would be measured in a real implementation
            total_documents=len(self.vector_index.documents),
            results_returned=len(search_results),
            average_similarity=average_similarity,
            cache_hit=False
        )
        
        # Update cache
        self._update_cache(cache_key, search_results)
        self.metrics_history.append(metrics)
        
        logger.info(f"Search completed: query='{query}', results={len(search_results)}, time={query_time:.3f}s")
        
        return search_results, metrics
    
    def find_similar_documents(
        self,
        document_id: str,
        k: int = 10,
        min_score: float = 0.3
    ) -> List[SearchResult]:
        """
        Find documents similar to a given document
        
        Args:
            document_id: ID of reference document
            k: Number of results to return
            min_score: Minimum similarity score threshold
            
        Returns:
            List of similar documents
        """
        # Find the document
        target_doc = None
        for doc in self.vector_index.documents:
            if doc.id == document_id:
                target_doc = doc
                break
        
        if not target_doc or target_doc.embedding is None:
            logger.error(f"Document not found or has no embedding: {document_id}")
            return []
        
        # Search using document embedding
        raw_results = self.vector_index.search(target_doc.embedding, k + 1)  # +1 to exclude self
        
        # Filter results (exclude the document itself)
        search_results = []
        for document, score in raw_results:
            if document.id != document_id and score >= min_score:
                explanation = f"Similar to '{document_id}' (score: {score:.3f})"
                search_results.append(SearchResult(
                    document=document,
                    score=score,
                    explanation=explanation
                ))
        
        return search_results[:k]
    
    def batch_search(
        self,
        queries: List[str],
        k: int = 10,
        min_score: float = 0.1
    ) -> Dict[str, Tuple[List[SearchResult], SearchMetrics]]:
        """
        Perform batch search for multiple queries
        
        Args:
            queries: List of search queries
            k: Number of results per query
            min_score: Minimum similarity score threshold
            
        Returns:
            Dictionary mapping queries to (results, metrics) tuples
        """
        results = {}
        
        # Encode all queries at once for efficiency
        query_embeddings = self.embedding_model.encode(queries)
        
        for i, query in enumerate(queries):
            start_time = datetime.now()
            query_embedding = query_embeddings[i]
            
            # Search
            raw_results = self.vector_index.search(query_embedding, k * 2)
            
            # Filter and format results
            search_results = []
            for document, score in raw_results:
                if score >= min_score:
                    explanation = self._generate_explanation(query, document, score)
                    search_results.append(SearchResult(
                        document=document,
                        score=score,
                        explanation=explanation
                    ))
            
            search_results = search_results[:k]
            
            # Calculate metrics
            query_time = (datetime.now() - start_time).total_seconds()
            average_similarity = np.mean([r.score for r in search_results]) if search_results else 0
            
            metrics = SearchMetrics(
                query_time=query_time,
                index_time=0,
                total_documents=len(self.vector_index.documents),
                results_returned=len(search_results),
                average_similarity=average_similarity,
                cache_hit=False
            )
            
            results[query] = (search_results, metrics)
        
        logger.info(f"Batch search completed: {len(queries)} queries")
        return results
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get search engine statistics"""
        if not self.metrics_history:
            return {
                "total_documents": 0,
                "total_searches": 0,
                "average_query_time": 0,
                "average_results": 0,
                "cache_hit_rate": 0
            }
        
        total_searches = len(self.metrics_history)
        avg_query_time = np.mean([m.query_time for m in self.metrics_history])
        avg_results = np.mean([m.results_returned for m in self.metrics_history])
        cache_hits = sum(1 for m in self.metrics_history if m.cache_hit)
        cache_hit_rate = cache_hits / total_searches if total_searches > 0 else 0
        
        return {
            "total_documents": len(self.vector_index.documents),
            "total_searches": total_searches,
            "average_query_time": avg_query_time,
            "average_results": avg_results,
            "cache_hit_rate": cache_hit_rate,
            "model_name": self.embedding_model.model_name,
            "embedding_dimension": self.embedding_model.get_dimension(),
            "index_type": self.vector_index.index_type
        }
    
    def save_index(self, filepath: str):
        """Save the search index to disk"""
        self.vector_index.save(filepath)
        logger.info(f"Saved semantic search index to {filepath}")
    
    def load_index(self, filepath: str):
        """Load the search index from disk"""
        self.vector_index.load(filepath)
        logger.info(f"Loaded semantic search index from {filepath}")
    
    def _generate_explanation(self, query: str, document: Document, score: float) -> str:
        """Generate explanation for search result"""
        if score > 0.8:
            return f"Very high semantic similarity (score: {score:.3f})"
        elif score > 0.6:
            return f"High semantic similarity (score: {score:.3f})"
        elif score > 0.4:
            return f"Moderate semantic similarity (score: {score:.3f})"
        else:
            return f"Some semantic similarity (score: {score:.3f})"
    
    def _update_cache(self, key: str, results: List[SearchResult]):
        """Update query cache with LRU eviction"""
        if len(self.query_cache) >= self.cache_size:
            # Remove oldest entry (simple FIFO for now)
            oldest_key = next(iter(self.query_cache))
            del self.query_cache[oldest_key]
        
        self.query_cache[key] = results

# Utility functions
def create_document_from_course(course_data: Dict[str, Any]) -> Document:
    """Create a Document object from course data"""
    # Combine relevant course fields into searchable content
    content_parts = [
        course_data.get('title', ''),
        course_data.get('description', ''),
        course_data.get('short_description', ''),
        ' '.join(course_data.get('tags', [])),
        ' '.join(course_data.get('skills', [])),
        course_data.get('category', {}).get('name', ''),
        course_data.get('instructor', {}).get('name', ''),
        ' '.join(course_data.get('objectives', []))
    ]
    
    content = ' '.join(filter(None, content_parts))
    
    metadata = {
        'course_id': course_data.get('id'),
        'title': course_data.get('title'),
        'category': course_data.get('category', {}).get('name'),
        'level': course_data.get('metadata', {}).get('level'),
        'price': course_data.get('price'),
        'rating': course_data.get('rating'),
        'enrollment_count': course_data.get('enrollment_count'),
        'instructor': course_data.get('instructor', {}).get('name'),
        'tags': course_data.get('tags', []),
        'skills': course_data.get('skills', [])
    }
    
    return Document(
        id=course_data.get('id'),
        content=content,
        metadata=metadata,
        content_type='course'
    )

# Example usage and testing
if __name__ == "__main__":
    # Create sample documents
    sample_docs = [
        Document(
            id="1",
            content="Learn Python programming for beginners with hands-on exercises",
            metadata={"category": "programming", "level": "beginner"}
        ),
        Document(
            id="2", 
            content="Advanced machine learning with TensorFlow and neural networks",
            metadata={"category": "ai", "level": "advanced"}
        ),
        Document(
            id="3",
            content="Web development with React.js and modern JavaScript",
            metadata={"category": "web", "level": "intermediate"}
        )
    ]
    
    # Initialize search engine
    engine = SemanticSearchEngine()
    
    # Add documents
    engine.add_documents(sample_docs)
    
    # Perform search
    results, metrics = engine.search("python programming", k=2)
    
    print(f"Search Results (took {metrics.query_time:.3f}s):")
    for result in results:
        print(f"- {result.document.id}: {result.score:.3f} - {result.explanation}")
    
    # Print statistics
    print("\nStatistics:")
    stats = engine.get_statistics()
    for key, value in stats.items():
        print(f"{key}: {value}")
