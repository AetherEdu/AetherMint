const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  subdomain: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9-]+$/
  },
  domain: {
    type: String,
    sparse: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'trial'],
    default: 'trial'
  },
  plan: {
    type: String,
    enum: ['starter', 'professional', 'enterprise'],
    default: 'starter'
  },
  
  // White-label customization
  branding: {
    logo: String,
    primaryColor: {
      type: String,
      default: '#3B82F6'
    },
    secondaryColor: {
      type: String,
      default: '#10B981'
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    customCSS: String,
    favicon: String,
    companyName: String,
    supportEmail: String
  },
  
  // Configuration
  settings: {
    allowPublicRegistration: {
      type: Boolean,
      default: true
    },
    requireEmailVerification: {
      type: Boolean,
      default: true
    },
    enableSSO: {
      type: Boolean,
      default: false
    },
    ssoProvider: String,
    defaultLanguage: {
      type: String,
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    maxUsers: {
      type: Number,
      default: 100
    },
    maxStorage: {
      type: Number, // in MB
      default: 1024
    }
  },
  
  // Resource allocation and billing
  subscription: {
    startDate: Date,
    endDate: Date,
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly'
    },
    price: Number,
    currency: {
      type: String,
      default: 'USD'
    },
    autoRenew: {
      type: Boolean,
      default: true
    }
  },
  
  // Usage tracking
  usage: {
    users: {
      type: Number,
      default: 0
    },
    storage: {
      type: Number,
      default: 0 // in MB
    },
    apiCalls: {
      type: Number,
      default: 0
    },
    lastReset: {
      type: Date,
      default: Date.now
    }
  },
  
  // Contact information
  contact: {
    firstName: String,
    lastName: String,
    email: {
      type: String,
      required: true
    },
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String
    }
  },
  
  // Metadata
  metadata: {
    source: {
      type: String,
      enum: ['manual', 'self_service', 'api', 'migration'],
      default: 'self_service'
    },
    industry: String,
    size: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '500+']
    },
    notes: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
tenantSchema.index({ subdomain: 1 });
tenantSchema.index({ domain: 1 });
tenantSchema.index({ status: 1 });
tenantSchema.index({ 'subscription.endDate': 1 });
tenantSchema.index({ createdAt: -1 });
tenantSchema.index({ status: 1, createdAt: -1 });
tenantSchema.index({ plan: 1, status: 1 });
tenantSchema.index({ name: 'text' });

// Virtual for checking if tenant is active
tenantSchema.virtual('isActive').get(function() {
  return this.status === 'active' && 
         (!this.subscription.endDate || this.subscription.endDate > new Date());
});

// Virtual for days until subscription expires
tenantSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.subscription.endDate) return null;
  const diff = this.subscription.endDate.getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Method to check if user can be added
tenantSchema.methods.canAddUser = function() {
  return this.usage.users < this.settings.maxUsers;
};

// Method to check if storage can be allocated
tenantSchema.methods.canAllocateStorage = function(additionalMB) {
  return (this.usage.storage + additionalMB) <= this.settings.maxStorage;
};

// Method to increment usage
tenantSchema.methods.incrementUsage = function(type, amount = 1) {
  if (this.usage[type] !== undefined) {
    this.usage[type] += amount;
    this.markModified(`usage.${type}`);
  }
};

// Pre-save middleware to validate subdomain
tenantSchema.pre('save', function(next) {
  if (this.isModified('subdomain')) {
    // Reserve certain subdomains
    const reserved = ['www', 'api', 'admin', 'mail', 'ftp', 'ssl', 'test', 'staging', 'dev'];
    if (reserved.includes(this.subdomain)) {
      next(new Error(`Subdomain '${this.subdomain}' is reserved`));
      return;
    }
  }
  next();
});

// Static method to find tenant by domain or subdomain
tenantSchema.statics.findByDomain = function(domain) {
  const parts = domain.toLowerCase().split('.');
  if (parts.length >= 2) {
    const subdomain = parts[0];
    return this.findOne({
      $or: [
        { subdomain: subdomain },
        { domain: domain }
      ]
    });
  }
  return this.findOne({ domain: domain });
};

module.exports = mongoose.model('Tenant', tenantSchema);
