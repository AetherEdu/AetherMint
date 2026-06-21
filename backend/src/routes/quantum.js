"""
Quantum Computing API Routes
RESTful API endpoints for quantum computing services
"""

const express = require('express');
const router = express.Router();
const { body, validationResult, param } = require('express-validator');

// Import quantum services
const {
  quantum_service,
  quantum_optimizer_service,
  quantum_ml_service,
  quantum_circuit_service,
  quantum_resource_manager,
  hybrid_computing_service,
  quantum_error_correction_service
} = require('../services/quantumServices');

// Middleware for validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// ==================== Quantum Algorithm Integration ====================

// Get available quantum providers
router.get('/providers', async (req, res) => {
  try {
    const providers = quantum_service.get_available_providers();
    const providerInfo = {};
    
    for (const providerName of providers) {
      providerInfo[providerName] = await quantum_service.get_provider_info(providerName);
    }
    
    res.json({
      success: true,
      data: {
        providers,
        providerInfo
      }
    });
  } catch (error) {
    console.error('Error getting quantum providers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Connect to quantum provider
router.post('/providers/connect', [
  body('provider').notEmpty().isIn(['ibmq', 'google', 'azure', 'amazon']),
  body('config').notEmpty().isObject(),
  body('config.provider').notEmpty(),
  body('config.backend_name').notEmpty()
], handleValidationErrors, async (req, res) => {
  try {
    const { provider, config } = req.body;
    
    const backendConfig = {
      provider: config.provider,
      backend_name: config.backend_name,
      access_token: config.access_token,
      num_qubits: config.num_qubits || 32,
      shots: config.shots || 1024,
      optimization_level: config.optimization_level || 3
    };
    
    const success = await quantum_service.connect_provider(provider, backendConfig);
    
    if (success) {
      res.json({
        success: true,
        message: `Successfully connected to ${provider} quantum provider`,
        data: await quantum_service.get_provider_info(provider)
      });
    } else {
      res.status(400).json({
        success: false,
        error: `Failed to connect to ${provider} quantum provider`
      });
    }
  } catch (error) {
    console.error('Error connecting to quantum provider:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Execute quantum circuit
router.post('/execute', [
  body('circuit').notEmpty(),
  body('shots').optional().isInt({ min: 1, max: 10000 }),
  body('provider').optional().isString()
], handleValidationErrors, async (req, res) => {
  try {
    const { circuit, shots = 1024, provider } = req.body;
    
    const result = await quantum_service.execute_quantum_circuit(circuit, shots, provider);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error executing quantum circuit:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get quantum job history
router.get('/jobs/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const history = quantum_service.get_job_history(limit);
    
    res.json({
      success: true,
      data: {
        jobs: history,
        total: history.length
      }
    });
  } catch (error) {
    console.error('Error getting job history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== Quantum Optimization ====================

// Get available optimizers
router.get('/optimization/optimizers', async (req, res) => {
  try {
    const optimizers = quantum_optimizer_service.get_available_optimizers();
    const optimizerInfo = {};
    
    for (const optimizerName of optimizers) {
      optimizerInfo[optimizerName] = quantum_optimizer_service.get_optimizer_info(optimizerName);
    }
    
    res.json({
      success: true,
      data: {
        optimizers,
        optimizerInfo
      }
    });
  } catch (error) {
    console.error('Error getting optimizers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Solve optimization problem
router.post('/optimization/solve', [
  body('problem').notEmpty().isObject(),
  body('problem.problem_id').notEmpty(),
  body('problem.problem_type').notEmpty().isIn(['qubo', 'maxcut', 'tsp', 'portfolio', 'scheduling']),
  body('problem.variables').isInt({ min: 1 }),
  body('optimizer_name').optional().isString()
], handleValidationErrors, async (req, res) => {
  try {
    const { problem, optimizer_name = 'qaoa' } = req.body;
    
    const optimizationProblem = {
      problem_id: problem.problem_id,
      problem_type: problem.problem_type,
      variables: problem.variables,
      constraints: problem.constraints || [],
      objective_matrix: problem.objective_matrix ? new Float32Array(problem.objective_matrix.flat()) : null,
      objective_vector: problem.objective_vector ? new Float32Array(problem.objective_vector) : null,
      metadata: problem.metadata || {}
    };
    
    const result = await quantum_optimizer_service.solve_problem(optimizationProblem, optimizer_name);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error solving optimization problem:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Compare optimizers
router.post('/optimization/compare', [
  body('problem').notEmpty().isObject(),
  body('optimizer_names').isArray().notEmpty()
], handleValidationErrors, async (req, res) => {
  try {
    const { problem, optimizer_names } = req.body;
    
    const optimizationProblem = {
      problem_id: problem.problem_id,
      problem_type: problem.problem_type,
      variables: problem.variables,
      constraints: problem.constraints || [],
      objective_matrix: problem.objective_matrix ? new Float32Array(problem.objective_matrix.flat()) : null,
      objective_vector: problem.objective_vector ? new Float32Array(problem.objective_vector) : null,
      metadata: problem.metadata || {}
    };
    
    const results = quantum_optimizer_service.compare_optimizers(optimizationProblem, optimizer_names);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error comparing optimizers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== Quantum Machine Learning ====================

// Get available ML algorithms
router.get('/ml/algorithms', async (req, res) => {
  try {
    const algorithms = quantum_ml_service.get_available_algorithms();
    const algorithmInfo = {};
    
    for (const algorithmName of algorithms) {
      algorithmInfo[algorithmName] = quantum_ml_service.get_algorithm_info(algorithmName);
    }
    
    res.json({
      success: true,
      data: {
        algorithms,
        algorithmInfo
      }
    });
  } catch (error) {
    console.error('Error getting ML algorithms:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create ML model
router.post('/ml/models', [
  body('model_id').notEmpty(),
  body('model_type').notEmpty().isIn(['classification', 'regression', 'clustering', 'kernel']),
  body('architecture').notEmpty(),
  body('num_qubits').isInt({ min: 1, max: 32 }),
  body('num_layers').isInt({ min: 1, max: 10 }),
  body('parameters').optional().isObject()
], handleValidationErrors, async (req, res) => {
  try {
    const { model_id, model_type, architecture, num_qubits, num_layers, parameters = {} } = req.body;
    
    const model = quantum_ml_service.create_model(
      model_id, model_type, architecture, num_qubits, num_layers, parameters
    );
    
    res.json({
      success: true,
      data: quantum_ml_service.get_model_info(model_id)
    });
  } catch (error) {
    console.error('Error creating ML model:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Train ML model
router.post('/ml/models/:modelId/train', [
  param('modelId').notEmpty(),
  body('algorithm_name').notEmpty(),
  body('features').isArray(),
  body('labels').isArray()
], handleValidationErrors, async (req, res) => {
  try {
    const { modelId } = req.params;
    const { algorithm_name, features, labels } = req.body;
    
    // Convert to numpy-like arrays
    const X = new Float32Array(features.flat());
    const y = new Float32Array(labels);
    
    const result = await quantum_ml_service.train_model(modelId, algorithm_name, X, y);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error training ML model:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Make predictions
router.post('/ml/models/:modelId/predict', [
  param('modelId').notEmpty(),
  body('features').isArray()
], handleValidationErrors, async (req, res) => {
  try {
    const { modelId } = req.params;
    const { features } = req.body;
    
    const X = new Float32Array(features.flat());
    const result = await quantum_ml_service.predict(modelId, X);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error making predictions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== Quantum Circuit Design ====================

// Get available circuit designers
router.get('/circuits/designers', async (req, res) => {
  try {
    const designers = quantum_circuit_service.get_available_designers();
    const designerInfo = {};
    
    for (const designerName of designers) {
      designerInfo[designerName] = quantum_circuit_service.get_designer_info(designerName);
    }
    
    res.json({
      success: true,
      data: {
        designers,
        designerInfo
      }
    });
  } catch (error) {
    console.error('Error getting circuit designers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Design quantum circuit
router.post('/circuits/design', [
  body('circuit_id').notEmpty(),
  body('circuit_type').notEmpty().isIn(['feature_map', 'ansatz', 'measurement', 'custom']),
  body('num_qubits').isInt({ min: 1, max: 32 }),
  body('num_parameters').isInt({ min: 0 }),
  body('depth').isInt({ min: 1 }),
  body('gate_set').isArray(),
  body('designer_name').optional().isString()
], handleValidationErrors, async (req, res) => {
  try {
    const { circuit_id, circuit_type, num_qubits, num_parameters, depth, gate_set, designer_name = 'qiskit' } = req.body;
    
    const circuitSpec = {
      circuit_id,
      circuit_type,
      num_qubits,
      num_parameters,
      depth,
      gate_set,
      entanglement_pattern: req.body.entanglement_pattern || 'full',
      parameters: req.body.parameters || {},
      metadata: req.body.metadata || {}
    };
    
    const result = await quantum_circuit_service.design_circuit(circuitSpec, designer_name);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error designing circuit:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Optimize circuit
router.post('/circuits/:circuitId/optimize', [
  param('circuitId').notEmpty(),
  body('optimization_level').optional().isInt({ min: 0, max: 3 })
], handleValidationErrors, async (req, res) => {
  try {
    const { circuitId } = req.params;
    const { optimization_level = 1 } = req.body;
    
    const result = await quantum_circuit_service.optimize_circuit(circuitId, optimization_level);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error optimizing circuit:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List circuits
router.get('/circuits', async (req, res) => {
  try {
    const circuits = quantum_circuit_service.list_circuits();
    const circuitInfo = {};
    
    for (const circuitId of circuits) {
      circuitInfo[circuitId] = quantum_circuit_service.get_circuit_info(circuitId);
    }
    
    res.json({
      success: true,
      data: {
        circuits,
        circuitInfo
      }
    });
  } catch (error) {
    console.error('Error listing circuits:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== Quantum Resource Management ====================

// List resources
router.get('/resources', async (req, res) => {
  try {
    const { resource_type, status } = req.query;
    const resources = quantum_resource_manager.list_resources(resource_type, status);
    
    res.json({
      success: true,
      data: {
        resources,
        total: resources.length
      }
    });
  } catch (error) {
    console.error('Error listing resources:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get resource utilization
router.get('/resources/utilization', async (req, res) => {
  try {
    const utilization = quantum_resource_manager.get_resource_utilization();
    
    res.json({
      success: true,
      data: utilization
    });
  } catch (error) {
    console.error('Error getting resource utilization:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Submit job
router.post('/jobs', [
  body('job_id').notEmpty(),
  body('user_id').notEmpty(),
  body('priority').isInt({ min: 1, max: 10 }),
  body('resource_requirements').isObject(),
  body('estimated_duration').isFloat({ min: 0.1 }),
  body('circuit').notEmpty()
], handleValidationErrors, async (req, res) => {
  try {
    const jobData = req.body;
    
    const job = {
      job_id: jobData.job_id,
      user_id: jobData.user_id,
      priority: jobData.priority,
      resource_requirements: jobData.resource_requirements,
      estimated_duration: jobData.estimated_duration,
      deadline: jobData.deadline ? new Date(jobData.deadline) : null,
      circuit: jobData.circuit,
      parameters: jobData.parameters || {},
      status: 'pending'
    };
    
    const jobId = quantum_resource_manager.submit_job(job);
    
    res.json({
      success: true,
      data: {
        job_id: jobId,
        message: 'Job submitted successfully'
      }
    });
  } catch (error) {
    console.error('Error submitting job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Schedule job
router.post('/jobs/:jobId/schedule', [
  param('jobId').notEmpty(),
  body('scheduler_name').optional().isString()
], handleValidationErrors, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { scheduler_name = 'priority' } = req.body;
    
    const allocation = await quantum_resource_manager.schedule_job(jobId, scheduler_name);
    
    res.json({
      success: true,
      data: allocation
    });
  } catch (error) {
    console.error('Error scheduling job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== Hybrid Computing ====================

// Get available strategies
router.get('/hybrid/strategies', async (req, res) => {
  try {
    const strategies = hybrid_computing_service.get_available_strategies();
    const strategyInfo = {};
    
    for (const strategyName of strategies) {
      strategyInfo[strategyName] = hybrid_computing_service.get_strategy_info(strategyName);
    }
    
    res.json({
      success: true,
      data: {
        strategies,
        strategyInfo
      }
    });
  } catch (error) {
    console.error('Error getting hybrid strategies:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Execute hybrid task
router.post('/hybrid/execute', [
  body('task_id').notEmpty(),
  body('task_type').notEmpty().isIn(['classification', 'regression', 'optimization', 'clustering']),
  body('data').notEmpty(),
  body('quantum_component').notEmpty(),
  body('classical_component').notEmpty(),
  body('strategy_name').optional().isString()
], handleValidationErrors, async (req, res) => {
  try {
    const { task_id, task_type, data, quantum_component, classical_component, strategy_name } = req.body;
    
    const task = {
      task_id,
      task_type,
      data,
      quantum_component,
      classical_component,
      parameters: req.body.parameters || {},
      priority: req.body.priority || 'medium'
    };
    
    const result = await hybrid_computing_service.execute_task(task, strategy_name);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error executing hybrid task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== Error Correction ====================

// Get available error codes
router.get('/error-correction/codes', async (req, res) => {
  try {
    const codes = quantum_error_correction_service.get_available_codes();
    const codeInfo = {};
    
    for (const codeName of codes) {
      codeInfo[codeName] = quantum_error_correction_service.get_code_info(codeName);
    }
    
    res.json({
      success: true,
      data: {
        codes,
        codeInfo
      }
    });
  } catch (error) {
    console.error('Error getting error codes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Apply error correction
router.post('/error-correction/apply', [
  body('circuit').notEmpty(),
  body('code_name').notEmpty(),
  body('error_models').optional().isArray()
], handleValidationErrors, async (req, res) => {
  try {
    const { circuit, code_name, error_models } = req.body;
    
    const result = await quantum_error_correction_service.apply_error_correction(
      circuit, code_name, error_models
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error applying error correction:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get error correction performance
router.get('/error-correction/performance', async (req, res) => {
  try {
    const performance = quantum_error_correction_service.analyze_performance();
    
    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    console.error('Error getting error correction performance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== Health Check ====================

router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        quantum_algorithms: quantum_service.get_available_providers().length > 0,
        quantum_optimization: quantum_optimizer_service.get_available_optimizers().length > 0,
        quantum_ml: quantum_ml_service.get_available_algorithms().length > 0,
        quantum_circuits: quantum_circuit_service.get_available_designers().length > 0,
        resource_management: quantum_resource_manager.list_resources().length > 0,
        hybrid_computing: hybrid_computing_service.get_available_strategies().length > 0,
        error_correction: quantum_error_correction_service.get_available_codes().length > 0
      }
    };
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Error checking health:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
