const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  badgeId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '🏆'
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  category: {
    type: String,
    enum: ['milestone', 'streak', 'learning', 'level', 'skill', 'social', 'special'],
    required: true
  },
  points: {
    type: Number,
    default: 0
  },
  progress: {
    current: {
      type: Number,
      default: 0
    },
    max: {
      type: Number,
      default: 1
    }
  },
  earnedDate: {
    type: Date
  },
  isEarned: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index for efficient queries
achievementSchema.index({ userId: 1, isEarned: 1 });
achievementSchema.index({ userId: 1, category: 1 });
achievementSchema.index({ userId: 1, badgeId: 1 }, { unique: true });
achievementSchema.index({ userId: 1, earnedDate: -1 });
achievementSchema.index({ rarity: 1, points: -1 });

module.exports = mongoose.model('Achievement', achievementSchema);
