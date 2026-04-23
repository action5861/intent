import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis/redis.service';

const DAILY_LIMIT = 5;
const TTL_SECONDS = 24 * 60 * 60; // 24시간

/**
 * 사용자별 의도 상장 횟수 제한
 * Authorization 헤더의 JWT에서 userId(sub) 추출 → 24시간 내 최대 5회 허용
 * 일일 보상 상한(1000P)은 SLA 정산 시점에 별도 적용
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return next(); // 토큰 없으면 UserGuard가 처리
    }

    let userId: string;
    try {
      const token = authHeader.slice(7);
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      userId = payload.sub;
    } catch {
      return next(); // 토큰 오류도 UserGuard가 처리
    }

    const rateLimitKey = `ratelimit:daily:${userId}`;
    try {
      const currentCount = await this.redisService.incrementRateLimit(rateLimitKey, TTL_SECONDS);
      if (currentCount > DAILY_LIMIT) {
        return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          success: false,
          message: `하루 최대 5회까지 의도를 상장할 수 있습니다. 내일 다시 시도해주세요.`,
          remainingToday: 0,
        });
      }
    } catch {
      // Redis 오류 시 fail-closed: 요청 차단
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        success: false,
        message: '일시적인 서버 오류입니다. 잠시 후 다시 시도해주세요.',
      });
    }

    next();
  }
}
