/**
 * Quantum Encryption API Routes
 * RESTful endpoints for quantum-resistant encryption services
 */

const express = require('express');
const router = express.Router();
const QuantumEncryption = require('../services/quantumEncryption');
const QuantumKeyManagement = require('../services/quantumKeyManagement');
const HybridEncryption = require('../services/hybridEncryption');
const QuantumThreatMonitoring = require('../services/quantumThreatMonitoring');
const QuantumMigrationService = require('../services/quantumMigrationService');
const QuantumSecurityAudit = require('../services/quantumSecurityAudit');

// Middleware for request validation
const validateRequest = (req, res, next) => {
    try {
        // Basic validation
        if (!req.body && req.method !== 'GET') {
            return res.status(400).json({ error: 'Request body is required' });
        }
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid request format' });
    }
};

/**
 * @route POST /api/quantum-encryption/keys/generate
 * @desc Generate quantum-resistant key pair
 * @access Private
 */
router.post('/keys/generate', validateRequest, async (req, res) => {
    try {
        const { algorithm = 'CRYSTALS_KYBER', securityLevel = 4, metadata = {} } = req.body;
        
        const keyPair = await QuantumKeyManagement.generateAndStoreKey(
            null,
            algorithm,
            metadata
        );
        
        res.json({
            success: true,
            data: keyPair,
            message: 'Quantum-resistant key pair generated successfully'
        });
        
    } catch (error) {
        console.error('Key generation error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/quantum-encryption/keys/:keyId
 * @desc Get public key by ID
 * @access Private
 */
router.get('/keys/:keyId', async (req, res) => {
    try {
        const { keyId } = req.params;
        
        const publicKey = await QuantumKeyManagement.getPublicKey(keyId);
        
        res.json({
            success: true,
            data: publicKey
        });
        
    } catch (error) {
        console.error('Get public key error:', error);
        res.status(404).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/quantum-encryption/keys
 * @desc List all active keys
 * @access Private
 */
router.get('/keys', async (req, res) => {
    try {
        const { algorithm, limit = 50 } = req.query;
        
        const filter = {};
        if (algorithm) filter.algorithm = algorithm;
        
        const keys = await QuantumKeyManagement.listActiveKeys(filter);
        const limitedKeys = keys.slice(0, parseInt(limit));
        
        res.json({
            success: true,
            data: limitedKeys,
            total: keys.length
        });
        
    } catch (error) {
        console.error('List keys error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/quantum-encryption/encrypt
 * @desc Encrypt data using quantum-resistant encryption
 * @access Private
 */
router.post('/encrypt', validateRequest, async (req, res) => {
    try {
        const { 
            data, 
            keyId, 
            algorithm = 'CRYSTALS_KYBER', 
            compatibilityMode = 'hybrid',
            sensitivity = 'medium',
            metadata = {} 
        } = req.body;
        
        if (!data) {
            return res.status(400).json({ 
                success: false, 
                error: 'Data is required for encryption' 
            });
        }
        
        let encryptedPackage;
        
        if (keyId) {
            // Use existing key
            const publicKey = await QuantumKeyManagement.getPublicKey(keyId);
            encryptedPackage = await QuantumEncryption.encrypt(
                data, 
                publicKey.publicKey, 
                algorithm,
                metadata
            );
        } else {
            // Use hybrid encryption
            encryptedPackage = await HybridEncryption.encrypt(data, {
                compatibilityMode,
                algorithm,
                sensitivity,
                metadata
            });
        }
        
        res.json({
            success: true,
            data: encryptedPackage,
            message: 'Data encrypted successfully with quantum-resistant algorithms'
        });
        
    } catch (error) {
        console.error('Encryption error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/quantum-encryption/decrypt
 * @desc Decrypt data using quantum-resistant encryption
 * @access Private
 */
router.post('/decrypt', validateRequest, async (req, res) => {
    try {
        const { encryptedPackage, keyId, autoDetect = true } = req.body;
        
        if (!encryptedPackage) {
            return res.status(400).json({ 
                success: false, 
                error: 'Encrypted package is required for decryption' 
            });
        }
        
        let decryptedData;
        
        if (keyId) {
            // Use specific key
            const privateKey = await QuantumKeyManagement.getPrivateKey(keyId, {
                operation: 'decryption'
            });
            
            decryptedData = await QuantumEncryption.decrypt(
                encryptedPackage,
                privateKey.privateKey,
                encryptedPackage.algorithm
            );
        } else {
            // Auto-detect and decrypt
            decryptedData = await HybridEncryption.decrypt(encryptedPackage, {
                autoDetect
            });
        }
        
        res.json({
            success: true,
            data: decryptedData,
            message: 'Data decrypted successfully'
        });
        
    } catch (error) {
        console.error('Decryption error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/quantum-encryption/sign
 * @desc Sign data using quantum-resistant digital signature
 * @access Private
 */
router.post('/sign', validateRequest, async (req, res) => {
    try {
        const { data, keyId, algorithm = 'CRYSTALS_DILITHIUM' } = req.body;
        
        if (!data) {
            return res.status(400).json({ 
                success: false, 
                error: 'Data is required for signing' 
            });
        }
        
        const privateKey = await QuantumKeyManagement.getPrivateKey(keyId, {
            operation: 'signing'
        });
        
        const signature = await QuantumEncryption.sign(
            data,
            privateKey.privateKey,
            algorithm
        );
        
        res.json({
            success: true,
            data: signature,
            message: 'Data signed successfully with quantum-resistant algorithms'
        });
        
    } catch (error) {
        console.error('Signing error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/quantum-encryption/verify
 * @desc Verify quantum-resistant digital signature
 * @access Private
 */
router.post('/verify', validateRequest, async (req, res) => {
    try {
        const { signedData, keyId, algorithm = 'CRYSTALS_DILITHIUM' } = req.body;
        
        if (!signedData) {
            return res.status(400).json({ 
                success: false, 
                error: 'Signed data is required for verification' 
            });
        }
        
        const publicKey = await QuantumKeyManagement.getPublicKey(keyId);
        
        const isValid = await QuantumEncryption.verify(
            signedData,
            publicKey.publicKey,
            algorithm
        );
        
        res.json({
            success: true,
            data: { valid: isValid },
            message: isValid ? 'Signature verified successfully' : 'Signature verification failed'
        });
        
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/quantum-encryption/migrate
 * @desc Migrate encrypted data to quantum-resistant format
 * @access Private
 */
router.post('/migrate', validateRequest, async (req, res) => {
    try {
        const { 
            encryptedData, 
            oldAlgorithm, 
            targetAlgorithm = 'CRYSTALS_KYBER',
            strategy = 'gradual'
        } = req.body;
        
        if (!encryptedData) {
            return res.status(400).json({ 
                success: false, 
                error: 'Encrypted data is required for migration' 
            });
        }
        
        const migrationResult = await HybridEncryption.migrateToQuantum(
            encryptedData,
            targetAlgorithm
        );
        
        res.json({
            success: true,
            data: migrationResult,
            message: 'Data migration to quantum-resistant encryption completed'
        });
        
    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/quantum-encryption/keys/:keyId/rotate
 * @desc Rotate cryptographic key
 * @access Private
 */
router.post('/keys/:keyId/rotate', async (req, res) => {
    try {
        const { keyId } = req.params;
        const { newAlgorithm } = req.body;
        
        const rotationResult = await QuantumKeyManagement.rotateKey(
            keyId,
            newAlgorithm
        );
        
        res.json({
            success: true,
            data: rotationResult,
            message: 'Key rotated successfully'
        });
        
    } catch (error) {
        console.error('Key rotation error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/quantum-encryption/keys/:keyId/revoke
 * @desc Revoke cryptographic key
 * @access Private
 */
router.post('/keys/:keyId/revoke', async (req, res) => {
    try {
        const { keyId } = req.params;
        const { reason = 'manual' } = req.body;
        
        await QuantumKeyManagement.revokeKey(keyId, reason);
        
        res.json({
            success: true,
            message: 'Key revoked successfully'
        });
        
    } catch (error) {
        console.error('Key revocation error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/quantum-encryption/health
 * @desc Get quantum encryption system health status
 * @access Private
 */
router.get('/health', async (req, res) => {
    try {
        const healthCheck = await QuantumKeyManagement.performHealthCheck();
        
        res.json({
            success: true,
            data: healthCheck
        });
        
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/quantum-encryption/agility-test
 * @desc Perform cryptographic agility test
 * @access Private
 */
router.post('/agility-test', validateRequest, async (req, res) => {
    try {
        const { data = { test: 'agility_test', timestamp: new Date().toISOString() } } = req.body;
        
        const testResults = await QuantumEncryption.performAgilityTest(data);
        
        res.json({
            success: true,
            data: testResults,
            message: 'Cryptographic agility test completed'
        });
        
    } catch (error) {
        console.error('Agility test error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/quantum-encryption/compatibility-test
 * @desc Perform encryption compatibility test
 * @access Private
 */
router.post('/compatibility-test', validateRequest, async (req, res) => {
    try {
        const { testData = { test: 'compatibility_test', timestamp: new Date().toISOString() } } = req.body;
        
        const testResults = await HybridEncryption.performCompatibilityTest(testData);
        
        res.json({
            success: true,
            data: testResults,
            message: 'Encryption compatibility test completed'
        });
        
    } catch (error) {
        console.error('Compatibility test error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/quantum-encryption/security-analysis
 * @desc Analyze encryption security level
 * @access Private
 */
router.post('/security-analysis', validateRequest, async (req, res) => {
    try {
        const { encryptedPackage } = req.body;
        
        if (!encryptedPackage) {
            return res.status(400).json({ 
                success: false, 
                error: 'Encrypted package is required for security analysis' 
            });
        }
        
        const analysis = HybridEncryption.analyzeSecurityLevel(encryptedPackage);
        
        res.json({
            success: true,
            data: analysis,
            message: 'Security analysis completed'
        });
        
    } catch (error) {
        console.error('Security analysis error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/quantum-encryption/threats/alerts
 * @desc Get active security alerts
 * @access Private
 */
router.get('/threats/alerts', async (req, res) => {
    try {
        const { level, type, acknowledged } = req.query;
        
        const filter = {};
        if (level) filter.level = parseInt(level);
        if (type) filter.type = type;
        if (acknowledged !== undefined) filter.acknowledged = acknowledged === 'true';
        
        const alerts = QuantumThreatMonitoring.getActiveAlerts(filter);
        
        res.json({
            success: true,
            data: alerts,
            total: alerts.length
        });
        
    } catch (error) {
        console.error('Get alerts error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/quantum-encryption/threats/alerts/:alertId/acknowledge
 * @desc Acknowledge security alert
 * @access Private
 */
router.post('/threats/alerts/:alertId/acknowledge', async (req, res) => {
    try {
        const { alertId } = req.params;
        const { acknowledgedBy = 'user' } = req.body;
        
        const alert = QuantumThreatMonitoring.acknowledgeAlert(alertId, acknowledgedBy);
        
        res.json({
            success: true,
            data: alert,
            message: 'Alert acknowledged successfully'
        });
        
    } catch (error) {
        console.error('Acknowledge alert error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/quantum-encryption/threats/scan
 * @desc Perform threat scan
 * @access Private
 */
router.post('/threats/scan', async (req, res) => {
    try {
        const scanResults = await QuantumThreatMonitoring.performThreatScan();
        
        res.json({
            success: true,
            data: scanResults,
            message: 'Threat scan completed'
        });
        
    } catch (error) {
        console.error('Threat scan error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/quantum-encryption/migration/plans
 * @desc List migration plans
 * @access Private
 */
router.get('/migration/plans', async (req, res) => {
    try {
        const { status, strategy, priority } = req.query;
        
        const filter = {};
        if (status) filter.status = status;
        if (strategy) filter.strategy = strategy;
        if (priority) filter.priority = priority;
        
        const migrations = QuantumMigrationService.listMigrations(filter);
        
        res.json({
            success: true,
            data: migrations,
            total: migrations.length
        });
        
    } catch (error) {
        console.error('List migration plans error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/quantum-encryption/migration/plans
 * @desc Create migration plan
 * @access Private
 */
router.post('/migration/plans', validateRequest, async (req, res) => {
    try {
        const { 
            strategy = 'gradual',
            targetAlgorithm = 'CRYSTALS_KYBER',
            priority = 'medium',
            scheduleTime = null,
            dataFilters = {},
            rollbackEnabled = true
        } = req.body;
        
        const migrationPlan = await QuantumMigrationService.createMigrationPlan({
            strategy,
            targetAlgorithm,
            priority,
            scheduleTime,
            dataFilters,
            rollbackEnabled
        });
        
        res.json({
            success: true,
            data: migrationPlan,
            message: 'Migration plan created successfully'
        });
        
    } catch (error) {
        console.error('Create migration plan error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/quantum-encryption/migration/plans/:migrationId/execute
 * @desc Execute migration
 * @access Private
 */
router.post('/migration/plans/:migrationId/execute', async (req, res) => {
    try {
        const { migrationId } = req.params;
        const options = req.body || {};
        
        const migration = await QuantumMigrationService.executeMigration(migrationId, options);
        
        res.json({
            success: true,
            data: migration,
            message: 'Migration executed successfully'
        });
        
    } catch (error) {
        console.error('Execute migration error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/quantum-encryption/migration/readiness
 * @desc Check migration readiness
 * @access Private
 */
router.get('/migration/readiness', async (req, res) => {
    try {
        const readiness = await QuantumMigrationService.validateMigrationReadiness();
        
        res.json({
            success: true,
            data: readiness
        });
        
    } catch (error) {
        console.error('Migration readiness check error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/quantum-encryption/audit
 * @desc Perform security audit
 * @access Private
 */
router.post('/audit', validateRequest, async (req, res) => {
    try {
        const { 
            framework = 'nist_post_quantum_cryptography',
            categories = ['key_management', 'encryption_standards', 'threat_monitoring'],
            includeRecommendations = true,
            generateReport = true
        } = req.body;
        
        const audit = await QuantumSecurityAudit.performSecurityAudit({
            framework,
            categories,
            includeRecommendations,
            generateReport
        });
        
        res.json({
            success: true,
            data: audit,
            message: 'Security audit completed'
        });
        
    } catch (error) {
        console.error('Security audit error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/quantum-encryption/compliance/:framework
 * @desc Get compliance report
 * @access Private
 */
router.get('/compliance/:framework', async (req, res) => {
    try {
        const { framework } = req.params;
        const { timeRange = '30d' } = req.query;
        
        const report = await QuantumSecurityAudit.generateComplianceReport(
            framework,
            timeRange
        );
        
        res.json({
            success: true,
            data: report
        });
        
    } catch (error) {
        console.error('Compliance report error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/quantum-encryption/algorithms
 * @desc Get supported quantum-resistant algorithms
 * @access Public
 */
router.get('/algorithms', (req, res) => {
    try {
        const algorithms = {
            post_quantum: [
                {
                    name: 'CRYSTALS_KYBER',
                    type: 'key_encapsulation',
                    securityLevel: 'high',
                    nistStatus: 'selected',
                    description: 'Lattice-based key encapsulation mechanism'
                },
                {
                    name: 'CRYSTALS_DILITHIUM',
                    type: 'digital_signature',
                    securityLevel: 'high',
                    nistStatus: 'selected',
                    description: 'Lattice-based digital signature algorithm'
                },
                {
                    name: 'FALCON',
                    type: 'digital_signature',
                    securityLevel: 'high',
                    nistStatus: 'selected',
                    description: 'Lattice-based digital signature with small signatures'
                },
                {
                    name: 'NTRU',
                    type: 'key_encapsulation',
                    securityLevel: 'medium',
                    nistStatus: 'finalist',
                    description: 'Nth degree truncated polynomial ring units'
                }
            ],
            hybrid: [
                {
                    name: 'HYBRID_AES256_PQC',
                    type: 'hybrid_encryption',
                    securityLevel: 'maximum',
                    description: 'Combination of AES-256 and post-quantum algorithms'
                }
            ],
            classical: [
                {
                    name: 'AES-256-GCM',
                    type: 'symmetric',
                    securityLevel: 'medium',
                    quantumVulnerable: true,
                    description: 'Advanced Encryption Standard with Galois/Counter Mode'
                },
                {
                    name: 'RSA-4096',
                    type: 'asymmetric',
                    securityLevel: 'medium',
                    quantumVulnerable: true,
                    description: 'Rivest-Shamir-Adleman 4096-bit key'
                }
            ]
        };
        
        res.json({
            success: true,
            data: algorithms
        });
        
    } catch (error) {
        console.error('Get algorithms error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
