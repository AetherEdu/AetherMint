const Joi = require('joi');

// Custom validation functions - must be defined before Joi.extend
const validateStellarPublicKey = (value, helpers) => {
  try {
    if (!value || typeof value !== 'string') {
      return helpers.error('custom.invalidPublicKey');
    }
    if (value.length !== 56 || !value.startsWith('G')) {
      return helpers.error('custom.invalidPublicKey');
    }
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
    const amountRegex = /^\d+(\.\d{1,7})?$/;
    if (!amountRegex.test(value)) {
      return helpers.error('custom.invalidAmount');
    }
    const amount = parseFloat(value);
    if (amount <= 0) {
      return helpers.error('custom.invalidAmount');
    }
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

// Transaction validation schemas
const transactionSchemas = {
  credential_issuance: customJoi.object({
    sourceAccount: customJoi.string().stellarPublicKey().required(),
    secretKey: customJoi.string().when('signatures', {
      is: customJoi.exist(),
      then: customJoi.optional(),
      otherwise: customJoi.required(),
    }),
    signatures: customJoi.array().items(customJoi.object({
      publicKey: customJoi.string().stellarPublicKey().required(),
      signature: customJoi.string().required(),
    })).optional(),
    recipients: customJoi.alternatives().try(
      customJoi.array().items(customJoi.object({
        address: customJoi.string().stellarPublicKey().required(),
        amount: customJoi.string().default('0'),
      })).min(1).max(50),
      customJoi.object({
        address: customJoi.string().stellarPublicKey().required(),
        amount: customJoi.string().default('0'),
      })
    ).required(),
    credentialData: customJoi.object().pattern(customJoi.string(), customJoi.any()).optional(),
    memoText: customJoi.string().max(28).optional(),
    gasOptimization: customJoi.object({
      strategy: customJoi.string().valid('economy', 'standard', 'priority').default('standard'),
      estimatedFee: customJoi.number().integer().min(100).required(),
      savings: customJoi.number().integer().min(0).default(0),
      confidence: customJoi.number().min(0).max(1).required(),
    }).required(),
  }),

  course_payment: customJoi.object({
    sourceAccount: customJoi.string().stellarPublicKey().required(),
    secretKey: customJoi.string().when('signatures', {
      is: customJoi.exist(),
      then: customJoi.optional(),
      otherwise: customJoi.required(),
    }),
    signatures: customJoi.array().items(customJoi.object({
      publicKey: customJoi.string().stellarPublicKey().required(),
      signature: customJoi.string().required(),
    })).optional(),
    merchantAccount: customJoi.string().stellarPublicKey().required(),
    amount: customJoi.string().stellarAmount().required(),
    asset: customJoi.object({
      code: customJoi.string().alphanum().min(1).max(12).required(),
      issuer: customJoi.string().stellarPublicKey().required(),
    }).optional(),
    memoText: customJoi.string().max(28).optional(),
    courseData: customJoi.object({
      courseId: customJoi.string().required(),
      userId: customJoi.string().required(),
    }).optional(),
    gasOptimization: customJoi.object({
      strategy: customJoi.string().valid('economy', 'standard', 'priority', 'combined_payment', 'recurring_payment').required(),
      estimatedFee: customJoi.number().integer().min(100).required(),
      savings: customJoi.number().integer().min(0).default(0),
      confidence: customJoi.number().min(0).max(1).required(),
    }).required(),
  }),

  smart_contract_interaction: customJoi.object({
    sourceAccount: customJoi.string().stellarPublicKey().required(),
    secretKey: customJoi.string().when('signatures', {
      is: customJoi.exist(),
      then: customJoi.optional(),
      otherwise: customJoi.required(),
    }),
    signatures: customJoi.array().items(customJoi.object({
      publicKey: customJoi.string().stellarPublicKey().required(),
      signature: customJoi.string().required(),
    })).optional(),
    contractId: customJoi.string().required(),
    contractType: customJoi.string().valid('soroban', 'traditional').default('soroban'),
    method: customJoi.string().required(),
    args: customJoi.array().items(customJoi.any()).optional(),
    memoText: customJoi.string().max(28).optional(),
    batchCalls: customJoi.array().items(customJoi.object({
      method: customJoi.string().required(),
      args: customJoi.array().items(customJoi.any()).optional(),
    })).optional(),
    gasOptimization: customJoi.object({
      strategy: customJoi.string().valid('standard', 'batch_contract_calls').required(),
      estimatedFee: customJoi.number().integer().min(100).required(),
      savings: customJoi.number().integer().min(0).default(0),
      confidence: customJoi.number().min(0).max(1).required(),
    }).required(),
  }),

  profile_update: customJoi.object({
    sourceAccount: customJoi.string().stellarPublicKey().required(),
    secretKey: customJoi.string().when('signatures', {
      is: customJoi.exist(),
      then: customJoi.optional(),
      otherwise: customJoi.required(),
    }),
    signatures: customJoi.array().items(customJoi.object({
      publicKey: customJoi.string().stellarPublicKey().required(),
      signature: customJoi.string().required(),
    })).optional(),
    userId: customJoi.string().required(),
    updatedFields: customJoi.object().pattern(customJoi.string(), customJoi.any()).required(),
    accountOptions: customJoi.object({
      inflationDest: customJoi.string().stellarPublicKey().optional(),
      clearFlags: customJoi.number().integer().min(0).max(255).optional(),
      setFlags: customJoi.number().integer().min(0).max(255).optional(),
      masterWeight: customJoi.number().integer().min(0).max(255).optional(),
      lowThreshold: customJoi.number().integer().min(0).max(255).optional(),
      medThreshold: customJoi.number().integer().min(0).max(255).optional(),
      highThreshold: customJoi.number().integer().min(0).max(255).optional(),
      homeDomain: customJoi.string().max(32).optional(),
      signer: customJoi.object({
        ed25519PublicKey: customJoi.string().stellarPublicKey().required(),
        weight: customJoi.number().integer().min(1).max(255).required(),
      }).optional(),
    }).optional(),
    gasOptimization: customJoi.object({
      strategy: customJoi.string().valid('economy', 'standard', 'bulk_update').required(),
      estimatedFee: customJoi.number().integer().min(100).required(),
      savings: customJoi.number().integer().min(0).default(0),
      confidence: customJoi.number().min(0).max(1).required(),
    }).required(),
  }),
};

// Base transaction submission schema
const transactionSubmissionSchema = customJoi.object({
  type: customJoi.string().valid(
    'credential_issuance',
    'course_payment',
    'smart_contract_interaction',
    'profile_update'
  ).required(),
  payload: customJoi.when('type', {
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
  priority: customJoi.string().valid('critical', 'high', 'medium', 'low').default('medium'),
  userId: customJoi.string().required(),
  dependencies: customJoi.array().items(customJoi.string().uuid()).max(10).optional(),
});

// Bulk transaction submission schema
const bulkTransactionSchema = customJoi.object({
  transactions: customJoi.array().items(
    customJoi.object({
      type: customJoi.string().valid(
        'credential_issuance',
        'course_payment',
        'smart_contract_interaction',
        'profile_update'
      ).required(),
      payload: customJoi.when('type', {
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
      priority: customJoi.string().valid('critical', 'high', 'medium', 'low').default('medium'),
      dependencies: customJoi.array().items(customJoi.string().uuid()).max(10).optional(),
    })
  ).min(1).max(100).required(),
  options: customJoi.object({
    batchSize: customJoi.number().integer().min(1).max(50).default(10),
    continueOnError: customJoi.boolean().default(false),
    priority: customJoi.string().valid('critical', 'high', 'medium', 'low').optional(),
  }).optional(),
});

// Query parameter schemas
const querySchemas = {
  pagination: customJoi.object({
    page: customJoi.number().integer().min(1).default(1),
    limit: customJoi.number().integer().min(1).max(100).default(20),
  }),
  transactionFilter: customJoi.object({
    status: customJoi.string().valid('queued', 'processing', 'completed', 'failed', 'cancelled').optional(),
    type: customJoi.string().valid(
      'credential_issuance',
      'course_payment',
      'smart_contract_interaction',
      'profile_update'
    ).optional(),
    priority: customJoi.string().valid('critical', 'high', 'medium', 'low').optional(),
    dateFrom: customJoi.date().iso().optional(),
    dateTo: customJoi.date().iso().min(customJoi.ref('dateFrom')).optional(),
  }),
  analytics: customJoi.object({
    timeRange: customJoi.string().valid('1h', '24h', '7d', '30d').default('24h'),
    userId: customJoi.string().uuid().optional(),
    type: customJoi.string().valid(
      'credential_issuance',
      'course_payment',
      'smart_contract_interaction',
      'profile_update'
    ).optional(),
    groupBy: customJoi.string().valid('hour', 'day', 'type', 'status').default('hour'),
  }),
};

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