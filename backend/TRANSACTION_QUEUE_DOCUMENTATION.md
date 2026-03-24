# Transaction Queue Management System

A comprehensive transaction queue management system for Stellar blockchain operations, providing reliable, efficient, and optimized transaction processing for the StarkEd education platform.

## 🎯 Overview

The Transaction Queue Management System (TQMS) is designed to handle high-volume Stellar blockchain transactions with intelligent queuing, retry logic, gas fee optimization, and comprehensive monitoring. It supports credential issuance, course payments, smart contract interactions, and profile updates with priority-based processing and dependency management.

## 🏗️ Architecture

### Core Components

1. **Transaction Queue Service** (`transactionQueue.js`)
   - Priority-based transaction queuing
   - Batch processing capabilities
   - Dependency resolution
   - Retry logic with exponential backoff
   - Redis-based storage and management

2. **Stellar Service** (`stellarService.js`)
   - Stellar blockchain integration
   - Dynamic gas fee optimization
   - Network congestion monitoring
   - Multi-network support (testnet/mainnet)
   - Transaction building and submission

3. **Monitoring Service** (`monitoringService.js`)
   - Real-time performance metrics
   - Alert system for failures
   - Analytics and reporting
   - Cost optimization insights
   - Bottleneck identification

4. **API Layer** (`transactionRoutes.js`)
   - RESTful endpoints
   - Authentication and authorization
   - Request validation
   - Bulk transaction support
   - Webhook notifications

## 🚀 Features

### Queue Management
- **Priority-based Processing**: Critical, High, Medium, Low priority levels
- **Batch Transactions**: Process multiple transactions efficiently
- **Dependency Management**: Handle transaction dependencies automatically
- **Retry Logic**: Intelligent retry with exponential backoff
- **Queue Capacity**: Configurable limits and overflow handling

### Stellar Integration
- **Gas Fee Optimization**: Dynamic fee adjustment based on network conditions
- **Network Monitoring**: Real-time congestion tracking
- **Multi-network Support**: Seamless testnet/mainnet switching
- **Transaction Types**: Credential issuance, payments, contracts, profiles
- **Error Recovery**: Comprehensive error handling and recovery

### Monitoring & Analytics
- **Real-time Metrics**: Processing time, success rates, queue depth
- **Performance Analytics**: Detailed insights and trends
- **Alert System**: Proactive failure and performance alerts
- **Cost Optimization**: Gas usage tracking and savings analysis
- **Historical Data**: Comprehensive transaction history

### API Interface
- **RESTful Design**: Clean, intuitive API endpoints
- **Authentication**: JWT-based security with role-based access
- **Validation**: Comprehensive input validation and sanitization
- **Bulk Operations**: Efficient batch transaction submission
- **Webhooks**: Real-time transaction status notifications

## 📋 API Endpoints

### Transaction Management
- `POST /api/transactions/submit` - Submit new transaction
- `GET /api/transactions/:id/status` - Get transaction status
- `DELETE /api/transactions/:id` - Cancel transaction
- `POST /api/transactions/:id/retry` - Retry failed transaction

### Bulk Operations
- `POST /api/transactions/bulk` - Submit bulk transactions

### Monitoring & Analytics
- `GET /api/transactions/queue/stats` - Queue statistics
- `GET /api/transactions/analytics` - Transaction analytics
- `GET /api/transactions/network/status` - Network status

### User Operations
- `GET /api/transactions/user/:userId` - User transaction history

### Webhooks
- `POST /api/transactions/webhook/stellar` - Stellar transaction confirmations

## ⚙️ Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=1

# Stellar Configuration
STELLAR_NETWORK=testnet
STELLAR_BASE_FEE=100
STELLAR_MAX_FEE=1000

# JWT Configuration
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Queue Configuration
QUEUE_MAX_SIZE=10000
QUEUE_MAX_RETRIES=3
QUEUE_RETRY_DELAY=5000
QUEUE_BATCH_SIZE=10
QUEUE_PROCESSING_INTERVAL=1000

# Monitoring Configuration
MONITORING_FAILURE_RATE_THRESHOLD=0.1
MONITORING_QUEUE_SIZE_THRESHOLD=1000
MONITORING_PROCESSING_TIME_THRESHOLD=30000
```

### Queue Configuration Options

```javascript
const transactionQueue = new TransactionQueue({
  maxRetries: 3,              // Maximum retry attempts
  retryDelay: 5000,           // Base retry delay in ms
  batchProcessingSize: 10,    // Transactions per batch
  processingInterval: 1000,   // Processing loop interval
  maxQueueSize: 10000,        // Maximum queue capacity
  transactionTimeout: 300000, // Transaction timeout in ms
});
```

## 🔧 Installation & Setup

### Prerequisites

- Node.js 18+
- Redis 6+
- PostgreSQL (for user data)
- Stellar wallet (Freighter/Albedo)

### Installation

1. **Clone Repository**
   ```bash
   git clone https://github.com/olaleyeolajide81-sketch/starked-education.git
   cd starked-education/backend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Redis Setup**
   ```bash
   # Start Redis server
   redis-server
   
   # Or use Docker
   docker run -d -p 6379:6379 redis:alpine
   ```

