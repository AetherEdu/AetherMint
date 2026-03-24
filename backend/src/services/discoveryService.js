const logger = require('../utils/logger');

const DEFAULT_PAGE_SIZE = 12;

const clone = (value) => JSON.parse(JSON.stringify(value));

const toSlug = (value) =>
    String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

const createCourse = (course) => ({
    id: course.id,
    title: course.title,
    shortDescription: course.shortDescription,
    description: course.description,
    category: course.category,
    level: course.level,
    language: course.language,
    durationHours: course.durationHours,
    price: course.price,
    rating: course.rating,
    reviewCount: course.reviewCount,
    enrollmentCount: course.enrollmentCount,
    provider: course.provider,
    thumbnail: course.thumbnail,
    tags: course.tags,
    skills: course.skills,
    learningPathIds: course.learningPathIds,
    publishedAt: course.publishedAt,
    updatedAt: course.updatedAt,
    expertPick: course.expertPick,
    reviewHighlights: course.reviewHighlights,
    searchableText: [
        course.title,
        course.shortDescription,
        course.description,
        course.category,
        course.level,
        course.language,
        course.provider,
        course.tags.join(' '),
        course.skills.join(' '),
        course.reviewHighlights.map((review) => review.quote).join(' ')
    ]
        .join(' ')
        .toLowerCase()
});

class DiscoveryService {
    constructor() {
        this.catalog = this.buildCatalog();
        this.learningPaths = this.buildLearningPaths();
        this.curators = this.buildCurators();
        this.savedSearches = new Map();
        this.searchAlerts = new Map();
        this.searchHistory = new Map();
        this.searchAnalytics = [];
        this.searchClicks = [];
        this.lastIndexedAt = new Date().toISOString();
    }

    resetState () {
        this.savedSearches.clear();
        this.searchAlerts.clear();
        this.searchHistory.clear();
        this.searchAnalytics = [];
        this.searchClicks = [];
        this.lastIndexedAt = new Date().toISOString();
    }

