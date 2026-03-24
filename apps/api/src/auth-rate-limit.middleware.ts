import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { RedisService } from './redis/redis.service';

const LOGIN_LIMIT = parseInt(process.env.RATE_LIMIT_LOGIN_MAX ?? '10', 10) || 10;
const LOGIN_TTL = 60 * 15;    // 15분
const REGISTER_LIMIT = parseInt(process.env.RATE_LIMIT_REGISTER_MAX ?? '5', 10) || 5;
const REGISTER_TTL = 60 * 60; // 1시간

/**
 * 로그인/회원가입 브루트포스 방어
 * IP 기준 — 로그인 15분에 10회, 회원가입 1시간에 5회
 */
@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  constructor(private readonly redisService: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || 'unknown';
    const path = req.path; // e.g. /login, /register, /advertiser/login

    let key: string;
    let limit: number;
    let ttl: number;

    if (path.endsWith('/login')) {
      key = `ratelimit:login:${ip}`;
      limit = LOGIN_LIMIT;
      ttl = LOGIN_TTL;
    } else if (path.endsWith('/register')) {
      key = `ratelimit:register:${ip}`;
      limit = REGISTER_LIMIT;
      ttl = REGISTER_TTL;
    } else {
      return next();
    }

    try {
      const count = await this.redisService.incrementRateLimit(key, ttl);
      if (count > limit) {
        const minutes = Math.ceil(ttl / 60);
        return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          success: false,
          message: `요청이 너무 많습니다. ${minutes}분 후 다시 시도해주세요.`,
        });
      }
    } catch {
      // Redis 오류 시 fail-closed — 브루트포스 방어 우선
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        success: false,
        message: '서비스가 일시적으로 불가합니다. 잠시 후 다시 시도해주세요.',
      });
    }

    next();
  }
}