5. **Database Setup**
   ```bash
   # Run migrations
   npm run migrate
   
   # Seed database (optional)
   npm run seed
   ```

6. **Start Services**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

### Docker Setup

```bash
# Build Docker image
docker build -t starked-transaction-queue .

# Run with Docker Compose
docker-compose up -d
```

## 📊 Usage Examples

### Submitting a Transaction

```javascript
const response = await fetch('/api/transactions/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    type: 'credential_issuance',
    payload: {
      sourceAccount: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
      secretKey: 'SABCDEFGHIJKLMNOPQRSTUVWXYZ123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
      recipients: [{
        address: 'GBCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
        amount: '10',
      }],
      credentialData: {
        courseId: 'blockchain-101',
        studentName: 'John Doe',
        completionDate: '2024-01-15',
      },
      gasOptimization: {
        strategy: 'standard',
        estimatedFee: 200,
        savings: 0,
        confidence: 0.95,
      },
    },
    priority: 'high',
    userId: 'user-123',
  }),
});

const result = await response.json();
console.log('Transaction submitted:', result.data.transactionId);
```

### Bulk Transaction Submission

```javascript
const bulkResponse = await fetch('/api/transactions/bulk', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    transactions: [
      {
        type: 'credential_issuance',
        payload: { /* transaction data */ },
        priority: 'medium',
      },
      {
        type: 'course_payment',
        payload: { /* transaction data */ },
        priority: 'high',
      },
      // ... more transactions
    ],
    options: {
      batchSize: 20,
      continueOnError: true,
    },
  }),
});

const bulkResult = await bulkResponse.json();
console.log(`Submitted ${bulkResult.data.submitted} transactions`);
```

### Monitoring Transaction Status

```javascript
// Poll transaction status
const checkStatus = async (transactionId) => {
  const response = await fetch(`/api/transactions/${transactionId}/status`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  const status = await response.json();
  return status.data;
};

// Webhook for real-time updates
app.post('/webhook/transaction-status', (req, res) => {
  const { transactionId, status, result } = req.body;
  
  console.log(`Transaction ${transactionId} is ${status}`);
  if (status === 'completed') {
    // Handle successful transaction
    handleSuccessfulTransaction(transactionId, result);
  } else if (status === 'failed') {
    // Handle failed transaction
    handleFailedTransaction(transactionId, result);
  }
  
  res.json({ success: true });
});
```

### Analytics & Monitoring

```javascript
// Get transaction analytics
const analytics = await fetch('/api/transactions/analytics?timeRange=7d', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const analyticsData = await analytics.json();

console.log('Success Rate:', analyticsData.data.summary.successRate);
console.log('Avg Processing Time:', analyticsData.data.performance.avgProcessingTime);
console.log('Gas Savings:', analyticsData.data.gasOptimization.totalGasSaved);

// Get queue statistics
const queueStats = await fetch('/api/transactions/queue/stats', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const stats = await queueStats.json();
console.log('Queue Depth:', stats.data.queued);
console.log('Processing:', stats.data.processing);
console.log('Completed Today:', stats.data.completed);
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- transactionQueue.test.js
npm test -- load.test.js
npm test -- reliability.test.js

# Run tests with coverage
npm run test:coverage

# Run load tests
npm run test:load
```

### Test Coverage

The test suite includes:
- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end workflow testing
- **Load Tests**: High-volume performance testing
- **Reliability Tests**: Failure scenario testing

### Performance Benchmarks

Expected performance metrics:
- **Throughput**: 100+ transactions/second
- **Latency**: <5 seconds average processing time
- **Success Rate**: >95% under normal conditions
- **Gas Savings**: 15-30% average optimization

## 🔍 Monitoring & Debugging

### Health Checks

```bash
# Check service health
curl http://localhost:3001/api/health

# Check queue status
curl http://localhost:3001/api/transactions/queue/stats

# Check network status
curl http://localhost:3001/api/transactions/network/status
```

### Logging

The system uses structured logging with Winston:
- **Error Logs**: `logs/error.log`
- **Combined Logs**: `logs/combined.log`
- **Console Output**: Development mode

### Metrics

Key metrics to monitor:
- Queue depth and processing rate
- Transaction success/failure rates
- Average processing time
- Gas fee optimization savings
- Network congestion levels

