/**
 * Recommendation API Routes
 * RESTful endpoints for course recommendations and ML services
 */

const express = require('express');
const router = express.Router();
const RecommendationEngine = require('../services/recommendationEngine');
const UserBehaviorTracker = require('../services/userBehaviorTracker');
const ABTestingFramework = require('../services/abTestingFramework');

// Middleware for request validation
const validateRequest = (req, res, next) => {
    try {
        if (!req.body && req.method !== 'GET') {
            return res.status(400).json({ error: 'Request body is required' });
        }
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid request format' });
    }
};

/**
 * @route GET /api/recommendations/health
 * @desc Check recommendation engine health
 * @access Public
 */
router.get('/health', async (req, res) => {
    try {
        const health = await RecommendationEngine.healthCheck();
        
        res.json({
            success: true,
            data: health
        });
        
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/recommendations/user/:userId
 * @desc Get personalized recommendations for a user
 * @access Private
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            count = 10,
            algorithm = 'hybrid',
            includeExplanations = true,
            category = null,
            difficulty = null
        } = req.query;
        
        const context = {};
        if (category) context.category = category;
        if (difficulty) context.difficulty = difficulty;
        
        const recommendations = await RecommendationEngine.getRecommendations(userId, {
            count: parseInt(count),
            algorithm,
            includeExplanations: includeExplanations === 'true',
            context
        });
        
        // Track recommendation request
        await UserBehaviorTracker.trackRecommendationRequest(userId, {
            algorithm,
            count: parseInt(count),
            context
        });
        
        res.json({
            success: true,
            data: recommendations
        });
        
    } catch (error) {
        console.error('Get recommendations error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/recommendations/user/:userId
 * @desc Get personalized recommendations with advanced options
 * @access Private
 */
router.post('/user/:userId', validateRequest, async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            count = 10,
            algorithm = 'hybrid',
            includeExplanations = true,
            context = {},
            filters = {}
        } = req.body;
        
        const recommendations = await RecommendationEngine.getRecommendations(userId, {
            count,
            algorithm,
            includeExplanations,
            context: { ...context, ...filters }
        });
        
        // Track recommendation request
        await UserBehaviorTracker.trackRecommendationRequest(userId, {
            algorithm,
            count,
            context: { ...context, ...filters }
        });
        
        res.json({
            success: true,
            data: recommendations
        });
        
    } catch (error) {
        console.error('Get recommendations error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/recommendations/similar/:courseId
 * @desc Get courses similar to a given course
 * @access Public
 */
router.get('/similar/:courseId', async (req, res) => {
    try {
        const { courseId } = req.params;
        const { count = 10, algorithm = 'content_based' } = req.query;
        
        const similarCourses = await RecommendationEngine.getSimilarCourses(courseId, {
            count: parseInt(count),
            algorithm
        });
        
        res.json({
            success: true,
            data: similarCourses
        });
        
    } catch (error) {
        console.error('Get similar courses error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/recommendations/popular
 * @desc Get popular courses
 * @access Public
 */
router.get('/popular', async (req, res) => {
    try {
        const {
            count = 20,
            category = null,
            timeRange = '7d'
        } = req.query;
        
        const popularCourses = await RecommendationEngine.getPopularCourses({
            count: parseInt(count),
            category,
            timeRange
        });
        
        res.json({
            success: true,
            data: popularCourses
        });
        
    } catch (error) {
        console.error('Get popular courses error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/recommendations/trending
 * @desc Get trending courses
 * @access Public
 */
router.get('/trending', async (req, res) => {
    try {
        const {
            count = 20,
            category = null,
            timeRange = '24h'
        } = req.query;
        
        const trendingCourses = await RecommendationEngine.getTrendingCourses({
            count: parseInt(count),
            category,
            timeRange
        });
        
        res.json({
            success: true,
            data: trendingCourses
        });
        
    } catch (error) {
        console.error('Get trending courses error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/recommendations/user/:userId/profile
 * @desc Update user profile with new interactions
 * @access Private
 */
router.post('/user/:userId/profile', validateRequest, async (req, res) => {
    try {
        const { userId } = req.params;
        const { interactions } = req.body;
        
        if (!interactions || !Array.isArray(interactions)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Interactions array is required' 
            });
        }
        
        const result = await RecommendationEngine.updateUserProfile(userId, interactions);
        
        // Track profile update
        await UserBehaviorTracker.trackProfileUpdate(userId, {
            interactionCount: interactions.length,
            timestamp: new Date().toISOString()
        });
        
        res.json({
            success: true,
            data: result,
            message: 'User profile updated successfully'
        });
        
    } catch (error) {
        console.error('Update user profile error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/recommendations/user/:userId/explanation/:courseId
 * @desc Get explanation for why a course is recommended
 * @access Private
 */
router.get('/user/:userId/explanation/:courseId', async (req, res) => {
    try {
        const { userId, courseId } = req.params;
        
        const explanation = await RecommendationEngine.getRecommendationExplanation(userId, courseId);
        
        res.json({
            success: true,
            data: explanation
        });
        
    } catch (error) {
        console.error('Get explanation error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/recommendations/user/:userId/interaction
 * @desc Track user interaction with a course
 * @access Private
 */
router.post('/user/:userId/interaction', validateRequest, async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            courseId,
            interactionType, // 'view', 'like', 'enroll', 'complete', 'rate'
            rating = null,
            duration = null,
            metadata = {}
        } = req.body;
        
        if (!courseId || !interactionType) {
            return res.status(400).json({ 
                success: false, 
                error: 'Course ID and interaction type are required' 
            });
        }
        
        const interaction = {
            user_id: userId,
            course_id: courseId,
            interaction_type: interactionType,
            rating: rating,
            duration: duration,
            timestamp: new Date().toISOString(),
            metadata: metadata
        };
        
        // Track interaction
        await UserBehaviorTracker.trackInteraction(interaction);
        
        res.json({
            success: true,
            message: 'Interaction tracked successfully'
        });
        
    } catch (error) {
        console.error('Track interaction error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/recommendations/models/train
 * @desc Train recommendation models
 * @access Private
 */
router.post('/models/train', validateRequest, async (req, res) => {
    try {
        const {
            algorithms = ['collaborative', 'content_based'],
            forceRetrain = false
        } = req.body;
        
        const result = await RecommendationEngine.trainModels({
            algorithms,
            forceRetrain
        });
        
        res.json({
            success: true,
            data: result,
            message: 'Model training completed'
        });
        
    } catch (error) {
        console.error('Train models error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/recommendations/models/evaluate
 * @desc Evaluate model performance
 * @access Private
 */
router.post('/models/evaluate', validateRequest, async (req, res) => {
    try {
        const {
            algorithms = ['collaborative', 'content_based'],
            metrics = ['precision', 'recall', 'ndcg']
        } = req.body;
        
        const result = await RecommendationEngine.evaluateModels({
            algorithms,
            metrics
        });
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('Evaluate models error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/recommendations/statistics
 * @desc Get recommendation system statistics
 * @access Private
 */
router.get('/statistics', async (req, res) => {
    try {
        const { timeRange = '24h' } = req.query;
        
        const statistics = await RecommendationEngine.getStatistics(timeRange);
        
        res.json({
            success: true,
            data: statistics
        });
        
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/recommendations/metrics
 * @desc Get system metrics
 * @access Private
 */
router.get('/metrics', async (req, res) => {
    try {
        const metrics = await RecommendationEngine.getMetrics();
        
        res.json({
            success: true,
            data: metrics
        });
        
    } catch (error) {
        console.error('Get metrics error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/recommendations/ab-test/assign
 * @desc Assign user to A/B test group
 * @access Private
 */
router.post('/ab-test/assign', validateRequest, async (req, res) => {
    try {
        const { userId, testName, variants } = req.body;
        
        if (!userId || !testName || !variants) {
            return res.status(400).json({ 
                success: false, 
                error: 'User ID, test name, and variants are required' 
            });
        }
        
        const assignment = await ABTestingFramework.assignUserToTest(userId, testName, variants);
        
        res.json({
            success: true,
            data: assignment
        });
        
    } catch (error) {
        console.error('A/B test assignment error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/recommendations/ab-test/track
 * @desc Track A/B test event
 * @access Private
 */
router.post('/ab-test/track', validateRequest, async (req, res) => {
    try {
        const { userId, testName, event, value } = req.body;
        
        if (!userId || !testName || !event) {
            return res.status(400).json({ 
                success: false, 
                error: 'User ID, test name, and event are required' 
            });
        }
        
        await ABTestingFramework.trackEvent(userId, testName, event, value);
        
        res.json({
            success: true,
            message: 'A/B test event tracked successfully'
        });
        
    } catch (error) {
        console.error('A/B test tracking error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/recommendations/ab-test/results/:testName
 * @desc Get A/B test results
 * @access Private
 */
router.get('/ab-test/results/:testName', async (req, res) => {
    try {
        const { testName } = req.params;
        
        const results = await ABTestingFramework.getTestResults(testName);
        
        res.json({
            success: true,
            data: results
        });
        
    } catch (error) {
        console.error('Get A/B test results error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/recommendations/cache/clear
 * @desc Clear recommendation cache
 * @access Private
 */
router.post('/cache/clear', validateRequest, async (req, res) => {
    try {
        const { userId = null } = req.body;
        
        if (userId) {
            await RecommendationEngine.clearUserCache(userId);
        } else {
            await RecommendationEngine.clearAllCache();
        }
        
        res.json({
            success: true,
            message: userId ? `Cache cleared for user ${userId}` : 'All cache cleared'
        });
        
    } catch (error) {
        console.error('Clear cache error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/recommendations/algorithms
 * @desc Get available recommendation algorithms
 * @access Public
 */
router.get('/algorithms', (req, res) => {
    try {
        const algorithms = {
            collaborative: {
                name: 'Collaborative Filtering',
                description: 'Recommends courses based on similar users\' preferences',
                variants: ['user_based', 'item_based', 'matrix_factorization', 'implicit', 'lightfm']
            },
            content_based: {
                name: 'Content-Based Filtering',
                description: 'Recommends courses based on content similarity to user preferences',
                variants: ['tfidf', 'semantic', 'hybrid']
            },
            hybrid: {
                name: 'Hybrid Approach',
                description: 'Combines collaborative and content-based methods',
                variants: ['weighted', 'switching', 'cascade']
            }
        };
        
        res.json({
            success: true,
            data: algorithms
        });
        
    } catch (error) {
        console.error('Get algorithms error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/recommendations/categories
 * @desc Get available course categories
 * @access Public
 */
router.get('/categories', (req, res) => {
    try {
        const categories = [
            'Programming',
            'Data Science',
            'Web Development',
            'Mobile Development',
            'AI/ML',
            'Cloud Computing',
            'DevOps',
            'Cybersecurity',
            'Blockchain',
            'Game Development',
            'Design',
            'Business',
            'Marketing',
            'Photography',
            'Music'
        ];
        
        res.json({
            success: true,
            data: categories
        });
        
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/recommendations/batch
 * @desc Get recommendations for multiple users
 * @access Private
 */
router.post('/batch', validateRequest, async (req, res) => {
    try {
        const { userIds, options = {} } = req.body;
        
        if (!userIds || !Array.isArray(userIds)) {
            return res.status(400).json({ 
                success: false, 
                error: 'User IDs array is required' 
            });
        }
        
        const results = {};
        
        // Process in parallel with concurrency limit
        const concurrencyLimit = 10;
        const chunks = [];
        
        for (let i = 0; i < userIds.length; i += concurrencyLimit) {
            chunks.push(userIds.slice(i, i + concurrencyLimit));
        }
        
        for (const chunk of chunks) {
            const promises = chunk.map(async (userId) => {
                try {
                    const recommendations = await RecommendationEngine.getRecommendations(userId, options);
                    return { userId, recommendations };
                } catch (error) {
                    return { userId, error: error.message };
                }
            });
            
            const chunkResults = await Promise.all(promises);
            chunkResults.forEach(result => {
                results[result.userId] = result.recommendations || { error: result.error };
            });
        }
        
        res.json({
            success: true,
            data: {
                results,
                totalUsers: userIds.length,
                processedUsers: Object.keys(results).length
            }
        });
        
    } catch (error) {
        console.error('Batch recommendations error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/recommendations/user/:userId/history
 * @desc Get user's recommendation history
 * @access Private
 */
router.get('/user/:userId/history', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        
        const history = await UserBehaviorTracker.getRecommendationHistory(userId, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            data: history
        });
        
    } catch (error) {
        console.error('Get recommendation history error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
