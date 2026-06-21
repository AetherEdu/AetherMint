const express = require('express');
const router = express.Router();
const GamificationEngine = require('../services/gamification/GamificationEngine');
const Achievement = require('../models/Achievement');
const Challenge = require('../models/Challenge');
const logger = require('../../utils/logger');

// Initialize engine
const gamificationEngine = new GamificationEngine();

/**
 * @route GET /api/gamification/leaderboard
 * @desc Get leaderboard with optional filtering
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { category = 'global', categoryId, page = 1, limit = 50 } = req.query;
    
    const leaderboard = await gamificationEngine.getLeaderboard(
      category, 
      categoryId, 
      parseInt(page), 
      parseInt(limit)
    );

    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    logger.error('Error getting leaderboard:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/gamification/user/:userId/achievements
 * @desc Get user's achievements
 */
router.get('/user/:userId/achievements', async (req, res) => {
  try {
    const { userId } = req.params;
    const { earned, category } = req.query;

    const query = { userId };
    if (earned !== undefined) query.isEarned = earned === 'true';
    if (category) query.category = category;

    const achievements = await Achievement.find(query).sort({ earnedDate: -1 });

    res.json({
      success: true,
      data: achievements
    });
  } catch (error) {
    logger.error('Error getting achievements:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/gamification/event
 * @desc Process gamification event (lesson complete, quiz complete, etc.)
 */
router.post('/event', async (req, res) => {
  try {
    const { userId, event, data } = req.body;

    if (!userId || !event) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, event'
      });
    }

    const result = await gamificationEngine.processEvent(userId, event, data);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error processing event:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/gamification/points/award
 * @desc Award points to user
 */
router.post('/points/award', async (req, res) => {
  try {
    const { userId, amount, category, description, metadata } = req.body;

    if (!userId || amount === undefined || !category || !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, amount, category, description'
      });
    }

    const transaction = await gamificationEngine.awardPoints(
      userId, 
      amount, 
      category, 
      description,
      metadata
    );

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    logger.error('Error awarding points:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/gamification/challenges
 * @desc Get active challenges
 */
router.get('/challenges', async (req, res) => {
  try {
    const { status = 'active', type, category } = req.query;
    
    const query = { status };
    if (type) query.type = type;
    if (category) query.category = category;

    const challenges = await Challenge.find(query)
      .sort({ startDate: -1 })
      .limit(20);

    res.json({
      success: true,
      data: challenges
    });
  } catch (error) {
    logger.error('Error getting challenges:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/gamification/challenges/:challengeId/join
 * @desc Join a challenge
 */
router.post('/challenges/:challengeId/join', async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { userId } = req.body;

    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: 'Challenge not found'
      });
    }

    if (challenge.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Challenge is not active'
      });
    }

    // Add participant
    challenge.participants.push({
      userId,
      joinedAt: new Date(),
      progress: 0,
      completed: false
    });

    await challenge.save();

    res.json({
      success: true,
      message: 'Joined challenge successfully'
    });
  } catch (error) {
    logger.error('Error joining challenge:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route PUT /api/gamification/challenges/:challengeId/progress
 * @desc Update challenge progress
 */
router.put('/challenges/:challengeId/progress', async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { userId, objectiveId, progress } = req.body;

    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: 'Challenge not found'
      });
    }

    const participant = challenge.participants.find(p => p.userId === userId);
    
    if (!participant) {
      return res.status(404).json({
        success: false,
        error: 'Not a participant of this challenge'
      });
    }

    // Update objective progress
    const objective = challenge.objectives.find(o => o.id === objectiveId);
    if (objective) {
      objective.current = progress;
      if (progress >= objective.target) {
        objective.completed = true;
      }
    }

    await challenge.save();

    // Check if challenge completed
    const allCompleted = challenge.objectives.every(o => o.completed);
    if (allCompleted && !participant.completed) {
      participant.completed = true;
      
      // Award rewards
      if (challenge.rewards.points > 0) {
        await gamificationEngine.awardPoints(
          userId,
          challenge.rewards.points,
          'challenge',
          `Completed challenge: ${challenge.title}`
        );
      }
    }

    res.json({
      success: true,
      data: {
        participant,
        challengeCompleted: allCompleted
      }
    });
  } catch (error) {
    logger.error('Error updating challenge progress:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