    search (params = {}) {
        const startedAt = Date.now();
        const normalizedQuery = this.normalizeVoiceQuery(params.query || '');
        const queryTerms = normalizedQuery
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
        const filters = this.normalizeFilters(params.filters || params);
        const sessionKey = this.getUserSessionKey(params.userId, params.sessionId);
        const variant = this.getExperimentVariant(sessionKey);

        let items = this.catalog.map((course) => {
            const ranking = this.scoreCourse(course, normalizedQuery, queryTerms, sessionKey, filters, variant);
            return {
                ...clone(course),
                relevanceScore: ranking.score,
                semanticScore: ranking.semanticScore,
                recommendationScore: ranking.recommendationScore,
                trendScore: ranking.trendScore,
                matchReasons: ranking.matchReasons,
                preview: this.buildPreview(course, queryTerms),
                quickActions: ['Save course', 'Preview syllabus', 'Find similar'],
                socialProof: this.buildSocialProof(course)
            };
        });

        if (normalizedQuery) {
            items = items.filter((item) => item.relevanceScore > 0.1 || item.matchReasons.length > 0);
        }

        items = items.filter((item) => this.matchesFilters(item, filters));
        const facets = this.buildFacets(items);
        items = this.sortResults(items, filters.sortBy || 'relevance', variant);

        const page = Math.max(1, Number(filters.page) || 1);
        const limit = Math.max(1, Number(filters.limit) || DEFAULT_PAGE_SIZE);
        const offset = (page - 1) * limit;
        const pagedItems = items.slice(offset, offset + limit);

        const entry = {
            id: `search_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            query: normalizedQuery,
            filters,
            total: items.length,
            clickedResultIds: [],
            sessionKey,
            variant,
            timestamp: new Date().toISOString(),
            processingTimeMs: Date.now() - startedAt
        };

        this.recordHistory(sessionKey, entry);
        this.recordAnalytics(entry);

        return {
            searchId: entry.id,
            query: params.query || '',
            normalizedQuery,
            total: items.length,
            page,
            limit,
            hasMore: offset + limit < items.length,
            variant,
            results: pagedItems,
            facets,
            suggestions: this.getSuggestions(normalizedQuery, sessionKey, 8),
            analytics: {
                processingTimeMs: entry.processingTimeMs,
                indexedDocuments: this.catalog.length,
                realtimeIndexedAt: this.lastIndexedAt,
                abVariant: variant,
                engine: 'starked-discovery-in-memory'
            }
        };
    }

    getSuggestions (query, sessionKey, limit = 6) {
        const normalizedQuery = String(query || '').trim().toLowerCase();
        const suggestionPool = new Set();

        this.catalog.forEach((course) => {
            [course.title, ...course.tags, ...course.skills, course.category, course.provider].forEach((value) => {
                if (!value) {
                    return;
                }

                const candidate = String(value).trim();
                const normalizedCandidate = candidate.toLowerCase();

                if (!normalizedQuery || normalizedCandidate.startsWith(normalizedQuery) || normalizedCandidate.includes(normalizedQuery)) {
                    suggestionPool.add(candidate);
                }
            });
        });

        const history = this.getHistoryEntries(sessionKey).map((item) => item.query).filter(Boolean);
        history.forEach((value) => {
            if (!normalizedQuery || value.toLowerCase().includes(normalizedQuery)) {
                suggestionPool.add(value);
            }
        });

        return Array.from(suggestionPool).slice(0, limit);
    }

    getRecommendations (userId, sessionId, limit = 6) {
        const sessionKey = this.getUserSessionKey(userId, sessionId);
        const recentHistory = this.getHistoryEntries(sessionKey);
        const preferredCategories = new Set();
        const preferredSkills = new Set();

        recentHistory.forEach((item) => {
            (item.filters.categories || []).forEach((category) => preferredCategories.add(category));
            String(item.query || '')
                .split(/\s+/)
                .filter(Boolean)
                .forEach((token) => preferredSkills.add(token.toLowerCase()));
        });

        const items = this.catalog
            .map((course) => {
                let score = this.calculateTrendingScore(course);
                const historyTokens = recentHistory.flatMap((item) => String(item.query || '').toLowerCase().split(/\s+/).filter(Boolean));

                if (preferredCategories.has(course.category)) {
                    score += 80;
                }

                score += course.skills.filter((skill) => preferredSkills.has(skill.toLowerCase())).length * 18;
                score += historyTokens.filter((token) => course.searchableText.includes(token)).length * 16;

                if (course.expertPick) {
                    score += 10;
                }

                return {
                    ...clone(course),
                    score,
                    reason: preferredCategories.has(course.category)
                        ? `Because you keep exploring ${course.category}`
                        : `Trending with learners focused on ${course.skills[0]}`
                };
            })
            .sort((left, right) => right.score - left.score)
            .slice(0, limit);

        return {
            sessionKey,
            strategy: recentHistory.length > 0 ? 'personalized-behavioral' : 'popular-fallback',
            items
        };
    }

    getTrending (limit = 6) {
        return {
            items: this.catalog
                .map((course) => ({
                    ...clone(course),
                    trendScore: this.calculateTrendingScore(course)
                }))
                .sort((left, right) => right.trendScore - left.trendScore)
                .slice(0, limit)
        };
    }

    getSimilar (courseId, limit = 4) {
        const source = this.catalog.find((course) => course.id === courseId);

        if (!source) {
            return null;
        }

        const items = this.catalog
            .filter((course) => course.id !== courseId)
            .map((course) => ({
                ...clone(course),
                similarityScore: this.calculateSimilarity(source, course),
                reason: `Shared focus on ${course.skills.slice(0, 2).join(' and ')}`
            }))
            .sort((left, right) => right.similarityScore - left.similarityScore)
            .slice(0, limit);

        return { source: clone(source), items };
    }

    getLearningPaths (query, userId, sessionId, limit = 4) {
        const sessionKey = this.getUserSessionKey(userId, sessionId);
        const normalizedQuery = String(query || '').toLowerCase();
        const recentQueries = this.getHistoryEntries(sessionKey).map((item) => item.query.toLowerCase());

        const items = this.learningPaths
            .map((path) => {
                let matchScore = 0;

                if (!normalizedQuery) {
                    matchScore += 1;
                }

                if (path.title.toLowerCase().includes(normalizedQuery) || path.description.toLowerCase().includes(normalizedQuery)) {
                    matchScore += 30;
                }

                matchScore += path.skills.filter((skill) => normalizedQuery.includes(skill.toLowerCase())).length * 20;
                matchScore += path.skills.filter((skill) => recentQueries.some((queryValue) => queryValue.includes(skill.toLowerCase()))).length * 12;

                return {
                    ...clone(path),
                    matchScore,
                    courses: path.courseIds
                        .map((courseId) => this.catalog.find((course) => course.id === courseId))
                        .filter(Boolean)
                        .map((course) => clone(course))
                };
            })
            .sort((left, right) => right.matchScore - left.matchScore)
            .slice(0, limit);

        return { items };
    }

    getCuratorRecommendations (limit = 3) {
        const items = this.curators.slice(0, limit).map((curator) => ({
            ...clone(curator),
            picks: curator.pickIds
                .map((courseId) => this.catalog.find((course) => course.id === courseId))
                .filter(Boolean)
                .map((course) => clone(course))
        }));

        return { items };
    }

    getSearchHistory (userId, sessionId) {
        const sessionKey = this.getUserSessionKey(userId, sessionId);
        return clone(this.getHistoryEntries(sessionKey));
    }

    saveSearch (userId, sessionId, payload) {
        const sessionKey = this.getUserSessionKey(userId, sessionId);
        const entry = {
            id: `saved_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: payload.name || `Search ${new Date().toLocaleDateString('en-US')}`,
            query: payload.query || '',
            filters: this.normalizeFilters(payload.filters || {}),
            alertEnabled: Boolean(payload.alertEnabled),
            createdAt: new Date().toISOString()
        };

        const saved = this.savedSearches.get(sessionKey) || [];
        saved.unshift(entry);
        this.savedSearches.set(sessionKey, saved.slice(0, 10));
        return clone(entry);
    }

