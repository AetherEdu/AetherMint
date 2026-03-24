# Transaction Queue Management System - Setup Guide

## 🚀 Quick Start

This guide will help you set up and run the Transaction Queue Management System for the StarkEd education platform.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **Redis** (v6 or higher)
- **PostgreSQL** (v13 or higher)
- **Git**
- **Docker** (optional, for containerized setup)

## 🔧 Installation Steps

### 1. Clone the Repository

```bash
# Clone from the forked repository
git clone https://github.com/olaleyeolajide81-sketch/starked-education.git
cd starked-education

# Switch to the feature branch
git checkout Create-Transaction-Queue-Management-System
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Install additional dependencies for transaction queue
npm install redis @stellar/stellar-sdk joi winston uuid
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit the .env file with your configuration
nano .env
```

#### Required Environment Variables

```bash
# Server Configuration
NODE_ENV=development
PORT=3001

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/starked_education
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=1

# Stellar Configuration
STELLAR_NETWORK=testnet
STELLAR_BASE_FEE=100
STELLAR_MAX_FEE=1000
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# Transaction Queue Configuration
QUEUE_MAX_SIZE=10000
QUEUE_MAX_RETRIES=3
QUEUE_RETRY_DELAY=5000
QUEUE_BATCH_SIZE=10
QUEUE_PROCESSING_INTERVAL=1000
QUEUE_TRANSACTION_TIMEOUT=300000

# Monitoring Configuration
MONITORING_FAILURE_RATE_THRESHOLD=0.1
MONITORING_QUEUE_SIZE_THRESHOLD=1000
MONITORING_PROCESSING_TIME_THRESHOLD=30000
MONITORING_GAS_FEE_SPIKE_THRESHOLD=2.0
MONITORING_NETWORK_CONGESTION_THRESHOLD=0.8

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs
```

### 4. Redis Setup

#### Option 1: Local Redis Installation

```bash
# On Ubuntu/Debian
sudo apt update
sudo apt install redis-server

# On macOS with Homebrew
brew install redis

# On Windows (using WSL)
sudo apt install redis-server

# Start Redis
sudo systemctl start redis-server
# or
redis-server

# Test Redis connection
redis-cli ping
# Should return: PONG
```

#### Option 2: Docker Redis

```bash
# Pull and run Redis container
docker run -d \
  --name starked-redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:alpine redis-server --appendonly yes

# Test connection
docker exec -it starked-redis redis-cli ping
```

### 5. Database Setup

```bash
# Install PostgreSQL if not already installed
# On Ubuntu/Debian:
sudo apt install postgresql postgresql-contrib

# On macOS with Homebrew:
brew install postgresql

# Create database and user
sudo -u postgres psql
CREATE DATABASE starked_education;
CREATE USER starked_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE starked_education TO starked_user;
\q

# Run migrations (if available)
npm run migrate

# Seed database with test data (optional)
npm run seed
```

### 6. Create Log Directory

```bash
# Create logs directory
mkdir -p logs

# Set appropriate permissions
chmod 755 logs
```

## 🚦 Starting the System

### Development Mode

```bash
# Start the backend server
npm run dev

# The server will start on http://localhost:3001
# Transaction Queue API will be available at http://localhost:3001/api/transactions
```

### Production Mode

```bash
# Build the application
npm run build

# Start production server
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start ecosystem.config.js
```

## 🐳 Docker Setup (Optional)

### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/starked_education
    depends_on:
      - redis
      - postgres
    volumes:
      - ./logs:/app/logs

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  postgres:
    image: postgres:13
    environment:
      - POSTGRES_DB=starked_education
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  redis-data:
  postgres-data:
```

Start the services:

```bash
docker-compose up -d
```

## ✅ Verification & Testing

### 1. Health Check

```bash
# Check if the server is running
curl http://localhost:3001/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45
}
```

### 2. Queue Status Check

```bash
# Check transaction queue status
curl http://localhost:3001/api/transactions/queue/stats

# Expected response:
{
  "success": true,
  "data": {
    "queued": 0,
    "processing": 0,
    "completed": 0,
    "failed": 0,
    "total": 0
  }
}
```

### 3. Network Status Check

```bash
# Check Stellar network status
curl http://localhost:3001/api/transactions/network/status

# Expected response:
{
  "success": true,
  "data": {
    "network": {
      "congestionLevel": 0.3,
      "feeStats": { ... }
    },
    "gasOptimization": { ... }
  }
}
```

### 4. Run Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- tests/transactionQueue.test.js
npm test -- tests/load.test.js
npm test -- tests/reliability.test.js

# Run tests with coverage
npm run test:coverage
```

## 🎯 First Transaction Test

### 1. Get Authentication Token

You'll need a valid JWT token to test the API. For testing purposes, you can create a temporary token:

```javascript
// Create a test token (run this in Node.js)
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { 
    userId: 'test-user-123', 
    email: 'test@example.com', 
    role: 'user',
    tier: 'basic' 
  },
  'your-super-secret-jwt-key',
  { expiresIn: '24h' }
);
console.log('Token:', token);
```

### 2. Submit a Test Transaction

```bash
# Submit a credential issuance transaction
curl -X POST http://localhost:3001/api/transactions/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "type": "credential_issuance",
    "payload": {
      "sourceAccount": "GABCDEFGHIJKLMNOPQRSTUVWXYZ123456789",
      "secretKey": "SABCDEFGHIJKLMNOPQRSTUVWXYZ123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789",
      "recipients": [
        {
          "address": "GBCDEFGHIJKLMNOPQRSTUVWXYZ123456789",
          "amount": "10"
        }
      ],
      "credentialData": {
        "courseId": "blockchain-101",
        "studentName": "Test Student"
      },
      "gasOptimization": {
        "strategy": "standard",
        "estimatedFee": 200,
        "savings": 0,
        "confidence": 0.95
      }
    },
    "priority": "medium",
    "userId": "test-user-123"
  }'
```