### Alerts

The system automatically generates alerts for:
- High failure rates (>10%)
- Queue capacity issues (>80% full)
- Slow processing (>30s average)
- Network congestion (>80% utilization)

## 🚨 Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   ```bash
   # Check Redis status
   redis-cli ping
   
   # Verify configuration
   echo $REDIS_HOST $REDIS_PORT
   ```

2. **Stellar Network Issues**
   ```bash
   # Check network status
   curl https://horizon-testnet.stellar.org/
   
   # Verify account exists
   curl https://horizon-testnet.stellar.org/accounts/YOUR_ACCOUNT_ID
   ```

3. **High Failure Rates**
   - Check network congestion
   - Verify gas fee settings
   - Review transaction dependencies

4. **Slow Processing**
   - Check queue capacity
   - Monitor Redis performance
   - Review batch processing settings

### Debug Mode

Enable debug logging:
```bash
DEBUG=transaction-queue:* npm run dev
```

## 🔐 Security

### Authentication
- JWT-based authentication
- Role-based access control
- User tier-based rate limiting

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Secure secret key storage

### Rate Limiting
- User tier-based limits
- API endpoint throttling
- DDoS protection

## 📈 Performance Optimization

### Queue Optimization
- Configure appropriate batch sizes
- Tune processing intervals
- Monitor Redis memory usage
- Optimize priority scoring

### Gas Optimization
- Monitor network conditions
- Adjust fee strategies
- Batch similar transactions
- Use memo optimization

### Database Optimization
- Index transaction fields
- Archive old transactions
- Optimize query patterns
- Use connection pooling

## 🔄 Maintenance

### Regular Tasks
- Monitor queue depth and performance
- Review and rotate logs
- Update network configurations
- Backup Redis data

### Scaling
- Horizontal scaling with multiple queue workers
- Redis clustering for high availability
- Database sharding for large datasets
- Load balancing for API endpoints

## 📚 API Reference

### Transaction Types

#### Credential Issuance
```json
{
  "type": "credential_issuance",
  "payload": {
    "sourceAccount": "G...",
    "secretKey": "S...",
    "recipients": [
      {
        "address": "G...",
        "amount": "10"
      }
    ],
    "credentialData": {
      "courseId": "blockchain-101",
      "studentName": "John Doe"
    },
    "gasOptimization": {
      "strategy": "standard",
      "estimatedFee": 200,
      "savings": 0,
      "confidence": 0.95
    }
  }
}
```

#### Course Payment
```json
{
  "type": "course_payment",
  "payload": {
    "sourceAccount": "G...",
    "secretKey": "S...",
    "merchantAccount": "G...",
    "amount": "100",
    "asset": {
      "code": "USD",
      "issuer": "G..."
    },
    "courseData": {
      "courseId": "blockchain-101",
      "userId": "user-123"
    },
    "gasOptimization": {
      "strategy": "priority",
      "estimatedFee": 300,
      "savings": 0,
      "confidence": 0.99
    }
  }
}
```

#### Smart Contract Interaction
```json
{
  "type": "smart_contract_interaction",
  "payload": {
    "sourceAccount": "G...",
    "secretKey": "S...",
    "contractId": "CONTRACT_ID",
    "contractType": "soroban",
    "method": "enroll_student",
    "args": ["user-123", "blockchain-101"],
    "gasOptimization": {
      "strategy": "standard",
      "estimatedFee": 500,
      "savings": 0,
      "confidence": 0.95
    }
  }
}
```

#### Profile Update
```json
{
  "type": "profile_update",
  "payload": {
    "sourceAccount": "G...",
    "secretKey": "S...",
    "userId": "user-123",
    "updatedFields": {
      "displayName": "John Doe",
      "email": "john@example.com",
      "bio": "Blockchain enthusiast"
    },
    "gasOptimization": {
      "strategy": "economy",
      "estimatedFee": 150,
      "savings": 30,
      "confidence": 0.85
    }
  }
}
```

### Response Formats

#### Success Response
```json
{
  "success": true,
  "data": {
    "transactionId": "uuid-string",
    "status": "queued",
    "queuePosition": 1,
    "estimatedProcessingTime": 5000
  }
}
```

#### Error Response
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "payload.sourceAccount",
      "message": "must be a valid Stellar public key",
      "value": "invalid-key"
    }
  ]
}
```

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Make changes and add tests
4. Run tests: `npm test`
5. Submit pull request

### Code Standards
- Use ESLint for code formatting
- Write comprehensive tests
- Update documentation
- Follow semantic versioning

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting guide
- Review the API documentation
- Join the community Discord

---

**Note**: This system is designed for production use with proper security, monitoring, and scaling considerations. Always test thoroughly in a staging environment before deploying to production.