    getSavedSearches (userId, sessionId) {
        const sessionKey = this.getUserSessionKey(userId, sessionId);
        return clone(this.savedSearches.get(sessionKey) || []);
    }

    createAlert (userId, sessionId, payload) {
        const sessionKey = this.getUserSessionKey(userId, sessionId);
        const alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            query: payload.query || '',
            filters: this.normalizeFilters(payload.filters || {}),
            frequency: payload.frequency || 'weekly',
            channel: payload.channel || 'in-app',
            createdAt: new Date().toISOString()
        };

        const alerts = this.searchAlerts.get(sessionKey) || [];
        alerts.unshift(alert);
        this.searchAlerts.set(sessionKey, alerts.slice(0, 10));
        return clone(alert);
    }

    getAlerts (userId, sessionId) {
        const sessionKey = this.getUserSessionKey(userId, sessionId);
        return clone(this.searchAlerts.get(sessionKey) || []);
    }

    recordClick (userId, sessionId, payload) {
        const sessionKey = this.getUserSessionKey(userId, sessionId);
        const click = {
            searchId: payload.searchId,
            resultId: payload.resultId,
            sessionKey,
            timestamp: new Date().toISOString(),
            action: payload.action || 'open'
        };

        this.searchClicks.push(click);
        const history = this.searchHistory.get(sessionKey) || [];
        const searchEntry = history.find((entry) => entry.id === payload.searchId);

        if (searchEntry && !searchEntry.clickedResultIds.includes(payload.resultId)) {
            searchEntry.clickedResultIds.push(payload.resultId);
        }

        return click;
    }

    getAnalytics () {
        const totalSearches = this.searchAnalytics.length;
        const avgProcessingTime = totalSearches
            ? this.searchAnalytics.reduce((sum, entry) => sum + entry.processingTimeMs, 0) / totalSearches
            : 0;
        const variantBreakdown = this.searchAnalytics.reduce(
            (accumulator, entry) => {
                accumulator[entry.variant] = (accumulator[entry.variant] || 0) + 1;
                return accumulator;
            },
            { control: 0, experimental: 0 }
        );
        const popularQueries = Object.entries(
            this.searchAnalytics.reduce((accumulator, entry) => {
                if (entry.query) {
                    accumulator[entry.query] = (accumulator[entry.query] || 0) + 1;
                }
                return accumulator;
            }, {})
        )
            .sort((left, right) => right[1] - left[1])
            .slice(0, 5)
            .map(([query, count]) => ({ query, count }));

        const clicksBySearch = this.searchHistory.size
            ? Array.from(this.searchHistory.values())
                .flat()
                .reduce((sum, entry) => sum + entry.clickedResultIds.length, 0) /
            Math.max(totalSearches, 1)
            : 0;

        return {
            totalSearches,
            averageProcessingTimeMs: Number(avgProcessingTime.toFixed(2)),
            averageClicksPerSearch: Number(clicksBySearch.toFixed(2)),
            savedSearchCount: Array.from(this.savedSearches.values()).reduce((sum, entries) => sum + entries.length, 0),
            alertCount: Array.from(this.searchAlerts.values()).reduce((sum, entries) => sum + entries.length, 0),
            variantBreakdown,
            popularQueries,
            searchEngine: {
                provider: 'starked-discovery-in-memory',
                supportsRealtimeIndexing: true,
                lastIndexedAt: this.lastIndexedAt
            },
            recommendationEngine: {
                strategy: 'behavioral-content-hybrid',
                personalizationSignals: ['search history', 'filters', 'course similarity', 'trending lift']
            }
        };
    }

    normalizeVoiceQuery (query) {
        return String(query || '')
            .replace(/courses? about/gi, '')
            .replace(/show me/gi, '')
            .replace(/find me/gi, '')
            .replace(/less than/gi, 'under')
            .replace(/no cost/gi, 'free')
            .replace(/five stars?/gi, '5 star')
            .replace(/\s+/g, ' ')
            .trim();
    }

    normalizeFilters (rawFilters = {}) {
        const arrayValue = (value) => {
            if (!value) {
                return [];
            }

            if (Array.isArray(value)) {
                return value.filter(Boolean);
            }

            return String(value)
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
        };

        const numberValue = (value) => {
            if (value === undefined || value === null || value === '') {
                return undefined;
            }

            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : undefined;
        };

        return {
            categories: arrayValue(rawFilters.categories),
            levels: arrayValue(rawFilters.levels),
            languages: arrayValue(rawFilters.languages),
            tags: arrayValue(rawFilters.tags),
            minRating: numberValue(rawFilters.minRating),
            maxPrice: numberValue(rawFilters.maxPrice),
            maxDuration: numberValue(rawFilters.maxDuration),
            sortBy: rawFilters.sortBy || rawFilters.sort || 'relevance',
            view: rawFilters.view || 'grid',
            freeOnly: String(rawFilters.freeOnly || '').toLowerCase() === 'true',
            page: numberValue(rawFilters.page) || 1,
            limit: numberValue(rawFilters.limit) || DEFAULT_PAGE_SIZE
        };
    }

    getUserSessionKey (userId, sessionId) {
        return userId ? `user:${userId}` : `session:${sessionId || 'anonymous'}`;
    }

    buildPreview (course, queryTerms) {
        const source = course.description || course.shortDescription;
        const sentences = source.split(/(?<=[.!?])\s+/);
        const matchingSentence = sentences.find((sentence) =>
            queryTerms.some((term) => sentence.toLowerCase().includes(term))
        );

        return matchingSentence || sentences[0] || source;
    }

    buildSocialProof (course) {
        const review = course.reviewHighlights[0];

        return {
            reviewSnippet: review ? `${review.reviewer}: ${review.quote}` : 'Trusted by active StarkEd learners',
            enrollmentLabel: `${course.enrollmentCount.toLocaleString('en-US')} learners enrolled`,
            ratingLabel: `${course.rating.toFixed(1)} average rating from ${course.reviewCount} reviews`
        };
    }

    matchesFilters (course, filters) {
        if (filters.categories.length > 0 && !filters.categories.includes(course.category)) {
            return false;
        }

        if (filters.levels.length > 0 && !filters.levels.includes(course.level)) {
            return false;
        }

        if (filters.languages.length > 0 && !filters.languages.includes(course.language)) {
            return false;
        }

        if (filters.tags.length > 0 && !filters.tags.some((tag) => course.tags.includes(tag) || course.skills.includes(tag))) {
            return false;
        }

        if (filters.minRating !== undefined && course.rating < filters.minRating) {
            return false;
        }

        if (filters.maxPrice !== undefined && course.price > filters.maxPrice) {
            return false;
        }

        if (filters.maxDuration !== undefined && course.durationHours > filters.maxDuration) {
            return false;
        }

        if (filters.freeOnly && course.price > 0) {
            return false;
        }

        return true;
    }

    scoreCourse (course, normalizedQuery, queryTerms, sessionKey, filters, variant) {
        let score = 0;
        let semanticScore = 0;
        let recommendationScore = 0;
        const matchReasons = [];

        if (!normalizedQuery) {
            score += 20;
            matchReasons.push('Fresh discovery match');
        }

        queryTerms.forEach((term) => {
            if (course.title.toLowerCase().includes(term)) {
                score += 35;
                semanticScore += 0.25;
                matchReasons.push(`Title matches \"${term}\"`);
            }

            if (course.tags.some((tag) => tag.toLowerCase().includes(term))) {
                score += 18;
                semanticScore += 0.15;
                matchReasons.push(`Tag match for \"${term}\"`);
            }

            if (course.skills.some((skill) => skill.toLowerCase().includes(term))) {
                score += 24;
                semanticScore += 0.2;
                matchReasons.push(`Skill alignment with \"${term}\"`);
            }

            if (course.searchableText.includes(term)) {
                score += 10;
                semanticScore += 0.08;
            }
        });

        if (filters.categories.includes(course.category)) {
            recommendationScore += 18;
            matchReasons.push('Matches your category filters');
        }

        const history = this.getHistoryEntries(sessionKey);
        const repeatedCategory = history.some((entry) => (entry.filters.categories || []).includes(course.category));
        if (repeatedCategory) {
            recommendationScore += 14;
            matchReasons.push(`Recommended from your recent ${course.category} searches`);
        }

        const trendScore = this.calculateTrendingScore(course);
        score += trendScore * 0.4;
        score += recommendationScore;
        score += course.rating * 4;

        if (course.expertPick) {
            score += 8;
            matchReasons.push('Expert curator pick');
        }

        if (variant === 'experimental') {
            score += semanticScore * 25;
        }

        return {
            score: Number(score.toFixed(2)),
            semanticScore: Number(Math.min(1, semanticScore).toFixed(2)),
            recommendationScore: Number(recommendationScore.toFixed(2)),
            trendScore: Number(trendScore.toFixed(2)),
            matchReasons: Array.from(new Set(matchReasons)).slice(0, 4)
        };
    }

    calculateTrendingScore (course) {
        const freshnessDays = (Date.now() - new Date(course.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
        const freshnessBoost = Math.max(0, 30 - freshnessDays) / 6;
        return course.enrollmentCount / 120 + course.rating * 5 + freshnessBoost;
    }

    calculateSimilarity (source, course) {
        const sourceTokens = new Set([source.category, source.level, ...source.tags, ...source.skills]);
        const targetTokens = new Set([course.category, course.level, ...course.tags, ...course.skills]);
        const shared = Array.from(sourceTokens).filter((token) => targetTokens.has(token)).length;
        const union = new Set([...sourceTokens, ...targetTokens]).size;
        return Number((shared / union + course.rating / 10).toFixed(2));
    }

    buildFacets (items) {
        const buildFacet = (values) =>
            Object.entries(
                values.reduce((accumulator, value) => {
                    accumulator[value] = (accumulator[value] || 0) + 1;
                    return accumulator;
                }, {})
            ).map(([value, count]) => ({ value, count }));

        return {
            categories: buildFacet(items.map((item) => item.category)).sort((left, right) => right.count - left.count),
            levels: buildFacet(items.map((item) => item.level)).sort((left, right) => right.count - left.count),
            languages: buildFacet(items.map((item) => item.language)).sort((left, right) => right.count - left.count),
            tags: buildFacet(items.flatMap((item) => item.tags)).sort((left, right) => right.count - left.count).slice(0, 10)
        };
    }

    sortResults (items, sortBy, variant) {
        const sorted = [...items];

        switch (sortBy) {
            case 'newest':
                sorted.sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime());
                break;
            case 'popular':
                sorted.sort((left, right) => right.enrollmentCount - left.enrollmentCount);
                break;
            case 'rating':
                sorted.sort((left, right) => right.rating - left.rating);
                break;
            case 'duration':
                sorted.sort((left, right) => left.durationHours - right.durationHours);
                break;
            case 'price-low':
                sorted.sort((left, right) => left.price - right.price);
                break;
            case 'price-high':
                sorted.sort((left, right) => right.price - left.price);
                break;
            case 'relevance':
            default:
                sorted.sort((left, right) => {
                    if (variant === 'experimental' && right.semanticScore !== left.semanticScore) {
                        return right.semanticScore - left.semanticScore || right.relevanceScore - left.relevanceScore;
                    }

                    return right.relevanceScore - left.relevanceScore;
                });
                break;
        }

        return sorted;
    }

    recordHistory (sessionKey, entry) {
        const history = this.searchHistory.get(sessionKey) || [];
        history.unshift(entry);
        this.searchHistory.set(sessionKey, history.slice(0, 8));
    }

    getHistoryEntries (sessionKey) {
        return this.searchHistory.get(sessionKey) || [];
    }

    recordAnalytics (entry) {
        this.searchAnalytics.unshift(entry);
        this.searchAnalytics = this.searchAnalytics.slice(0, 1000);
        logger.info(`Discovery search ${entry.id} completed in ${entry.processingTimeMs}ms`);
    }

    getExperimentVariant (sessionKey) {
        const hash = Array.from(sessionKey).reduce((sum, char) => sum + char.charCodeAt(0), 0);
        return hash % 2 === 0 ? 'control' : 'experimental';
    }

    buildCatalog () {
        return [
            createCourse({
                id: 'course_foundations_ai',
                title: 'AI Foundations for Educators',
                shortDescription: 'Launch an AI-ready teaching practice with practical prompt design and classroom workflows.',
                description: 'Learn prompt design, retrieval workflows, classroom policy design, and evaluation patterns for AI-supported teaching. Includes lesson templates, policy kits, and case studies from higher education and bootcamp environments.',
                category: 'Artificial Intelligence',
                level: 'beginner',
                language: 'English',
                durationHours: 6,
                price: 0,
                rating: 4.8,
                reviewCount: 214,
                enrollmentCount: 5830,
                provider: 'StarkEd Studio',
                thumbnail: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
                tags: ['AI', 'Prompting', 'Teaching'],
                skills: ['Prompt Design', 'AI Literacy', 'Lesson Planning'],
                learningPathIds: ['path_ai_instructional_designer'],
                publishedAt: '2026-02-12T00:00:00.000Z',
                updatedAt: '2026-03-20T00:00:00.000Z',
                expertPick: true,
                reviewHighlights: [
                    { reviewer: 'Dr. Ada', quote: 'The best practical primer I have found for AI use in curriculum design.' }
                ]
            }),
            createCourse({
                id: 'course_data_storytelling',
                title: 'Data Storytelling for Learning Analysts',
                shortDescription: 'Turn learning event streams into narrative dashboards and interventions.',
                description: 'Build dashboards, synthesize learner trends, and design stakeholder briefings that move teams from metrics to action. Covers SQL-lite exploration, visualization patterns, and intervention planning.',
                category: 'Analytics',
                level: 'intermediate',
                language: 'English',
                durationHours: 8,
                price: 79,
                rating: 4.7,
                reviewCount: 142,
                enrollmentCount: 3240,
                provider: 'Open Learning Lab',
                thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
                tags: ['Analytics', 'Dashboards', 'Reporting'],
                skills: ['Data Analysis', 'Stakeholder Communication', 'Dashboard Design'],
                learningPathIds: ['path_learning_analytics'],
                publishedAt: '2026-01-18T00:00:00.000Z',
                updatedAt: '2026-03-18T00:00:00.000Z',
                expertPick: false,
                reviewHighlights: [
                    { reviewer: 'Mina', quote: 'Clear frameworks for making analytics useful to teaching teams.' }
                ]
            }),
            createCourse({
                id: 'course_rust_smart_contracts',
                title: 'Rust Smart Contracts for Education Apps',
                shortDescription: 'Ship auditable on-chain education workflows with Rust and Stellar-adjacent patterns.',
                description: 'Covers contract architecture, access control, event logging, testing, and deployment workflows for educational products that need verifiable records and payment logic.',
                category: 'Blockchain',
                level: 'advanced',
                language: 'English',
                durationHours: 14,
                price: 129,
                rating: 4.9,
                reviewCount: 88,
                enrollmentCount: 1810,
                provider: 'StarkEd Protocol',
                thumbnail: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=900&q=80',
                tags: ['Rust', 'Smart Contracts', 'Stellar'],
                skills: ['Rust', 'Contract Testing', 'Access Control'],
                learningPathIds: ['path_web3_curriculum_builder'],
                publishedAt: '2026-03-04T00:00:00.000Z',
                updatedAt: '2026-03-22T00:00:00.000Z',
                expertPick: true,
                reviewHighlights: [
                    { reviewer: 'Jon', quote: 'Dense and useful. The testing sections alone justified the purchase.' }
                ]
            }),
            createCourse({
                id: 'course_course_design_systems',
                title: 'Course Design Systems',
                shortDescription: 'Create reusable course templates, governance rules, and authoring standards.',
                description: 'Ideal for curriculum leads who need consistency across large content libraries. Build design tokens for pedagogy, reusable outlines, QA checklists, and content operations playbooks.',
                category: 'Instructional Design',
                level: 'intermediate',
                language: 'English',
                durationHours: 10,
                price: 59,
                rating: 4.6,
                reviewCount: 97,
                enrollmentCount: 2670,
                provider: 'Curriculum Forge',
                thumbnail: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=80',
                tags: ['Instructional Design', 'Content Ops', 'QA'],
                skills: ['Curriculum Architecture', 'Quality Assurance', 'Template Design'],
                learningPathIds: ['path_ai_instructional_designer'],
                publishedAt: '2025-12-11T00:00:00.000Z',
                updatedAt: '2026-03-10T00:00:00.000Z',
                expertPick: false,
                reviewHighlights: [
                    { reviewer: 'Lebo', quote: 'Finally a course that treats content design as an operating system.' }
                ]
            }),
            createCourse({
                id: 'course_voice_ux_search',
                title: 'Voice UX for Search Interfaces',
                shortDescription: 'Design voice-first discovery flows that actually recover from ambiguity.',
                description: 'Work through speech input patterns, noisy query repair, confirmation loops, accessibility safeguards, and analytics for voice-driven discovery products.',
                category: 'Product Design',
                level: 'intermediate',
                language: 'English',
                durationHours: 5,
                price: 49,
                rating: 4.5,
                reviewCount: 61,
                enrollmentCount: 1460,
                provider: 'Interface Works',
                thumbnail: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=900&q=80',
                tags: ['Voice Search', 'Accessibility', 'UX'],
                skills: ['Conversational Design', 'Search UX', 'Accessibility'],
                learningPathIds: ['path_search_product_lead'],
                publishedAt: '2026-02-26T00:00:00.000Z',
                updatedAt: '2026-03-16T00:00:00.000Z',
                expertPick: true,
                reviewHighlights: [
                    { reviewer: 'Hugo', quote: 'Practical examples of repairing spoken queries without annoying users.' }
                ]
            }),
            createCourse({
                id: 'course_ml_recommendation_systems',
                title: 'Recommendation Systems for Learning Platforms',
                shortDescription: 'Build hybrid recommenders that balance personalization, exploration, and trust.',
                description: 'Implement collaborative filtering, content-based ranking, fallback strategies, and evaluation loops for education products. Includes A/B testing patterns and explainability design.',
                category: 'Machine Learning',
                level: 'advanced',
                language: 'English',
                durationHours: 12,
                price: 149,
                rating: 4.9,
                reviewCount: 173,
                enrollmentCount: 2940,
                provider: 'Open Learning Lab',
                thumbnail: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=900&q=80',
                tags: ['Machine Learning', 'Recommendations', 'A/B Testing'],
                skills: ['Ranking Models', 'Experiment Design', 'Feature Engineering'],
                learningPathIds: ['path_search_product_lead', 'path_learning_analytics'],
                publishedAt: '2026-01-30T00:00:00.000Z',
                updatedAt: '2026-03-21T00:00:00.000Z',
                expertPick: true,
                reviewHighlights: [
                    { reviewer: 'Priya', quote: 'Rarely do courses cover recommender explainability this well.' }
                ]
            }),
            createCourse({
                id: 'course_mooc_catalog_integration',
                title: 'MOOC Catalog Integration Playbook',
                shortDescription: 'Aggregate and normalize external course catalogs without turning search into a mess.',
                description: 'Covers schema normalization, deduplication, sync strategies, real-time indexing hooks, and relevance safeguards when mixing first-party and third-party catalogs.',
                category: 'Platform Engineering',
                level: 'advanced',
                language: 'English',
                durationHours: 9,
                price: 99,
                rating: 4.4,
                reviewCount: 54,
                enrollmentCount: 980,
                provider: 'StarkEd Studio',
                thumbnail: 'https://images.unsplash.com/photo-1516321165247-4aa89a48be28?auto=format&fit=crop&w=900&q=80',
                tags: ['Catalog Sync', 'Indexing', 'Data Pipelines'],
                skills: ['ETL', 'Schema Design', 'Search Operations'],
                learningPathIds: ['path_search_product_lead'],
                publishedAt: '2026-03-08T00:00:00.000Z',
                updatedAt: '2026-03-23T00:00:00.000Z',
                expertPick: false,
                reviewHighlights: [
                    { reviewer: 'Tariq', quote: 'Exactly what I needed before expanding into third-party catalogs.' }
                ]
            }),
            createCourse({
                id: 'course_foundations_sql',
                title: 'SQL Foundations for Learning Data',
                shortDescription: 'Query learner activity, completion, and engagement data with confidence.',
                description: 'Start with core SQL and move quickly into education-specific metrics, retention analysis, funnel exploration, and content performance segmentation.',
                category: 'Analytics',
                level: 'beginner',
                language: 'English',
                durationHours: 7,
                price: 0,
                rating: 4.7,
                reviewCount: 401,
                enrollmentCount: 7630,
                provider: 'Data Commons',
                thumbnail: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=900&q=80',
                tags: ['SQL', 'Analytics', 'Retention'],
                skills: ['SQL', 'Retention Analysis', 'Reporting'],
                learningPathIds: ['path_learning_analytics'],
                publishedAt: '2025-11-22T00:00:00.000Z',
                updatedAt: '2026-03-12T00:00:00.000Z',
                expertPick: false,
                reviewHighlights: [
                    { reviewer: 'Mpho', quote: 'A clean on-ramp into analytics without dumbing down the work.' }
                ]
            }),
            createCourse({
                id: 'course_learning_path_blueprints',
                title: 'Learning Path Blueprints',
                shortDescription: 'Design sequenced pathways that help learners discover what comes next.',
                description: 'Use competency maps, milestone design, and adaptive sequencing to turn disconnected courses into guided journeys with measurable progression.',
                category: 'Instructional Design',
                level: 'intermediate',
                language: 'English',
                durationHours: 6,
                price: 69,
                rating: 4.8,
                reviewCount: 119,
                enrollmentCount: 2125,
                provider: 'Curriculum Forge',
                thumbnail: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80',
                tags: ['Learning Paths', 'Sequencing', 'Competencies'],
                skills: ['Path Design', 'Curriculum Sequencing', 'Competency Mapping'],
                learningPathIds: ['path_ai_instructional_designer'],
                publishedAt: '2026-02-03T00:00:00.000Z',
                updatedAt: '2026-03-19T00:00:00.000Z',
                expertPick: true,
                reviewHighlights: [
                    { reviewer: 'Sara', quote: 'Strong framework for getting learners from discovery to commitment.' }
                ]
            }),
            createCourse({
                id: 'course_search_analytics_dashboard',
                title: 'Search Analytics Dashboard Design',
                shortDescription: 'Instrument search funnels and learn which queries fail learners.',
                description: 'Build search event schemas, dashboard KPIs, failure taxonomies, and alerting playbooks for search teams responsible for relevance and discovery.',
                category: 'Analytics',
                level: 'advanced',
                language: 'English',
                durationHours: 4,
                price: 39,
                rating: 4.6,
                reviewCount: 72,
                enrollmentCount: 1895,
                provider: 'Interface Works',
                thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80',
                tags: ['Search Analytics', 'Dashboards', 'Experimentation'],
                skills: ['Instrumentation', 'KPI Design', 'Alerting'],
                learningPathIds: ['path_search_product_lead'],
                publishedAt: '2026-03-02T00:00:00.000Z',
                updatedAt: '2026-03-22T00:00:00.000Z',
                expertPick: false,
                reviewHighlights: [
                    { reviewer: 'Noor', quote: 'Excellent for teams building the analytics layer around search.' }
                ]
            }),
            createCourse({
                id: 'course_mobile_microlearning',
                title: 'Mobile Microlearning Content Ops',
                shortDescription: 'Publish short-form mobile learning without sacrificing coherence or quality.',
                description: 'Learn packaging, chunking, review workflows, and rapid experimentation for mobile-first learning libraries and notifications.',
                category: 'Content Operations',
                level: 'beginner',
                language: 'English',
                durationHours: 3,
                price: 29,
                rating: 4.3,
                reviewCount: 46,
                enrollmentCount: 1310,
                provider: 'StarkEd Studio',
                thumbnail: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=900&q=80',
                tags: ['Mobile', 'Microlearning', 'Operations'],
                skills: ['Content Packaging', 'Editorial Workflows', 'Mobile UX'],
                learningPathIds: ['path_ai_instructional_designer'],
                publishedAt: '2026-02-20T00:00:00.000Z',
                updatedAt: '2026-03-13T00:00:00.000Z',
                expertPick: false,
                reviewHighlights: [
                    { reviewer: 'Esi', quote: 'A compact course with surprisingly useful operational detail.' }
                ]
            })
        ];
    }

    buildLearningPaths () {
        return [
            {
                id: 'path_ai_instructional_designer',
                title: 'AI Instructional Designer',
                description: 'Move from foundational AI literacy to reusable curriculum systems and sequenced learning paths.',
                skills: ['AI Literacy', 'Curriculum Architecture', 'Path Design'],
                durationHours: 22,
                courseCount: 4,
                courseIds: ['course_foundations_ai', 'course_course_design_systems', 'course_learning_path_blueprints', 'course_mobile_microlearning']
            },
            {
                id: 'path_learning_analytics',
                title: 'Learning Analytics Specialist',
                description: 'Build the data and experimentation skills needed to measure, explain, and improve learning experiences.',
                skills: ['SQL', 'Dashboard Design', 'Experiment Design'],
                durationHours: 31,
                courseCount: 4,
                courseIds: ['course_foundations_sql', 'course_data_storytelling', 'course_search_analytics_dashboard', 'course_ml_recommendation_systems']
            },
            {
                id: 'path_search_product_lead',
                title: 'Search and Discovery Product Lead',
                description: 'Design intelligent search, recommendation, voice, and analytics systems for learning platforms.',
                skills: ['Search UX', 'Recommendation Systems', 'Analytics'],
                durationHours: 30,
                courseCount: 4,
                courseIds: ['course_voice_ux_search', 'course_ml_recommendation_systems', 'course_search_analytics_dashboard', 'course_mooc_catalog_integration']
            },
            {
                id: 'path_web3_curriculum_builder',
                title: 'Web3 Curriculum Builder',
                description: 'Build blockchain-backed learning experiences with strong content and contract architecture.',
                skills: ['Rust', 'Contract Testing', 'Curriculum Systems'],
                durationHours: 24,
                courseCount: 2,
                courseIds: ['course_rust_smart_contracts', 'course_course_design_systems']
            }
        ];
    }

    buildCurators () {
        return [
            {
                id: toSlug('Nadia Search Quality Lead'),
                name: 'Nadia Okafor',
                title: 'Search Quality Lead',
                focus: 'Relevance tuning, analytics, and search failure recovery',
                pickIds: ['course_voice_ux_search', 'course_search_analytics_dashboard', 'course_ml_recommendation_systems']
            },
            {
                id: toSlug('Kabelo Curriculum Architect'),
                name: 'Kabelo Maseko',
                title: 'Curriculum Architect',
                focus: 'Learning paths, course systems, and quality operations',
                pickIds: ['course_course_design_systems', 'course_learning_path_blueprints', 'course_foundations_ai']
            },
            {
                id: toSlug('Ava Platform Engineer'),
                name: 'Ava Chen',
                title: 'Platform Engineer',
                focus: 'Indexing, integrations, and education platform architecture',
                pickIds: ['course_mooc_catalog_integration', 'course_rust_smart_contracts', 'course_data_storytelling']
            }
        ];
    }
}

module.exports = {
    DiscoveryService,
    discoveryService: new DiscoveryService()
};