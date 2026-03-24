import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string): Promise<{ accessToken: string; username: string }> {
    const admin = await this.prisma.admin.findUnique({ where: { username } });
    if (!admin) throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');

    const payload = { sub: admin.id, username: admin.username, role: 'admin' };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken, username: admin.username };
  }
}
