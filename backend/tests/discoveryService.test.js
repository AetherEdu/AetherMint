const { DiscoveryService } = require('../src/services/discoveryService');

describe('DiscoveryService', () => {
    let service;

    beforeEach(() => {
        service = new DiscoveryService();
        service.resetState();
    });

    it('returns relevant full-text matches for topic queries', () => {
        const response = service.search({
            query: 'recommendation systems',
            sessionId: 'test-session',
            filters: { sortBy: 'relevance' }
        });

        expect(response.total).toBeGreaterThan(0);
        expect(response.results[0].title).toContain('Recommendation Systems');
        expect(response.results[0].matchReasons.length).toBeGreaterThan(0);
        expect(response.facets.categories.length).toBeGreaterThan(0);
    });

    it('applies advanced filters and sorting', () => {
        const response = service.search({
            query: 'analytics',
            sessionId: 'test-session',
            filters: {
                categories: ['Analytics'],
                levels: ['beginner'],
                freeOnly: true,
                sortBy: 'popular'
            }
        });

        expect(response.results.length).toBe(1);
        expect(response.results[0].id).toBe('course_foundations_sql');
        expect(response.results[0].price).toBe(0);
        expect(response.results[0].category).toBe('Analytics');
    });

    it('records search history and uses it for personalized recommendations', () => {
        service.search({
            query: 'instructional design',
            sessionId: 'behavior-session',
            filters: {
                categories: ['Instructional Design']
            }
        });

        const recommendations = service.getRecommendations(undefined, 'behavior-session', 4);
        const recommendationTitles = recommendations.items.map((item) => item.title);

        expect(service.getSearchHistory(undefined, 'behavior-session')).toHaveLength(1);
        expect(recommendationTitles).toContain('Course Design Systems');
    });

    it('normalizes voice queries before search execution', () => {
        const normalizedQuery = service.normalizeVoiceQuery('show me free courses about analytics');
        const response = service.search({
            query: normalizedQuery,
            sessionId: 'voice-session',
            filters: { freeOnly: true }
        });

        expect(normalizedQuery).toBe('free analytics');
        expect(response.results.every((item) => item.price === 0)).toBe(true);
    });
});