### 3. Check Transaction Status

```bash
# Replace TRANSACTION_ID with the ID returned from the submission
curl http://localhost:3001/api/transactions/TRANSACTION_ID/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔧 Configuration Tuning

### Queue Performance Tuning

For high-volume applications, adjust these settings:

```bash
# Increase batch size for better throughput
QUEUE_BATCH_SIZE=20

# Reduce processing interval for faster processing
QUEUE_PROCESSING_INTERVAL=500

# Increase queue capacity for high load
QUEUE_MAX_SIZE=50000

# Adjust retry delay for faster recovery
QUEUE_RETRY_DELAY=2000
```

### Redis Optimization

```bash
# Add to redis.conf for better performance
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### Monitoring Configuration

```bash
# Set alert thresholds for your environment
MONITORING_FAILURE_RATE_THRESHOLD=0.05
MONITORING_QUEUE_SIZE_THRESHOLD=5000
MONITORING_PROCESSING_TIME_THRESHOLD=15000
```

## 🚨 Common Issues & Solutions

### Issue: Redis Connection Failed

**Symptoms:**
- Error: "Redis connection failed"
- Queue operations not working

**Solutions:**
```bash
# Check Redis status
redis-cli ping

# Check if Redis is running
sudo systemctl status redis-server

# Restart Redis
sudo systemctl restart redis-server

# Check network connectivity
telnet localhost 6379
```

### Issue: Stellar Network Errors

**Symptoms:**
- Transaction submission failures
- Network timeout errors

**Solutions:**
```bash
# Check Stellar network status
curl https://horizon-testnet.stellar.org/

# Verify account exists
curl https://horizon-testnet.stellar.org/accounts/YOUR_ACCOUNT_ID

# Switch to mainnet if needed
STELLAR_NETWORK=mainnet
STELLAR_HORIZON_URL=https://horizon.stellar.org
```

### Issue: High Memory Usage

**Symptoms:**
- Redis using too much memory
- Slow queue processing

**Solutions:**
```bash
# Monitor Redis memory
redis-cli info memory

# Set memory limits
redis-cli config set maxmemory 1gb
redis-cli config set maxmemory-policy allkeys-lru

# Clean up old data
redis-cli flushdb  # Use with caution!
```

### Issue: Database Connection Errors

**Symptoms:**
- Database connection timeouts
- User authentication failures

**Solutions:**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test database connection
psql -h localhost -U starked_user -d starked_education

# Check connection pool settings
# Increase pool size in your database configuration
```

## 📊 Monitoring Setup

### Basic Monitoring

```bash
# Install monitoring tools
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'starked-transaction-queue',
    script: './src/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monit
```

### Advanced Monitoring

For production monitoring, consider:

1. **Prometheus + Grafana** for metrics collection
2. **ELK Stack** for log aggregation
3. **Sentry** for error tracking
4. **New Relic** or **DataDog** for APM

## 🔒 Security Setup

### SSL/TLS Configuration

```bash
# Generate SSL certificates (for development)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/private.key \
  -out ssl/certificate.crt

# Configure HTTPS in your app
# Add to your environment:
HTTPS_ENABLED=true
SSL_KEY_PATH=./ssl/private.key
SSL_CERT_PATH=./ssl/certificate.crt
```

### Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw allow ssh
sudo ufw allow 3001/tcp
sudo ufw allow 6379/tcp  # Redis (if accessible externally)
sudo ufw enable
```

## 🚀 Production Deployment

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y nginx certbot python3-certbot-nginx

# Create application user
sudo useradd -m -s /bin/bash starked
sudo usermod -aG sudo starked
```

### 2. Application Deployment

```bash
# Clone repository
sudo -u starked git clone https://github.com/olaleyeolajide81-sketch/starked-education.git /home/starked/app
cd /home/starked/app

# Install dependencies
sudo -u starked npm install --production

# Setup PM2
sudo -u starked npm install -g pm2
sudo -u starked pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 deploy production
```

### 3. Nginx Configuration

```nginx
# /etc/nginx/sites-available/starked-education
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/starked-education /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL
sudo certbot --nginx -d your-domain.com
```

## 📈 Scaling Considerations

### Horizontal Scaling

```bash
# Multiple queue workers
pm2 start src/index.js --name "worker-1" --env production
pm2 start src/index.js --name "worker-2" --env production
pm2 start src/index.js --name "worker-3" --env production

# Redis clustering
redis-cli --cluster create 127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 --cluster-replicas 1
```

### Load Balancing

```nginx
upstream starked_backend {
    server localhost:3001;
    server localhost:3002;
    server localhost:3003;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://starked_backend;
        # ... other proxy settings
    }
}
```

## 🎉 Next Steps

Once your system is up and running:

1. **Monitor Performance**: Keep an eye on queue depth and processing times
2. **Set Up Alerts**: Configure monitoring alerts for failures and performance issues
3. **Test Load**: Run load tests to ensure system can handle expected volume
4. **Configure Backups**: Set up Redis and database backups
5. **Document Processes**: Create operational procedures for your team

## 📞 Support

If you encounter issues:

1. Check the logs: `tail -f logs/combined.log`
2. Review this troubleshooting guide
3. Check GitHub issues for known problems
4. Create a new issue with detailed error information

---

**Congratulations!** Your Transaction Queue Management System is now ready to handle Stellar blockchain operations for the StarkEd education platform. 🚀
