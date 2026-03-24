const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['payment', 'account_creation', 'trustline', 'claimable_balance', 'multisig', 'other']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'submitted', 'success', 'failed', 'timeout'],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    required: true,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  sourceAccount: {
    type: String,
    required: true
  },
  destinationAccount: {
    type: String
  },
  amount: {
    type: String,
    required: false
  },
  asset: {
    type: {
      code: String,
      issuer: String
    },
    required: false
  },
  transactionXdr: {
    type: String,
    required: false
  },
  signedTransactionXdr: {
    type: String,
    required: false
  },
  stellarTransactionHash: {
    type: String,
    required: false,
    index: true
  },
  stellarLedger: {
    type: Number,
    required: false
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  lastError: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  submittedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ priority: 1, status: 1 });

// Instance methods
transactionSchema.methods.markAsProcessing = function() {
  this.status = 'processing';
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.markAsSubmitted = function(txHash) {
  this.status = 'submitted';
  this.stellarTransactionHash = txHash;
  this.submittedAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.markAsSuccess = function(ledger) {
  this.status = 'success';
  this.stellarLedger = ledger;
  this.completedAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.markAsFailed = function(error) {
  this.status = 'failed';
  this.lastError = error;
  this.retryCount += 1;
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.markAsTimeout = function() {
  this.status = 'timeout';
  this.lastError = 'Transaction timeout';
  this.updatedAt = new Date();
  return this.save();
};

transactionSchema.methods.canRetry = function() {
  return this.retryCount < this.maxRetries && (this.status === 'failed' || this.status === 'timeout');
};

transactionSchema.methods.resetForRetry = function() {
  this.status = 'pending';
  this.lastError = undefined;
  this.updatedAt = new Date();
  return this.save();
};

// Static methods
transactionSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId };
  if (options.status) query.status = options.status;
  if (options.type) query.type = options.type;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

transactionSchema.statics.findPendingTransactions = function(limit = 100) {
  return this.find({ status: 'pending' })
    .sort({ priority: -1, createdAt: 1 })
    .limit(limit);
};

transactionSchema.statics.findRetryableTransactions = function() {
  return this.find({
    status: { $in: ['failed', 'timeout'] },
    retryCount: { $lt: this.maxRetries }
  });
};

transactionSchema.statics.getTransactionStats = function(userId) {
  const matchStage = userId ? { userId } : {};
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Pre-save middleware
transactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
