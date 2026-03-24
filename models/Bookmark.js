const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true
  },
  timestamp: {
    type: Number, // in seconds for video/audio
    required: true
  },
  note: {
    type: String,
    trim: true,
    maxlength: 500
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure unique bookmarks per user per content
bookmarkSchema.index({ user: 1, content: 1 }, { unique: true });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
