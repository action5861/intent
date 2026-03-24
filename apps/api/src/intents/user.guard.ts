import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class UserGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('로그인이 필요합니다.');
    }

    const token = authHeader.slice(7);
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // 일반 사용자 토큰만 허용 (role 필드 없음)
      if (payload.role) {
        throw new UnauthorizedException('사용자 계정으로 로그인해주세요.');
      }

      (req as any).user = payload;
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('유효하지 않거나 만료된 토큰입니다.');
    }
  }
}
