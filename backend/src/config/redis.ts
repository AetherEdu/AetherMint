import Redis, { RedisOptions } from 'ioredis';
import logger from '../utils/logger';

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export interface RateLimitTierConfig {
  windowMs: number;
  max: number;
  burstWindowMs: number;
  burstMax: number;
  message: string;
}

export interface RateLimitConfiguration {
  enabled: boolean;
  keyPrefix: string;
  failOpen: boolean;
  global: RateLimitTierConfig;
  public: RateLimitTierConfig;
  authenticated: RateLimitTierConfig;
  admin: RateLimitTierConfig;
  endpoints: {
    auth: RateLimitTierConfig;
    transactions: RateLimitTierConfig;
    ipfs: RateLimitTierConfig;
  };
}

const tier = (
  prefix: string,
  defaults: Omit<RateLimitTierConfig, 'message'> & { message: string }
): RateLimitTierConfig => ({
  windowMs: positiveInteger(process.env[`${prefix}_WINDOW_MS`], defaults.windowMs),
  max: positiveInteger(process.env[`${prefix}_MAX`], defaults.max),
  burstWindowMs: positiveInteger(
    process.env[`${prefix}_BURST_WINDOW_MS`],
    defaults.burstWindowMs
  ),
  burstMax: positiveInteger(process.env[`${prefix}_BURST_MAX`], defaults.burstMax),
  message: process.env[`${prefix}_MESSAGE`] || defaults.message,
});

export const rateLimitConfig: RateLimitConfiguration = {
  enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
  keyPrefix: process.env.RATE_LIMIT_KEY_PREFIX || 'aethermint:rate-limit:',
  failOpen: process.env.RATE_LIMIT_FAIL_OPEN !== 'false',
  global: tier('RATE_LIMIT_GLOBAL', {
    windowMs: 60_000,
    max: 600,
    burstWindowMs: 10_000,
    burstMax: 120,
    message: 'Global request rate limit exceeded. Please try again shortly.',
  }),
  public: tier('RATE_LIMIT_PUBLIC', {
    windowMs: 300_000,
    max: 300,
    burstWindowMs: 10_000,
    burstMax: 40,
    message: 'Public API rate limit exceeded. Please try again shortly.',
  }),
  authenticated: tier('RATE_LIMIT_AUTHENTICATED', {
    windowMs: 300_000,
    max: 600,
    burstWindowMs: 10_000,
    burstMax: 80,
    message: 'Authenticated API rate limit exceeded. Please try again shortly.',
  }),
  admin: tier('RATE_LIMIT_ADMIN', {
    windowMs: 300_000,
    max: 120,
    burstWindowMs: 10_000,
    burstMax: 20,
    message: 'Admin API rate limit exceeded. Please try again shortly.',
  }),
  endpoints: {
    auth: tier('RATE_LIMIT_AUTH', {
      windowMs: 3_600_000,
      max: 10,
      burstWindowMs: 60_000,
      burstMax: 5,
      message: 'Too many authentication attempts. Please try again later.',
    }),
    transactions: tier('RATE_LIMIT_TRANSACTIONS', {
      windowMs: 60_000,
      max: 20,
      burstWindowMs: 10_000,
      burstMax: 8,
      message: 'Transaction rate limit exceeded. Please try again shortly.',
    }),
    ipfs: tier('RATE_LIMIT_IPFS', {
      windowMs: 3_600_000,
      max: 30,
      burstWindowMs: 60_000,
      burstMax: 10,
      message: 'IPFS upload rate limit exceeded. Please try again later.',
    }),
  },
};

export interface RedisHealth {
  status: 'connected' | 'disconnected' | 'degraded' | 'error';
  latency?: number;
  reconnectAttempts?: number;
  error?: string;
  metrics?: {
    totalCommands: number;
    errorCount: number;
    circuitBreakerOpen: boolean;
  };
}

class RedisManager {
  private client: Redis | null = null;
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  
  // Circuit Breaker state
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private circuitBreakerThreshold: number = 5;
  private circuitBreakerResetTimeout: number = 30000; // 30 seconds
  private isCircuitBreakerOpen: boolean = false;

  // Metrics
  private totalCommands: number = 0;
  private errorCount: number = 0;

  private config: RedisOptions;

