import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { UserGuard } from './user.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: { name: string; email: string; password: string }) {
    return this.authService.register(body.name, body.email, body.password);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('advertiser/login')
  @HttpCode(HttpStatus.OK)
  async advertiserLogin(@Body() body: { email: string; password: string }) {
    return this.authService.advertiserLogin(body.email, body.password);
  }

  @Get('me')
  @UseGuards(UserGuard)
  getUserProfile(@Req() req: Request) {
    const userId = (req as any).user.sub;
    return this.authService.getUserProfile(userId);
  }

  @Get('rewards')
  @UseGuards(UserGuard)
  getRewardHistory(@Req() req: Request) {
    const userId = (req as any).user.sub;
    return this.authService.getRewardHistory(userId);
  }

  @Post('withdraw')
  @UseGuards(UserGuard)
  @HttpCode(HttpStatus.OK)
  withdraw(@Req() req: Request, @Body() body: { amount: number; bankName: string; accountNumber: string; accountHolder: string }) {
    const userId = (req as any).user.sub;
    return this.authService.withdraw(userId, body.amount, body.bankName, body.accountNumber, body.accountHolder);
  }

  // [인출 #3] 사용자 인출 신청 내역 조회
  @Get('withdrawals')
  @UseGuards(UserGuard)
  getWithdrawalHistory(@Req() req: Request) {
    const userId = (req as any).user.sub;
    return this.authService.getWithdrawalHistory(userId);
  }
}
