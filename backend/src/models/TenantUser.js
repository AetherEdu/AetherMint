const mongoose = require('mongoose');

const tenantUserSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  
  // User profile information
  profile: {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    avatar: String,
    bio: String,
    phone: String,
    timezone: {
      type: String,
      default: 'UTC'
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  
  // Stellar wallet information
  stellar: {
    publicKey: {
      type: String,
      required: true,
      unique: true,
      match: /^G[0-9A-Z]{55}$/
    },
    secretKey: String, // Encrypted
    isVerified: {
      type: Boolean,
      default: false
    }
  },
  
  // Authentication
  auth: {
    password: String, // Hashed
    emailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    lastLogin: Date,
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: Date
  },
  
  // Role-based access control
  roles: [{
    type: String,
    enum: ['super_admin', 'tenant_admin', 'instructor', 'student', 'ta']
  }],
  permissions: [{
    resource: String,
    actions: [String]
  }],
  
  // Tenant-specific settings
  preferences: {
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      }
    },
    privacy: {
      profileVisibility: {
        type: String,
        enum: ['public', 'tenant', 'private'],
        default: 'tenant'
      },
      showEmail: {
        type: Boolean,
        default: false
      },
      showPhone: {
        type: Boolean,
        default: false
      }
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    }
  },
  
  // Academic information
  academic: {
    studentId: String,
    grade: String,
    department: String,
    major: String,
    enrollmentDate: Date,
    graduationDate: Date,
    gpa: Number,
    credits: {
      completed: {
        type: Number,
        default: 0
      },
      inProgress: {
        type: Number,
        default: 0
      },
      total: {
        type: Number,
        default: 0
      }
    }
  },
  
  // Activity tracking
  activity: {
    lastActive: {
      type: Date,
      default: Date.now
    },
    totalLogins: {
      type: Number,
      default: 0
    },
    totalTimeSpent: {
      type: Number,
      default: 0 // in minutes
    },
    coursesCompleted: {
      type: Number,
      default: 0
    },
    certificatesEarned: {
      type: Number,
      default: 0
    }
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: 'pending'
  },
  
  // Metadata
  metadata: {
    source: {
      type: String,
      enum: ['registration', 'admin_created', 'import', 'sso'],
      default: 'registration'
    },
    referralCode: String,
    notes: String,
    tags: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for tenant isolation
tenantUserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
tenantUserSchema.index({ tenantId: 1, 'stellar.publicKey': 1 }, { unique: true });
tenantUserSchema.index({ tenantId: 1, status: 1 });
tenantUserSchema.index({ tenantId: 1, roles: 1 });

// Single-column index for wallet address lookups across tenants
tenantUserSchema.index({ 'stellar.publicKey': 1 });

// Composite: wallet address + verification status
tenantUserSchema.index({ 'stellar.publicKey': 1, 'stellar.isVerified': 1 });

// Composite: tenant + role + status for admin queries
tenantUserSchema.index({ tenantId: 1, roles: 1, status: 1 });

// Virtual for full name
tenantUserSchema.virtual('profile.fullName').get(function() {
  return `${this.profile.firstName} ${this.profile.lastName}`;
});

// Virtual for account lock status
tenantUserSchema.virtual('auth.isLocked').get(function() {
  return !!(this.auth.lockUntil && this.auth.lockUntil > Date.now());
});

// Method to check if user has specific role
tenantUserSchema.methods.hasRole = function(role) {
  return this.roles.includes(role);
};

// Method to check if user has specific permission
tenantUserSchema.methods.hasPermission = function(resource, action) {
  const permission = this.permissions.find(p => p.resource === resource);
  return permission && permission.actions.includes(action);
};

// Method to add role
tenantUserSchema.methods.addRole = function(role) {
  if (!this.roles.includes(role)) {
    this.roles.push(role);
  }
};

// Method to remove role
tenantUserSchema.methods.removeRole = function(role) {
  this.roles = this.roles.filter(r => r !== role);
};

// Method to increment login attempts
tenantUserSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.auth.lockUntil && this.auth.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { 'auth.lockUntil': 1 },
      $set: { 'auth.loginAttempts': 1 }
    });
  }
  
  const updates = { $inc: { 'auth.loginAttempts': 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.auth.loginAttempts + 1 >= 5 && !this.auth.isLocked) {
    updates.$set = { 'auth.lockUntil': Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
tenantUserSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { 'auth.loginAttempts': 1, 'auth.lockUntil': 1 },
    $set: { 'auth.lastLogin': new Date(), $inc: { 'activity.totalLogins': 1 } }
  });
};

// Pre-save middleware to validate Stellar address
tenantUserSchema.pre('save', function(next) {
  if (this.isModified('stellar.publicKey')) {
    if (!/^G[0-9A-Z]{55}$/.test(this.stellar.publicKey)) {
      next(new Error('Invalid Stellar public key format'));
      return;
    }
  }
  next();
});

// Static method to find user by tenant and email
tenantUserSchema.statics.findByTenantEmail = function(tenantId, email) {
  return this.findOne({ tenantId, 'profile.email': email.toLowerCase() });
};

// Static method to find user by Stellar public key
tenantUserSchema.statics.findByStellarAddress = function(publicKey) {
  return this.findOne({ 'stellar.publicKey': publicKey });
};

module.exports = mongoose.model('TenantUser', tenantUserSchema);
