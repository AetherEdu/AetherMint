import {
    AlertRecord,
    CuratorRecommendation,
    DiscoveryCourse,
    DiscoveryFilters,
    DiscoverySearchResponse,
    LearningPath,
    RecommendationItem,
    SavedSearch,
    SearchAnalyticsSnapshot,
    SearchHistoryEntry,
    SimilarCoursesResponse,
    SuggestionResponse,
    TrendingResponse,
    VoiceSearchResponse
} from '../components/Discovery/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

const request = async <T> (path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers || {})
        },
        ...init
    });

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }

    const payload = await response.json();
    return payload.data as T;
};

const appendArray = (params: URLSearchParams, key: string, values: string[]) => {
    if (values.length > 0) {
        params.set(key, values.join(','));
    }
};

export const buildSearchQuery = (filters: DiscoveryFilters, sessionId: string, userId?: string) => {
    const params = new URLSearchParams();

    if (filters.query) {
        params.set('q', filters.query);
    }

    appendArray(params, 'categories', filters.categories);
    appendArray(params, 'levels', filters.levels);
    appendArray(params, 'languages', filters.languages);
    appendArray(params, 'tags', filters.tags);

    if (filters.minRating) {
        params.set('minRating', String(filters.minRating));
    }

    if (filters.maxPrice !== undefined) {
        params.set('maxPrice', String(filters.maxPrice));
    }

    if (filters.maxDuration !== undefined) {
        params.set('maxDuration', String(filters.maxDuration));
    }

    if (filters.freeOnly) {
        params.set('freeOnly', 'true');
    }

    params.set('sortBy', filters.sortBy);
    params.set('view', filters.view);
    params.set('page', String(filters.page));
    params.set('limit', String(filters.limit));
    params.set('sessionId', sessionId);

    if (userId) {
        params.set('userId', userId);
    }

    return params.toString();
};

export const discoveryApi = {
    search: (filters: DiscoveryFilters, sessionId: string, userId?: string) =>
        request<DiscoverySearchResponse>(`/api/search?${buildSearchQuery(filters, sessionId, userId)}`),

    suggestions: (query: string, sessionId: string, userId?: string) => {
        const params = new URLSearchParams({ q: query, sessionId, limit: '8' });
        if (userId) {
            params.set('userId', userId);
        }
        return request<SuggestionResponse>(`/api/search/suggestions?${params.toString()}`);
    },

    voiceSearch: (transcript: string, filters: DiscoveryFilters, sessionId: string, userId?: string) =>
        request<VoiceSearchResponse>('/api/search/voice', {
            method: 'POST',
            body: JSON.stringify({ transcript, filters, sessionId, userId })
        }),

    recommendations: (sessionId: string, userId?: string) => {
        const params = new URLSearchParams({ sessionId, limit: '6' });
        if (userId) {
            params.set('userId', userId);
        }
        return request<{ items: RecommendationItem[]; strategy: string }>(`/api/search/recommendations?${params.toString()}`);
    },

    trending: () => request<TrendingResponse>('/api/search/trending?limit=6'),

    learningPaths: (query: string, sessionId: string, userId?: string) => {
        const params = new URLSearchParams({ q: query, sessionId, limit: '4' });
        if (userId) {
            params.set('userId', userId);
        }
        return request<{ items: LearningPath[] }>(`/api/search/learning-paths?${params.toString()}`);
    },

    curators: () => request<{ items: CuratorRecommendation[] }>('/api/search/curators?limit=3'),

    similar: (courseId: string) => request<SimilarCoursesResponse>(`/api/search/similar/${courseId}?limit=4`),

    history: (sessionId: string, userId?: string) => {
        const params = new URLSearchParams({ sessionId });
        if (userId) {
            params.set('userId', userId);
        }
        return request<{ items: SearchHistoryEntry[] }>(`/api/search/history?${params.toString()}`);
    },

    savedSearches: (sessionId: string, userId?: string) => {
        const params = new URLSearchParams({ sessionId });
        if (userId) {
            params.set('userId', userId);
        }
        return request<{ items: SavedSearch[] }>(`/api/search/saved-searches?${params.toString()}`);
    },

    saveSearch: (payload: { name: string; query: string; filters: DiscoveryFilters; alertEnabled?: boolean; sessionId: string; userId?: string }) =>
        request<SavedSearch>('/api/search/saved-searches', {
            method: 'POST',
            body: JSON.stringify(payload)
        }),

    alerts: (sessionId: string, userId?: string) => {
        const params = new URLSearchParams({ sessionId });
        if (userId) {
            params.set('userId', userId);
        }
        return request<{ items: AlertRecord[] }>(`/api/search/alerts?${params.toString()}`);
    },

    createAlert: (payload: { query: string; filters: DiscoveryFilters; frequency: string; channel: string; sessionId: string; userId?: string }) =>
        request<AlertRecord>('/api/search/alerts', {
            method: 'POST',
            body: JSON.stringify(payload)
        }),

    recordClick: (payload: { searchId: string; resultId: string; action?: string; sessionId: string; userId?: string }) =>
        request<void>('/api/search/click', {
            method: 'POST',
            body: JSON.stringify(payload)
        }),

    analytics: () => request<SearchAnalyticsSnapshot>('/api/search/analytics')
};

export type { DiscoveryCourse };