  constructor() {
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: (times) => {
        if (times >= this.maxReconnectAttempts) {
          logger.error('Redis max reconnection attempts reached');
          return null;
        }
        const delay = Math.min(times * 1000, 30000); // Exponential-ish backoff
        logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
        this.reconnectAttempts = times;
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
    };
  }

  public async initialize(): Promise<boolean> {
    if (this.client) return true;

    try {
      this.client = new Redis(this.config);
      this.publisher = new Redis(this.config);
      this.subscriber = new Redis(this.config);

      this.setupEventHandlers(this.client, 'Main');
      this.setupEventHandlers(this.publisher, 'Publisher');
      this.setupEventHandlers(this.subscriber, 'Subscriber');

      // Wait for at least the main client to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Redis connection timeout')), 15000);
        this.client!.on('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
        this.client!.on('error', (err) => {
          if (!this.isConnected) {
            clearTimeout(timeout);
            reject(err);
          }
        });
      });

      this.isConnected = true;
      logger.info('Redis initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      this.isConnected = false;
      // Graceful degradation: don't throw, just log
      return false;
    }
  }

  private setupEventHandlers(client: Redis, name: string): void {
    client.on('connect', () => logger.info(`Redis ${name} connecting...`));
    client.on('ready', () => {
      logger.info(`Redis ${name} ready`);
      if (name === 'Main') {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.closeCircuitBreaker();
      }
    });
    client.on('error', (error) => {
      logger.error(`Redis ${name} error:`, error);
      this.errorCount++;
      if (name === 'Main') {
        this.handleFailure();
      }
    });
    client.on('close', () => {
      logger.warn(`Redis ${name} connection closed`);
      if (name === 'Main') this.isConnected = false;
    });
  }

