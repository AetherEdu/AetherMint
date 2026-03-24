const Joi = require('joi');

// Transaction validation schemas
const transactionSchemas = {
  credential_issuance: Joi.object({
    sourceAccount: Joi.string().stellarPublicKey().required(),
    secretKey: Joi.string().when('signatures', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
    signatures: Joi.array().items(Joi.object({
      publicKey: Joi.string().stellarPublicKey().required(),
      signature: Joi.string().required(),
    })).optional(),
    recipients: Joi.alternatives().try(
      Joi.array().items(Joi.object({
        address: Joi.string().stellarPublicKey().required(),
        amount: Joi.string().default('0'),
      })).min(1).max(50),
      Joi.object({
        address: Joi.string().stellarPublicKey().required(),
        amount: Joi.string().default('0'),
      })
    ).required(),
    credentialData: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
    memoText: Joi.string().max(28).optional(),
    gasOptimization: Joi.object({
      strategy: Joi.string().valid('economy', 'standard', 'priority').default('standard'),
      estimatedFee: Joi.number().integer().min(100).required(),
      savings: Joi.number().integer().min(0).default(0),
      confidence: Joi.number().min(0).max(1).required(),
    }).required(),
  }),

  course_payment: Joi.object({
    sourceAccount: Joi.string().stellarPublicKey().required(),
    secretKey: Joi.string().when('signatures', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
    signatures: Joi.array().items(Joi.object({
      publicKey: Joi.string().stellarPublicKey().required(),
      signature: Joi.string().required(),
    })).optional(),
    merchantAccount: Joi.string().stellarPublicKey().required(),
    amount: Joi.string().stellarAmount().required(),
    asset: Joi.object({
      code: Joi.string().alphanum().length(1, 12).required(),
      issuer: Joi.string().stellarPublicKey().required(),
    }).optional(),
    memoText: Joi.string().max(28).optional(),
    courseData: Joi.object({
      courseId: Joi.string().required(),
      userId: Joi.string().required(),
    }).optional(),
    gasOptimization: Joi.object({
      strategy: Joi.string().valid('economy', 'standard', 'priority', 'combined_payment', 'recurring_payment').required(),
      estimatedFee: Joi.number().integer().min(100).required(),
      savings: Joi.number().integer().min(0).default(0),
      confidence: Joi.number().min(0).max(1).required(),
    }).required(),
  }),

  smart_contract_interaction: Joi.object({
    sourceAccount: Joi.string().stellarPublicKey().required(),
    secretKey: Joi.string().when('signatures', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
    signatures: Joi.array().items(Joi.object({
      publicKey: Joi.string().stellarPublicKey().required(),
      signature: Joi.string().required(),
    })).optional(),
    contractId: Joi.string().required(),
    contractType: Joi.string().valid('soroban', 'traditional').default('soroban'),
    method: Joi.string().required(),
    args: Joi.array().items(Joi.any()).optional(),
    memoText: Joi.string().max(28).optional(),
    batchCalls: Joi.array().items(Joi.object({
      method: Joi.string().required(),
      args: Joi.array().items(Joi.any()).optional(),
    })).optional(),
    gasOptimization: Joi.object({
      strategy: Joi.string().valid('standard', 'batch_contract_calls').required(),
      estimatedFee: Joi.number().integer().min(100).required(),
      savings: Joi.number().integer().min(0).default(0),
      confidence: Joi.number().min(0).max(1).required(),
    }).required(),
  }),

  profile_update: Joi.object({
    sourceAccount: Joi.string().stellarPublicKey().required(),
    secretKey: Joi.string().when('signatures', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
    signatures: Joi.array().items(Joi.object({
      publicKey: Joi.string().stellarPublicKey().required(),
      signature: Joi.string().required(),
    })).optional(),
    userId: Joi.string().required(),
    updatedFields: Joi.object().pattern(Joi.string(), Joi.any()).required(),
    accountOptions: Joi.object({
      inflationDest: Joi.string().stellarPublicKey().optional(),
      clearFlags: Joi.number().integer().min(0).max(255).optional(),
      setFlags: Joi.number().integer().min(0).max(255).optional(),
      masterWeight: Joi.number().integer().min(0).max(255).optional(),
      lowThreshold: Joi.number().integer().min(0).max(255).optional(),
      medThreshold: Joi.number().integer().min(0).max(255).optional(),
      highThreshold: Joi.number().integer().min(0).max(255).optional(),
      homeDomain: Joi.string().max(32).optional(),
      signer: Joi.object({
        ed25519PublicKey: Joi.string().stellarPublicKey().required(),
        weight: Joi.number().integer().min(1).max(255).required(),
      }).optional(),
    }).optional(),
    gasOptimization: Joi.object({
      strategy: Joi.string().valid('economy', 'standard', 'bulk_update').required(),
      estimatedFee: Joi.number().integer().min(100).required(),
      savings: Joi.number().integer().min(0).default(0),
      confidence: Joi.number().min(0).max(1).required(),
    }).required(),
  }),
};

// Base transaction submission schema
const transactionSubmissionSchema = Joi.object({
  type: Joi.string().valid(
    'credential_issuance',
    'course_payment', 
    'smart_contract_interaction',
    'profile_update'
  ).required(),
  payload: Joi.when('type', {
    switch: [
      {
        is: 'credential_issuance',
        then: transactionSchemas.credential_issuance.required(),
      },
      {
        is: 'course_payment',
        then: transactionSchemas.course_payment.required(),
      },
      {
        is: 'smart_contract_interaction',
        then: transactionSchemas.smart_contract_interaction.required(),
      },
      {
        is: 'profile_update',
        then: transactionSchemas.profile_update.required(),
      },
    ],
  }),
  priority: Joi.string().valid('critical', 'high', 'medium', 'low').default('medium'),
  userId: Joi.string().required(),
  dependencies: Joi.array().items(Joi.string().uuid()).max(10).optional(),
});

// Bulk transaction submission schema
const bulkTransactionSchema = Joi.object({
  transactions: Joi.array().items(
    Joi.object({
      type: Joi.string().valid(
        'credential_issuance',
        'course_payment',
        'smart_contract_interaction', 
        'profile_update'
      ).required(),
      payload: Joi.when('type', {
        switch: [
          {
            is: 'credential_issuance',
            then: transactionSchemas.credential_issuance.required(),
          },
          {
            is: 'course_payment',
            then: transactionSchemas.course_payment.required(),
          },
          {
            is: 'smart_contract_interaction',
            then: transactionSchemas.smart_contract_interaction.required(),
          },
          {
            is: 'profile_update',
            then: transactionSchemas.profile_update.required(),
          },
        ],
      }),
      priority: Joi.string().valid('critical', 'high', 'medium', 'low').default('medium'),
      dependencies: Joi.array().items(Joi.string().uuid()).max(10).optional(),
    })
  ).min(1).max(100).required(),
  options: Joi.object({
    batchSize: Joi.number().integer().min(1).max(50).default(10),
    continueOnError: Joi.boolean().default(false),
    priority: Joi.string().valid('critical', 'high', 'medium', 'low').optional(),
  }).optional(),
});

// Query parameter schemas
const querySchemas = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
  transactionFilter: Joi.object({
    status: Joi.string().valid('queued', 'processing', 'completed', 'failed', 'cancelled').optional(),
    type: Joi.string().valid(
      'credential_issuance',
      'course_payment',
      'smart_contract_interaction',
      'profile_update'
    ).optional(),
    priority: Joi.string().valid('critical', 'high', 'medium', 'low').optional(),
    dateFrom: Joi.date().iso().optional(),
    dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional(),
  }),
  analytics: Joi.object({
    timeRange: Joi.string().valid('1h', '24h', '7d', '30d').default('24h'),
    userId: Joi.string().uuid().optional(),
    type: Joi.string().valid(
      'credential_issuance',
      'course_payment',
      'smart_contract_interaction',
      'profile_update'
    ).optional(),
    groupBy: Joi.string().valid('hour', 'day', 'type', 'status').default('hour'),
  }),
};

// Custom validation functions
const validateStellarPublicKey = (value, helpers) => {
  try {
    // Basic Stellar public key validation
    if (!value || typeof value !== 'string') {
      return helpers.error('custom.invalidPublicKey');
    }
    
    // Stellar public keys are 56 characters long and start with 'G'
    if (value.length !== 56 || !value.startsWith('G')) {
      return helpers.error('custom.invalidPublicKey');
    }
    
    // Check if it's valid base32
    const base32Regex = /^[ABCDEFGHIJKLMNOPQRSTUVWXYZ234567]+$/;
    if (!base32Regex.test(value.substring(1))) {
      return helpers.error('custom.invalidPublicKey');
    }
    
    return value;
  } catch (error) {
    return helpers.error('custom.invalidPublicKey');
  }
};

const validateStellarAmount = (value, helpers) => {
  try {
    if (!value || typeof value !== 'string') {
      return helpers.error('custom.invalidAmount');
    }
    
    // Stellar amounts can have up to 7 decimal places
    const amountRegex = /^\d+(\.\d{1,7})?$/;
    if (!amountRegex.test(value)) {
      return helpers.error('custom.invalidAmount');
    }
    
    const amount = parseFloat(value);
    if (amount <= 0) {
      return helpers.error('custom.invalidAmount');
    }
    
    // Maximum amount is 9223372036854775807 (2^63 - 1) stroops
    const maxAmount = 9223372036854775807 / 10000000;
    if (amount > maxAmount) {
      return helpers.error('custom.amountTooLarge');
    }
    
    return value;
  } catch (error) {
    return helpers.error('custom.invalidAmount');
  }
};

// Extend Joi with custom validators
const customJoi = Joi.extend({
  type: 'string',
  base: Joi.string(),
  messages: {
    'stellarPublicKey': '{{#label}} must be a valid Stellar public key',
    'stellarAmount': '{{#label}} must be a valid Stellar amount',
  },
  rules: {
    stellarPublicKey: {
      validate: validateStellarPublicKey,
      args: [],
    },
    stellarAmount: {
      validate: validateStellarAmount,
      args: [],
    },
  },
});

// Validation middleware factory
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value,
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    // Replace the request data with validated and sanitized data
    req[source] = value;
    next();
  };
};

// Specific validation middleware functions
const validateTransaction = validate(transactionSubmissionSchema);
const validateBulkTransaction = validate(bulkTransactionSchema);
const validatePaginationQuery = validate(querySchemas.pagination, 'query');
const validateTransactionFilter = validate(querySchemas.transactionFilter, 'query');
const validateAnalyticsQuery = validate(querySchemas.analytics, 'query');

// Advanced validation for complex scenarios
const validateTransactionDependencies = async (req, res, next) => {
  try {
    const { dependencies } = req.body;
    
    if (!dependencies || dependencies.length === 0) {
      return next();
    }

    // This would check if dependencies exist and are in valid states
    // For now, we'll just validate the format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    for (const depId of dependencies) {
      if (!uuidRegex.test(depId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid dependency ID format',
          error: `Dependency ${depId} is not a valid UUID`,
        });
      }
    }

    next();
  } catch (error) {
    console.error('Dependency validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Dependency validation failed',
      error: error.message,
    });
  }
};

const validateUserTierLimits = async (req, res, next) => {
  try {
    const user = req.user;
    const { transactions } = req.body;
    
    if (!user || !user.role) {
      return next();
    }

    const securityConfig = require('../config/security');
    const roleKey = user.role === 'educator' ? 'instructor' : user.role;
    const limits = securityConfig.tiers[roleKey] || securityConfig.tiers.default;

    // Check batch size limit (if applicable for bulk transactions)
    if (transactions && transactions.length > (limits.burst || 10)) {
      return res.status(429).json({
        success: false,
        message: 'Batch size exceeds tier limit',
        error: `Maximum ${limits.burst || 10} transactions per batch for ${user.role} role`,
        limit: limits.burst || 10,
        requested: transactions.length,
      });
    }

    next();
  } catch (error) {
    console.error('Tier limit validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Tier limit validation failed',
      error: error.message,
    });
  }
};

module.exports = {
  validateTransaction,
  validateBulkTransaction,
  validatePaginationQuery,
  validateTransactionFilter,
  validateAnalyticsQuery,
  validateTransactionDependencies,
  validateUserTierLimits,
  transactionSchemas,
  querySchemas,
  customJoi,
};
