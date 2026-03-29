import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import type { ServerOptions } from 'socket.io';

/** PM2 cluster 모드에서 Socket.IO 이벤트를 프로세스 간 동기화하는 Redis Adapter */
class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    const clientOptions = redisUrl
      ? { url: redisUrl }
      : {
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
          },
          password: process.env.REDIS_PASSWORD || undefined,
        };

    // Redis Adapter는 pub/sub 전용 2개 클라이언트가 필요
    const pubClient = createClient(clientOptions);
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

async function bootstrap() {
  // [배포준비 #2] 프로덕션 필수 환경변수 검증 — 미설정 시 서버 기동 거부
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET) {
      throw new Error('[배포준비 #2] JWT_SECRET must be set in production');
    }
    if (!process.env.ADMIN_PASSWORD) {
      throw new Error('[배포준비 #3] ADMIN_PASSWORD must be set in production');
    }
  }

  const app = await NestFactory.create(AppModule);

  // PM2 cluster 모드에서 WebSocket을 프로세스 간 공유하기 위한 Redis Adapter 연결
  if (process.env.NODE_ENV === 'production') {
    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
  }

  // 보안 헤더: HSTS, X-Frame-Options, X-Content-Type-Options, CSP 등
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
  }));

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // [스케일 #2] HTTP 서버 타임아웃 설정 — 로드밸런서(60s) 보다 길게 유지
  const server = app.getHttpServer();
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  await app.listen(process.env.API_PORT ?? 4000);
}
bootstrap();
