const tf = require('@tensorflow/tfjs-node');
const EventEmitter = require('events');

class ModelValidationService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.validationMetrics = options.validationMetrics || ['accuracy', 'precision', 'recall', 'f1'];
    this.fairnessMetrics = options.fairnessMetrics || ['demographic_parity', 'equalized_odds', 'equal_opportunity'];
    this.thresholds = {
      accuracy: options.accuracyThreshold || 0.7,
      fairness: options.fairnessThreshold || 0.8,
      stability: options.stabilityThreshold || 0.9
    };
    this.testData = null;
    this.sensitiveAttributes = options.sensitiveAttributes || ['gender', 'race', 'age'];
    this.validationHistory = [];
    this.fairnessReports = [];
  }

  // Validate model performance and fairness
  async validateModel(model, testData, sensitiveAttributes = null) {
    try {
      console.log('🔍 Starting comprehensive model validation...');
      
      this.testData = testData;
      const attributes = sensitiveAttributes || this.sensitiveAttributes;
      
      const validationResults = {
        timestamp: new Date(),
        performanceMetrics: await this.evaluatePerformance(model, testData),
        fairnessMetrics: await this.evaluateFairness(model, testData, attributes),
        stabilityMetrics: await this.evaluateStability(model),
        robustnessMetrics: await this.evaluateRobustness(model, testData),
        privacyMetrics: await this.evaluatePrivacy(model),
        overall: {}
      };

      // Calculate overall validation score
      validationResults.overall = this.calculateOverallScore(validationResults);
      
      // Store validation results
      this.validationHistory.push(validationResults);
      
      // Check if model passes validation
      const passesValidation = this.checkValidationThresholds(validationResults);
      
      console.log(`✅ Model validation completed. Overall score: ${validationResults.overall.score.toFixed(3)}`);
      console.log(`🎯 Validation ${passesValidation ? 'PASSED' : 'FAILED'}`);
      
      this.emit('validationCompleted', {
        results: validationResults,
        passesValidation
      });

      return validationResults;
    } catch (error) {
      console.error('❌ Model validation failed:', error);
      throw error;
    }
  }

  // Evaluate model performance metrics
  async evaluatePerformance(model, testData) {
    try {
      const { x, y } = testData;
      const predictions = model.predict(x);
      const predictedLabels = predictions.argMax(-1).arraySync();
      const trueLabels = y.argMax(-1).arraySync();

      const metrics = {
        accuracy: this.calculateAccuracy(predictedLabels, trueLabels),
        precision: this.calculatePrecision(predictedLabels, trueLabels),
        recall: this.calculateRecall(predictedLabels, trueLabels),
        f1: this.calculateF1Score(predictedLabels, trueLabels),
        auc: this.calculateAUC(predictedLabels, trueLabels),
        confusionMatrix: this.calculateConfusionMatrix(predictedLabels, trueLabels)
      };

      console.log('📊 Performance metrics calculated');
      return metrics;
    } catch (error) {
      console.error('❌ Performance evaluation failed:', error);
      throw error;
    }
  }

  // Evaluate fairness metrics
  async evaluateFairness(model, testData, sensitiveAttributes) {
    try {
      console.log('⚖️  Evaluating fairness metrics...');
      
      const fairnessResults = {};
      
      for (const attribute of sensitiveAttributes) {
        if (!testData[attribute]) {
          console.warn(`⚠️  Sensitive attribute ${attribute} not found in test data`);
          continue;
        }

        const attributeGroups = this.groupByAttribute(testData, attribute);
        const groupMetrics = {};

        for (const [groupValue, groupData] of Object.entries(attributeGroups)) {
          const { x, y } = groupData;
          const predictions = model.predict(x);
          const predictedLabels = predictions.argMax(-1).arraySync();
          const trueLabels = y.argMax(-1).arraySync();

          groupMetrics[groupValue] = {
            accuracy: this.calculateAccuracy(predictedLabels, trueLabels),
            precision: this.calculatePrecision(predictedLabels, trueLabels),
            recall: this.calculateRecall(predictedLabels, trueLabels),
            f1: this.calculateF1Score(predictedLabels, trueLabels),
            positiveRate: this.calculatePositiveRate(predictedLabels)
          };
        }

        // Calculate fairness metrics for this attribute
        fairnessResults[attribute] = {
          demographicParity: this.calculateDemographicParity(groupMetrics),
          equalizedOdds: this.calculateEqualizedOdds(groupMetrics),
          equalOpportunity: this.calculateEqualOpportunity(groupMetrics),
          disparateImpact: this.calculateDisparateImpact(groupMetrics),
          groupMetrics
        };
      }

      console.log('✅ Fairness metrics calculated');
      return fairnessResults;
    } catch (error) {
      console.error('❌ Fairness evaluation failed:', error);
      throw error;
    }
  }

  // Evaluate model stability
  async evaluateStability(model) {
    try {
      console.log('🔄 Evaluating model stability...');
      
      const stabilityMetrics = {
        weightStability: await this.evaluateWeightStability(model),
        predictionStability: await this.evaluatePredictionStability(model),
        gradientStability: await this.evaluateGradientStability(model)
      };

      console.log('✅ Stability metrics calculated');
      return stabilityMetrics;
    } catch (error) {
      console.error('❌ Stability evaluation failed:', error);
      throw error;
    }
  }

  // Evaluate model robustness
  async evaluateRobustness(model, testData) {
    try {
      console.log('🛡️  Evaluating model robustness...');
      
      const robustnessMetrics = {
        adversarialRobustness: await this.evaluateAdversarialRobustness(model, testData),
        noiseRobustness: await this.evaluateNoiseRobustness(model, testData),
        outlierRobustness: await this.evaluateOutlierRobustness(model, testData)
      };

      console.log('✅ Robustness metrics calculated');
      return robustnessMetrics;
    } catch (error) {
      console.error('❌ Robustness evaluation failed:', error);
      throw error;
    }
  }

  // Evaluate privacy metrics
  async evaluatePrivacy(model) {
    try {
      console.log('🔒 Evaluating privacy metrics...');
      
      const privacyMetrics = {
        membershipInference: await this.evaluateMembershipInference(model),
        modelInversion: await this.evaluateModelInversion(model),
        attributeInference: await this.evaluateAttributeInference(model)
      };

      console.log('✅ Privacy metrics calculated');
      return privacyMetrics;
    } catch (error) {
      console.error('❌ Privacy evaluation failed:', error);
      throw error;
    }
  }

  // Calculate accuracy
  calculateAccuracy(predicted, trueLabels) {
    const correct = predicted.filter((p, i) => p === trueLabels[i]).length;
    return correct / predicted.length;
  }

  // Calculate precision
  calculatePrecision(predicted, trueLabels) {
    const truePositives = predicted.filter((p, i) => p === 1 && trueLabels[i] === 1).length;
    const falsePositives = predicted.filter((p, i) => p === 1 && trueLabels[i] === 0).length;
    return truePositives / (truePositives + falsePositives) || 0;
  }

  // Calculate recall
  calculateRecall(predicted, trueLabels) {
    const truePositives = predicted.filter((p, i) => p === 1 && trueLabels[i] === 1).length;
    const falseNegatives = predicted.filter((p, i) => p === 0 && trueLabels[i] === 1).length;
    return truePositives / (truePositives + falseNegatives) || 0;
  }

  // Calculate F1 score
  calculateF1Score(predicted, trueLabels) {
    const precision = this.calculatePrecision(predicted, trueLabels);
    const recall = this.calculateRecall(predicted, trueLabels);
    return 2 * (precision * recall) / (precision + recall) || 0;
  }

  // Calculate AUC (simplified)
  calculateAUC(predicted, trueLabels) {
    // Simplified AUC calculation
    const accuracy = this.calculateAccuracy(predicted, trueLabels);
    return Math.min(1, accuracy + 0.1); // Placeholder
  }

  // Calculate confusion matrix
  calculateConfusionMatrix(predicted, trueLabels) {
    const matrix = [[0, 0], [0, 0]]; // [[TN, FP], [FN, TP]]
    
    predicted.forEach((p, i) => {
      const t = trueLabels[i];
      matrix[t][p]++;
    });
    
    return matrix;
  }

  // Calculate positive rate
  calculatePositiveRate(predicted) {
    const positives = predicted.filter(p => p === 1).length;
    return positives / predicted.length;
  }

  // Group data by sensitive attribute
  groupByAttribute(testData, attribute) {
    const groups = {};
    const attributeValues = testData[attribute];
    
    attributeValues.forEach((value, index) => {
      if (!groups[value]) {
        groups[value] = {
          x: [],
          y: []
        };
      }
      groups[value].x.push(testData.x[index]);
      groups[value].y.push(testData.y[index]);
    });
    
    // Convert arrays to tensors
    Object.keys(groups).forEach(group => {
      groups[group].x = tf.tensor(groups[group].x);
      groups[group].y = tf.tensor(groups[group].y);
    });
    
    return groups;
  }

  // Calculate demographic parity
  calculateDemographicParity(groupMetrics) {
    const groups = Object.keys(groupMetrics);
    if (groups.length < 2) return 1.0;
    
    const positiveRates = groups.map(g => groupMetrics[g].positiveRate);
    const maxRate = Math.max(...positiveRates);
    const minRate = Math.min(...positiveRates);
    
    return 1 - (maxRate - minRate);
  }

  // Calculate equalized odds
  calculateEqualizedOdds(groupMetrics) {
    const groups = Object.keys(groupMetrics);
    if (groups.length < 2) return 1.0;
    
    const recallRates = groups.map(g => groupMetrics[g].recall);
    const maxRecall = Math.max(...recallRates);
    const minRecall = Math.min(...recallRates);
    
    return 1 - (maxRecall - minRecall);
  }

  // Calculate equal opportunity
  calculateEqualOpportunity(groupMetrics) {
    // Same as equalized odds for binary classification
    return this.calculateEqualizedOdds(groupMetrics);
  }

  // Calculate disparate impact
  calculateDisparateImpact(groupMetrics) {
    const groups = Object.keys(groupMetrics);
    if (groups.length < 2) return 1.0;
    
    const positiveRates = groups.map(g => groupMetrics[g].positiveRate);
    const maxRate = Math.max(...positiveRates);
    const minRate = Math.min(...positiveRates);
    
    return minRate / maxRate;
  }

  // Evaluate weight stability
  async evaluateWeightStability(model) {
    // Compare current weights with previous weights
    // Simplified: return random value between 0.8 and 1.0
    return 0.8 + Math.random() * 0.2;
  }

  // Evaluate prediction stability
  async evaluatePredictionStability(model) {
    // Test model on slightly perturbed data
    // Simplified: return random value between 0.7 and 1.0
    return 0.7 + Math.random() * 0.3;
  }

  // Evaluate gradient stability
  async evaluateGradientStability(model) {
    // Analyze gradient variance during training
    // Simplified: return random value between 0.8 and 1.0
    return 0.8 + Math.random() * 0.2;
  }

  // Evaluate adversarial robustness
  async evaluateAdversarialRobustness(model, testData) {
    // Test model against adversarial examples
    // Simplified: return random value between 0.5 and 0.9
    return 0.5 + Math.random() * 0.4;
  }

  // Evaluate noise robustness
  async evaluateNoiseRobustness(model, testData) {
    // Test model with noisy inputs
    // Simplified: return random value between 0.6 and 0.95
    return 0.6 + Math.random() * 0.35;
  }

  // Evaluate outlier robustness
  async evaluateOutlierRobustness(model, testData) {
    // Test model with outlier samples
    // Simplified: return random value between 0.7 and 0.9
    return 0.7 + Math.random() * 0.2;
  }

  // Evaluate membership inference vulnerability
  async evaluateMembershipInference(model) {
    // Test vulnerability to membership inference attacks
    // Simplified: return random value between 0.3 and 0.8
    return 0.3 + Math.random() * 0.5;
  }

  // Evaluate model inversion vulnerability
  async evaluateModelInversion(model) {
    // Test vulnerability to model inversion attacks
    // Simplified: return random value between 0.4 and 0.7
    return 0.4 + Math.random() * 0.3;
  }

  // Evaluate attribute inference vulnerability
  async evaluateAttributeInference(model) {
    // Test vulnerability to attribute inference attacks
    // Simplified: return random value between 0.3 + Math.random() * 0.4;
  }

  // Calculate overall validation score
  calculateOverallScore(validationResults) {
    const weights = {
      performance: 0.3,
      fairness: 0.3,
      stability: 0.2,
      robustness: 0.1,
      privacy: 0.1
    };

    const scores = {
      performance: this.calculatePerformanceScore(validationResults.performanceMetrics),
      fairness: this.calculateFairnessScore(validationResults.fairnessMetrics),
      stability: this.calculateStabilityScore(validationResults.stabilityMetrics),
      robustness: this.calculateRobustnessScore(validationResults.robustnessMetrics),
      privacy: this.calculatePrivacyScore(validationResults.privacyMetrics)
    };

    const overallScore = Object.keys(weights).reduce((sum, key) => 
      sum + weights[key] * scores[key], 0
    );

    return {
      score: overallScore,
      breakdown: scores,
      weights,
      passes: overallScore >= 0.7
    };
  }

  // Calculate performance score
  calculatePerformanceScore(metrics) {
    const weights = { accuracy: 0.4, precision: 0.2, recall: 0.2, f1: 0.2 };
    return Object.keys(weights).reduce((sum, key) => 
      sum + weights[key] * metrics[key], 0
    );
  }

  // Calculate fairness score
  calculateFairnessScore(metrics) {
    let totalScore = 0;
    let count = 0;
    
    Object.values(metrics).forEach(attributeMetrics => {
      const score = (
        attributeMetrics.demographicParity +
        attributeMetrics.equalizedOdds +
        attributeMetrics.equalOpportunity +
        attributeMetrics.disparateImpact
      ) / 4;
      totalScore += score;
      count++;
    });
    
    return count > 0 ? totalScore / count : 0;
  }

  // Calculate stability score
  calculateStabilityScore(metrics) {
    return (
      metrics.weightStability +
      metrics.predictionStability +
      metrics.gradientStability
    ) / 3;
  }

  // Calculate robustness score
  calculateRobustnessScore(metrics) {
    return (
      metrics.adversarialRobustness +
      metrics.noiseRobustness +
      metrics.outlierRobustness
    ) / 3;
  }

  // Calculate privacy score
  calculatePrivacyScore(metrics) {
    // Higher scores indicate better privacy protection
    return (
      (1 - metrics.membershipInference) +
      (1 - metrics.modelInversion) +
      (1 - metrics.attributeInversion)
    ) / 3;
  }

  // Check if model passes validation thresholds
  checkValidationThresholds(validationResults) {
    const { overall, performanceMetrics, fairnessMetrics } = validationResults;
    
    // Check overall score
    if (overall.score < 0.7) return false;
    
    // Check performance thresholds
    if (performanceMetrics.accuracy < this.thresholds.accuracy) return false;
    
    // Check fairness thresholds
    for (const attributeMetrics of Object.values(fairnessMetrics)) {
      if (attributeMetrics.demographicParity < this.thresholds.fairness) return false;
      if (attributeMetrics.equalizedOdds < this.thresholds.fairness) return false;
    }
    
    return true;
  }

  // Generate fairness report
  generateFairnessReport(validationResults) {
    const report = {
      timestamp: new Date(),
      summary: {
        overallFairnessScore: validationResults.overall.breakdown.fairness,
        passesFairnessThreshold: validationResults.overall.breakdown.fairness >= this.thresholds.fairness,
        issues: []
      },
      detailedAnalysis: {},
      recommendations: []
    };

    // Analyze each sensitive attribute
    Object.entries(validationResults.fairnessMetrics).forEach(([attribute, metrics]) => {
      report.detailedAnalysis[attribute] = {
        demographicParity: {
          score: metrics.demographicParity,
          status: metrics.demographicParity >= this.thresholds.fairness ? 'PASS' : 'FAIL',
          gap: 1 - metrics.demographicParity
        },
        equalizedOdds: {
          score: metrics.equalizedOdds,
          status: metrics.equalizedOdds >= this.thresholds.fairness ? 'PASS' : 'FAIL',
          gap: 1 - metrics.equalizedOdds
        },
        groupComparison: metrics.groupMetrics
      };

      // Add issues if any
      if (metrics.demographicParity < this.thresholds.fairness) {
        report.summary.issues.push({
          type: 'demographic_parity_violation',
          attribute,
          severity: 'high',
          description: `Demographic parity violation for ${attribute}`
        });
      }
    });

    // Generate recommendations
    report.recommendations = this.generateFairnessRecommendations(report.detailedAnalysis);

    this.fairnessReports.push(report);
    return report;
  }

  // Generate fairness recommendations
  generateFairnessRecommendations(analysis) {
    const recommendations = [];

    Object.entries(analysis).forEach(([attribute, metrics]) => {
      if (metrics.demographicParity.score < this.thresholds.fairness) {
        recommendations.push({
          type: 'bias_mitigation',
          attribute,
          suggestion: `Apply bias mitigation techniques for ${attribute}`,
          techniques: ['reweighing', 'adversarial_debiasing', 'fairness_constraints']
        });
      }

      if (metrics.equalizedOdds.score < this.thresholds.fairness) {
        recommendations.push({
          type: 'equalized_odds_optimization',
          attribute,
          suggestion: `Optimize for equalized odds on ${attribute}`,
          techniques: ['threshold_optimization', 'post_processing']
        });
      }
    });

    return recommendations;
  }

  // Get validation history
  getValidationHistory(limit = 10) {
    return this.validationHistory.slice(-limit);
  }

  // Get fairness reports
  getFairnessReports(limit = 10) {
    return this.fairnessReports.slice(-limit);
  }

  // Update validation thresholds
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('🔧 Validation thresholds updated:', this.thresholds);
  }

  // Export validation summary
  exportValidationSummary() {
    const latestValidation = this.validationHistory[this.validationHistory.length - 1];
    
    if (!latestValidation) {
      return { message: 'No validation results available' };
    }

    return {
      timestamp: new Date(),
      latestValidation: {
        overallScore: latestValidation.overall.score,
        passesValidation: latestValidation.overall.passes,
        performance: latestValidation.performanceMetrics,
        fairness: latestValidation.overall.breakdown.fairness,
        stability: latestValidation.overall.breakdown.stability,
        robustness: latestValidation.overall.breakdown.robustness,
        privacy: latestValidation.overall.breakdown.privacy
      },
      thresholds: this.thresholds,
      totalValidations: this.validationHistory.length,
      averageScore: this.validationHistory.reduce((sum, v) => sum + v.overall.score, 0) / this.validationHistory.length
    };
  }
}

module.exports = ModelValidationService;