  private handleFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.circuitBreakerThreshold) {
      this.openCircuitBreaker();
    }
  }

  private openCircuitBreaker(): void {
    if (!this.isCircuitBreakerOpen) {
      logger.error('Redis Circuit Breaker OPENED');
      this.isCircuitBreakerOpen = true;
    }
  }

  private closeCircuitBreaker(): void {
    if (this.isCircuitBreakerOpen) {
      logger.info('Redis Circuit Breaker CLOSED');
      this.isCircuitBreakerOpen = false;
      this.failureCount = 0;
    }
  }

  private checkCircuitBreaker(): boolean {
    if (this.isCircuitBreakerOpen) {
      if (Date.now() - this.lastFailureTime > this.circuitBreakerResetTimeout) {
        logger.info('Redis Circuit Breaker HALF-OPEN (testing connection)');
        return true; // Allow one request to test
      }
      return false;
    }
    return true;
  }

  // --- Wrapper for Redis commands with circuit breaker ---
  private async execute<T>(operation: (client: Redis) => Promise<T>): Promise<T | null> {
    if (!this.checkCircuitBreaker() || !this.client) {
      logger.warn('Redis command skipped due to circuit breaker or client not initialized');
      return null;
    }

    this.totalCommands++;
    try {
      const result = await operation(this.client);
      this.closeCircuitBreaker();
      return result;
    } catch (error) {
      this.handleFailure();
      logger.error('Redis operation failed:', error);
      return null;
    }
  }

  // --- Queue Operations ---
  async enqueue(queueName: string, data: any, options: any = {}): Promise<string | null> {
    const id = options.id || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const item = {
      id,
      data,
      enqueuedAt: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries || 3
    };

    const success = await this.execute(async (client) => {
      if (options.delay > 0) {
        const score = Date.now() + options.delay;
        await client.zadd(`${queueName}:delayed`, score, JSON.stringify(item));
      } else {
        await client.lpush(`${queueName}:pending`, JSON.stringify(item));
      }
      return id;
    });

    return success;
  }

  async dequeue(queueName: string, timeout: number = 30): Promise<any | null> {
    return this.execute(async (client) => {
      // Process delayed items
      await this.processDelayedItems(queueName);
      
      // brpop returns [key, value]
      const result = await client.brpop(`${queueName}:pending`, timeout);
      if (result) {
        return JSON.parse(result[1]);
      }
      return null;
    });
  }

  private async processDelayedItems(queueName: string): Promise<void> {
    await this.execute(async (client) => {
      const now = Date.now();
      const items = await client.zrangebyscore(`${queueName}:delayed`, 0, now);
      if (items.length > 0) {
        const pipeline = client.pipeline();
        for (const item of items) {
          pipeline.lpush(`${queueName}:pending`, item);
          pipeline.zrem(`${queueName}:delayed`, item);
        }
        await pipeline.exec();
      }
    });
  }

  async requeueForRetry(queueName: string, item: any, delay: number | null = null): Promise<boolean> {
    item.retryCount += 1;
    const finalDelay = delay ?? Math.min(Math.pow(2, item.retryCount) * 1000, 30000);
    const success = await this.enqueue(queueName, item.data, { ...item, delay: finalDelay });
    return !!success;
  }

  async moveToFailed(queueName: string, item: any, error: any): Promise<boolean> {
    const failedItem = { ...item, failedAt: Date.now(), error: error.message || error };
    const success = await this.execute(async (client) => {
      await client.lpush(`${queueName}:failed`, JSON.stringify(failedItem));
      return true;
    });
    return !!success;
  }

  async getQueueStats(queueName: string): Promise<any> {
    const stats = await this.execute(async (client) => {
      const [pending, delayed, failed] = await Promise.all([
        client.llen(`${queueName}:pending`),
        client.zcard(`${queueName}:delayed`),
        client.llen(`${queueName}:failed`)
      ]);
      return { pending, delayed, failed, total: pending + delayed + failed };
    });
    return stats || { pending: 0, delayed: 0, failed: 0, total: 0 };
  }

  async clearQueue(queueName: string): Promise<boolean> {
    const success = await this.execute(async (client) => {
      await Promise.all([
        client.del(`${queueName}:pending`),
        client.del(`${queueName}:delayed`),
        client.del(`${queueName}:failed`)
      ]);
      return true;
    });
    return !!success;
  }

  // --- Pub/Sub ---
  async publish(channel: string, message: any): Promise<boolean> {
    if (!this.publisher) return false;
    try {
      await this.publisher.publish(channel, JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error(`Redis publish to ${channel} failed:`, error);
      return false;
    }
  }

  async subscribe(channel: string, callback: (message: any, channel: string) => void): Promise<boolean> {
    if (!this.subscriber) return false;
    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (chan, msg) => {
        if (chan === channel) {
          try {
            callback(JSON.parse(msg), chan);
          } catch {
            callback(msg, chan);
          }
        }
      });
      return true;
    } catch (error) {
      logger.error(`Redis subscribe to ${channel} failed:`, error);
      return false;
    }
  }

  // --- Health & Metrics ---
  async healthCheck(): Promise<RedisHealth> {
    if (!this.isConnected || !this.client) {
      return { 
        status: this.isCircuitBreakerOpen ? 'degraded' : 'disconnected',
        reconnectAttempts: this.reconnectAttempts,
        metrics: {
          totalCommands: this.totalCommands,
          errorCount: this.errorCount,
          circuitBreakerOpen: this.isCircuitBreakerOpen
        }
      };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return {
        status: 'connected',
        latency,
        reconnectAttempts: this.reconnectAttempts,
        metrics: {
          totalCommands: this.totalCommands,
          errorCount: this.errorCount,
          circuitBreakerOpen: this.isCircuitBreakerOpen
        }
      };
    } catch (error: any) {
      return {
        status: 'error',
        error: error.message,
        metrics: {
          totalCommands: this.totalCommands,
          errorCount: this.errorCount,
          circuitBreakerOpen: this.isCircuitBreakerOpen
        }
      };
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.client?.quit(),
        this.publisher?.quit(),
        this.subscriber?.quit()
      ]);
      this.isConnected = false;
      logger.info('Redis disconnected');
    } catch (error) {
      logger.error('Error disconnecting Redis:', error);
    }
  }

  // Access to raw client if needed (use with caution)
  getRawClient(): Redis | null {
    return this.client;
  }
}

export const redisConfig = new RedisManager();

// CJS interop for existing JS files using require()
if (typeof module !== 'undefined') {
  module.exports = redisConfig;
  (module.exports as any).default = redisConfig;
  (module.exports as any).redisConfig = redisConfig;
  (module.exports as any).rateLimitConfig = rateLimitConfig;
}

export default redisConfig;
