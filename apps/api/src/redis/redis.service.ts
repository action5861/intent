import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  // 기본 연산을 위한 클라이언트 (커넥션 풀 역할, Cache 용도)
  private readonly redisClient: Redis;

  // Pub/Sub을 위해서는 반드시 독립된 역할의 클라이언트가 필요합니다. (Redis 규칙상 Subscribe 중인 클라이언트는 다른 커맨드 수행 불가)
  private readonly publisherClient: Redis;
  private readonly subscriberClient: Redis;

  // [스케일 #3] 채널별 콜백 Map — 리스너 누적 방지
  private readonly channelCallbacks = new Map<string, (message: any) => void>();

  constructor() {
    // 1만명 규모 동시접속자를 고려한 커넥션 풀링 최적화 옵션
    const redisOptions: RedisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      // 커넥션 타임아웃 방지 및 자동 재연결
      retryStrategy: (times) => Math.min(times * 50, 2000), 
      maxRetriesPerRequest: 50,
      enableReadyCheck: true,
      keepAlive: 10000,
    };

    this.redisClient = new Redis(redisOptions);
    this.publisherClient = new Redis(redisOptions);
    this.subscriberClient = new Redis(redisOptions);

    this.setupErrorHandling(this.redisClient, 'Main');
    this.setupErrorHandling(this.publisherClient, 'Publisher');
    this.setupErrorHandling(this.subscriberClient, 'Subscriber');
  }

  private setupErrorHandling(client: Redis, name: string) {
    client.on('error', (err) => {
      this.logger.error(`Redis [${name}] Error:`, err);
    });
  }

  onModuleInit() {
    this.logger.log('Optimized Redis Clients Initialized (Main, Publisher, Subscriber)');

    // [스케일 #3] 메시지 리스너를 딱 1번만 등록하고 채널별로 콜백 Map에서 분기
    this.subscriberClient.on('message', (channel, message) => {
      const callback = this.channelCallbacks.get(channel);
      if (!callback) return;
      try {
        callback(JSON.parse(message));
      } catch (e) {
        this.logger.error('Failed to parse Pub/Sub message', e);
      }
    });
  }

  // ✅ 메모리 누수 및 오펀 커넥션 (Orphaned Connection) 방지를 위한 강력한 종료 로직
  async onModuleDestroy() {
    this.logger.log('Gracefully disconnecting Redis Clients to prevent memory leaks/connection hanging...');
    try {
      await Promise.all([
        this.redisClient.quit(),
        this.publisherClient.quit(),
        this.subscriberClient.quit(),
      ]);
      this.logger.log('All Redis Clients disconnected successfully.');
    } catch (err) {
      this.logger.error('Error during Redis disconnection', err);
      // 만약 quit이 지연되면 강제로 끊습니다.
      this.redisClient.disconnect();
      this.publisherClient.disconnect();
      this.subscriberClient.disconnect();
    }
  }

  // 1. 캐싱 최적화를 위한 Getter / Setter
  async setCache(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const stringValue = JSON.stringify(value);
    if (ttlSeconds) {
      await this.redisClient.set(key, stringValue, 'EX', ttlSeconds);
    } else {
      await this.redisClient.set(key, stringValue);
    }
  }

  async getCache<T>(key: string): Promise<T | null> {
    const value = await this.redisClient.get(key);
    return value ? JSON.parse(value) : null;
  }

  // Rate Limit 전용 원자적 증가 (INCR + EXPIRE)
  async incrementRateLimit(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.redisClient.incr(key);
    if (count === 1) {
      // 첫 번째 요청일 때만 TTL 세팅 (이미 존재하면 건드리지 않음)
      await this.redisClient.expire(key, ttlSeconds);
    }
    return count;
  }

  // 2. 실시간 매칭을 위한 Publish 로직
  async publishIntent(category: string, intentData: any): Promise<number> {
    const channel = `intents:category:${category}`;
    this.logger.log(`Publishing new intent to [${channel}]`);
    return this.publisherClient.publish(channel, JSON.stringify(intentData));
  }

  // 3. 광고주 클라이언트(Gateway)를 위한 Subscribe 로직
  // [스케일 #3] 리스너 누적 제거 — subscribe + Map 콜백 저장만 수행
  async subscribeToCategory(channel: string, callback: (message: any) => void): Promise<void> {
    const redisChannel = `intents:category:${channel}`;
    this.channelCallbacks.set(redisChannel, callback);
    await this.subscriberClient.subscribe(redisChannel);
  }
}
