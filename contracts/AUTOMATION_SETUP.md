# Analytics Automation Setup Guide

This guide explains how to set up automated periodic updates of on-chain analytics data.

## Overview

The analytics update system consists of:
1. Database queries to aggregate platform metrics
2. Blockchain transactions to store data on-chain
3. Automated scheduling for periodic updates

## Prerequisites

- Node.js 16+ installed
- PostgreSQL database with platform data
- Stellar testnet/mainnet account with XLM for fees
- Deployed analytics storage contract

## Setup Steps

### 1. Install Dependencies

```bash
cd contracts/scripts
npm install
```

### 2. Configure Environment

Create or update `.env` file in project root:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Stellar Network
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK=testnet

# Contract & Admin
ANALYTICS_CONTRACT_ID=C...
ADMIN_PRIVATE_KEY=S...
```

### 3. Test Manual Update

Run the update script manually to verify configuration:

```bash
cd contracts/scripts
node update_analytics.js
```

Expected output:
```
=== Analytics Update Script ===
Started at: 2024-01-15T10:30:00.000Z

✓ Connected to database

Metrics gathered: {
  'Total Users': 1250,
  'Active Users': 890,
  'Total Courses': 45,
  'Completions': 3420,
  'Avg Progress': '67.50%',
  'Avg Quiz Score': '82.30%',
  'Total Time': '125000 minutes'
}

✓ Fetched 10 course outcomes

Submitting to blockchain...
Building transaction for metrics...
Sending metrics transaction...
✓ Metrics transaction sent! Hash: abc123...
✓ Metrics transaction confirmed!

✓ Analytics update completed successfully!
```

### 4. Set Up Automated Scheduling

Choose one of the following methods:

#### Option A: Linux/macOS Cron

1. Open crontab editor:
```bash
crontab -e
```

2. Add one of these schedules:

**Daily at 2 AM:**
```cron
0 2 * * * cd /path/to/project && node contracts/scripts/update_analytics.js >> /var/log/analytics-update.log 2>&1
```

**Every 6 hours:**
```cron
0 */6 * * * cd /path/to/project && node contracts/scripts/update_analytics.js >> /var/log/analytics-update.log 2>&1
```

**Weekly on Sunday at 3 AM:**
```cron
0 3 * * 0 cd /path/to/project && node contracts/scripts/update_analytics.js >> /var/log/analytics-update.log 2>&1
```

3. Verify cron job:
```bash
crontab -l
```

#### Option B: systemd Timer (Linux)

1. Create service file `/etc/systemd/system/analytics-update.service`:
```ini
[Unit]
Description=Update on-chain analytics
After=network.target postgresql.service

[Service]
Type=oneshot
User=your-user
WorkingDirectory=/path/to/project
Environment="NODE_ENV=production"
EnvironmentFile=/path/to/project/.env
ExecStart=/usr/bin/node /path/to/project/contracts/scripts/update_analytics.js
StandardOutput=journal
StandardError=journal
```

2. Create timer file `/etc/systemd/system/analytics-update.timer`:
```ini
[Unit]
Description=Run analytics update daily
Requires=analytics-update.service

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

3. Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable analytics-update.timer
sudo systemctl start analytics-update.timer
```

4. Check status:
```bash
sudo systemctl status analytics-update.timer
sudo systemctl list-timers
```

#### Option C: Node.js Scheduler (PM2)

1. Install PM2:
```bash
npm install -g pm2
```

2. Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'analytics-update',
    script: './contracts/scripts/update_analytics.js',
    cron_restart: '0 2 * * *', // Daily at 2 AM
    autorestart: false,
    watch: false,
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

3. Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Monitoring

### View Logs

**Cron logs:**
```bash
tail -f /var/log/analytics-update.log
```

**systemd logs:**
```bash
journalctl -u analytics-update.service -f
```

**PM2 logs:**
```bash
pm2 logs analytics-update
```

### Query On-Chain Data

Check if updates are working:
```bash
node contracts/scripts/query_analytics.js last-update
```

View latest metrics:
```bash
node contracts/scripts/query_analytics.js latest
```

### Set Up Alerts

Create a monitoring script `contracts/scripts/check_analytics.sh`:
```bash
#!/bin/bash

LAST_UPDATE=$(node contracts/scripts/query_analytics.js last-update | grep "hours ago" | awk '{print $1}')

if [ "$LAST_UPDATE" -gt 48 ]; then
    echo "WARNING: Analytics not updated in $LAST_UPDATE hours"
    # Send alert (email, Slack, etc.)
    curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"Analytics update overdue: $LAST_UPDATE hours\"}"
fi
```

Schedule the check:
```cron
0 */4 * * * /path/to/check_analytics.sh
```

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

### Blockchain Transaction Failures

Common issues:
- Insufficient XLM balance for fees
- Invalid admin key
- Contract not initialized
- Network connectivity

Check admin balance:
```bash
stellar account --address YOUR_ADMIN_PUBLIC_KEY --network testnet
```

### Permission Issues

Ensure the user running the script has:
- Read access to `.env` file
- Write access to log directory
- Network access to database and Stellar RPC

## Gas Cost Estimation

Typical costs per update:
- Metrics update: ~0.0001 XLM
- Outcomes update: ~0.0002 XLM
- Total per day: ~0.0003 XLM

Monthly cost (daily updates): ~0.009 XLM (~$0.001 USD)

## Best Practices

1. **Update Frequency**: Daily updates are recommended for most platforms
2. **Backup Admin Key**: Store securely in multiple locations
3. **Monitor Logs**: Set up alerts for failures
4. **Test Updates**: Run manually after any schema changes
5. **Gas Budget**: Maintain at least 1 XLM in admin account
6. **Timezone**: Use UTC for consistency
7. **Retry Logic**: Consider adding retry on transient failures

## Security Considerations

1. **Environment Variables**: Never commit `.env` to version control
2. **Admin Key**: Use a dedicated key for analytics only
3. **Database Access**: Use read-only credentials if possible
4. **Log Sanitization**: Ensure logs don't contain sensitive data
5. **Network Security**: Use SSL/TLS for database connections

## Scaling Considerations

For high-volume platforms:
- Consider batching outcomes by importance
- Implement incremental updates instead of full aggregation
- Use database materialized views for faster queries
- Cache intermediate calculations
- Monitor contract storage costs

## Support

For issues or questions:
- Check logs first
- Verify environment configuration
- Test database queries manually
- Review contract state on-chain
- Consult ANALYTICS_STORAGE.md documentation
