export interface SocialProof {
  reviewSnippet: string;
  enrollmentLabel: string;
  ratingLabel: string;
}

export interface DiscoveryCourse {
  id: string;
  title: string;
  shortDescription: string;
  description: string;
  category: string;
  level: string;
  language: string;
  durationHours: number;
  price: number;
  rating: number;
  reviewCount: number;
  enrollmentCount: number;
  provider: string;
  thumbnail: string;
  tags: string[];
  skills: string[];
  preview: string;
  matchReasons: string[];
  quickActions: string[];
  relevanceScore: number;
  semanticScore: number;
  recommendationScore: number;
  trendScore: number;
  socialProof: SocialProof;
}

export interface DiscoveryFacet {
  value: string;
  count: number;
}

export interface DiscoveryFacets {
  categories: DiscoveryFacet[];
  levels: DiscoveryFacet[];
  languages: DiscoveryFacet[];
  tags: DiscoveryFacet[];
}

export interface DiscoveryAnalytics {
  processingTimeMs: number;
  indexedDocuments: number;
  realtimeIndexedAt: string;
  abVariant: string;
  engine: string;
}

export interface DiscoverySearchResponse {
  searchId: string;
  query: string;
  normalizedQuery: string;
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  variant: string;
  results: DiscoveryCourse[];
  facets: DiscoveryFacets;
  suggestions: string[];
  analytics: DiscoveryAnalytics;
}

export interface RecommendationItem extends DiscoveryCourse {
  score: number;
  reason: string;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  skills: string[];
  durationHours: number;
  courseCount: number;
  matchScore: number;
  courses: DiscoveryCourse[];
}

export interface CuratorRecommendation {
  id: string;
  name: string;
  title: string;
  focus: string;
  picks: DiscoveryCourse[];
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  filters: Partial<DiscoveryFilters>;
  total: number;
  clickedResultIds: string[];
  timestamp: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Partial<DiscoveryFilters>;
  alertEnabled: boolean;
  createdAt: string;
}

export interface AlertRecord {
  id: string;
  query: string;
  filters: Partial<DiscoveryFilters>;
  frequency: string;
  channel: string;
  createdAt: string;
}

export interface SuggestionResponse {
  suggestions: string[];
}

export interface VoiceSearchResponse {
  normalizedQuery: string;
  result: DiscoverySearchResponse;
}

export interface SimilarCoursesResponse {
  source: DiscoveryCourse;
  items: DiscoveryCourse[];
}

export interface TrendingResponse {
  items: DiscoveryCourse[];
}

export interface SearchAnalyticsSnapshot {
  totalSearches: number;
  averageProcessingTimeMs: number;
  averageClicksPerSearch: number;
  savedSearchCount: number;
  alertCount: number;
  variantBreakdown: Record<string, number>;
  popularQueries: Array<{ query: string; count: number }>;
}

export interface DiscoveryFilters {
  query: string;
  categories: string[];
  levels: string[];
  languages: string[];
  tags: string[];
  minRating: number;
  maxPrice: number;
  maxDuration: number;
  freeOnly: boolean;
  sortBy: SortOption;
  view: ViewMode;
  page: number;
  limit: number;
}

export type SortOption = 'relevance' | 'newest' | 'popular' | 'rating' | 'duration' | 'price-low' | 'price-high';
export type ViewMode = 'grid' | 'list';
