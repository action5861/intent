import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';

import { AdminService, UserStatus, AdvertiserStatus } from './admin.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard } from './admin.guard';
import { IntentsService } from '../intents/intents.service';

@Controller('api/admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminAuthService: AdminAuthService,
    private readonly intentsService: IntentsService,
  ) {}

  // ── 로그인 (공개) ──────────────────────────────────────
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: { username: string; password: string }) {
    return this.adminAuthService.login(body.username, body.password);
  }

  // ── 이하 모든 라우트는 JWT 필수 ─────────────────────────
  @UseGuards(AdminGuard)
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @UseGuards(AdminGuard)
  @Get('users')
  getUsers() {
    return this.adminService.getUsers();
  }

  @UseGuards(AdminGuard)
  @Patch('users/:id/status')
  @HttpCode(HttpStatus.OK)
  updateUserStatus(@Param('id') id: string, @Body() body: { status: UserStatus }) {
    return this.adminService.updateUserStatus(id, body.status);
  }

  @UseGuards(AdminGuard)
  @Get('users/:id/intents')
  getUserIntents(@Param('id') id: string) {
    return this.adminService.getUserIntents(id);
  }

  @UseGuards(AdminGuard)
  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @UseGuards(AdminGuard)
  @Post('advertisers/analyze-site')
  @HttpCode(HttpStatus.OK)
  analyzeAdvertiserSite(@Body() body: { url: string }) {
    return this.adminService.analyzeAdvertiserSite(body.url);
  }

  @UseGuards(AdminGuard)
  @Get('advertisers')
  getAdvertisers() {
    return this.adminService.getAdvertisers();
  }

  @UseGuards(AdminGuard)
  @Post('advertisers')
  @HttpCode(HttpStatus.CREATED)
  createAdvertiser(
    @Body() body: {
      company: string;
      contactName: string;
      email: string;
      password: string;
      category: string;
      keywords?: string[];
      siteDescription?: string;
      siteUrl?: string;
      rewardPerVisit?: number;
      totalBudget?: number;
    },
  ) {
    return this.adminService.createAdvertiser(body);
  }

  // [어드민개선 #2] 광고주 정보 수정 — 확장된 필드 지원
  @UseGuards(AdminGuard)
  @Patch('advertisers/:id')
  @HttpCode(HttpStatus.OK)
  updateAdvertiser(
    @Param('id') id: string,
    @Body() body: {
      status?: AdvertiserStatus;
      company?: string;
      category?: string;
      keywords?: string[];
      siteUrl?: string;
      siteDescription?: string;
      totalBudget?: number;
      remainingBudget?: number;
      rewardPerVisit?: number;
    },
  ) {
    return this.adminService.updateAdvertiser(id, body);
  }

  @UseGuards(AdminGuard)
  @Patch('advertisers/:id/password')
  @HttpCode(HttpStatus.OK)
  resetAdvertiserPassword(
    @Param('id') id: string,
    @Body() body: { password: string },
  ) {
    return this.adminService.resetAdvertiserPassword(id, body.password);
  }

  // [어드민개선 #3] 비밀번호 초기화 — 서버에서 "advertiser1234!" 고정 재설정
  @UseGuards(AdminGuard)
  @Post('advertisers/:id/reset-password')
  @HttpCode(HttpStatus.OK)
  resetAdvertiserPasswordToDefault(@Param('id') id: string) {
    return this.adminService.resetAdvertiserPasswordToDefault(id);
  }

  @UseGuards(AdminGuard)
  @Get('advertisers/:id/matches')
  getAdvertiserMatches(@Param('id') id: string) {
    return this.adminService.getAdvertiserMatches(id);
  }

  @UseGuards(AdminGuard)
  @Delete('advertisers/:id')
  @HttpCode(HttpStatus.OK)
  deleteAdvertiser(@Param('id') id: string) {
    return this.adminService.deleteAdvertiser(id);
  }

  @UseGuards(AdminGuard)
  @Post('intents/rematch-waiting')
  @HttpCode(HttpStatus.OK)
  rematchWaitingIntents() {
    return this.intentsService.retriggerMatchingForWaitingIntents();
  }

  // ── 인출 관리 ─────────────────────────────────────────

  // [인출 #5] 전체 인출 요청 목록
  @UseGuards(AdminGuard)
  @Get('withdrawals')
  getWithdrawals() {
    return this.adminService.getWithdrawals();
  }

  // [인출 #5] 인출 승인
  @UseGuards(AdminGuard)
  @Post('withdrawals/:id/approve')
  @HttpCode(HttpStatus.OK)
  approveWithdrawal(@Param('id') id: string) {
    return this.adminService.approveWithdrawal(id);
  }

  // [인출 #5] 인출 거부
  @UseGuards(AdminGuard)
  @Post('withdrawals/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectWithdrawal(@Param('id') id: string, @Body() body: { memo: string }) {
    return this.adminService.rejectWithdrawal(id, body.memo);
  }

}
