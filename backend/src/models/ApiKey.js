const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'revoked'],
    default: 'active'
  },
  lastUsedAt: Date,
  expiresAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Helper to generate a new API key
apiKeySchema.statics.generateKey = function() {
  const crypto = require('crypto');
  return 'sk_' + crypto.randomBytes(24).toString('hex');
};

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

module.exports = ApiKey;
