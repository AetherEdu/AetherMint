const mongoose = require('mongoose');

const offlineContentSchema = new mongoose.Schema({
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
  deviceId: {
    type: String,
    required: true
  },
  cachedFiles: [{
    type: {
      type: String,
      enum: ['video', 'audio', 'document', 'thumbnail', 'subtitle'],
      required: true
    },
    localPath: String,
    size: Number,
    checksum: String,
    downloadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isDownloaded: {
    type: Boolean,
    default: false
  },
  downloadProgress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  }
});

// Indexes
offlineContentSchema.index({ user: 1, deviceId: 1 });
offlineContentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OfflineContent', offlineContentSchema);
