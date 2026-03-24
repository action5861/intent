import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class AdvertiserGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('광고주 로그인이 필요합니다.');
    }

    const token = authHeader.slice(7);
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      if (payload.role !== 'advertiser') {
        throw new UnauthorizedException('광고주 계정으로 로그인해주세요.');
      }

      (req as any).advertiser = payload;
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('유효하지 않거나 만료된 토큰입니다.');
    }
  }
}
