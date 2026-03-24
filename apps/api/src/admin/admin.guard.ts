import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('인증 토큰이 없습니다.');
    }

    const token = authHeader.slice(7);
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      if (payload.role !== 'admin') throw new UnauthorizedException();
      (req as any).admin = payload;
      return true;
    } catch {
      throw new UnauthorizedException('유효하지 않거나 만료된 토큰입니다.');
    }
  }
}
