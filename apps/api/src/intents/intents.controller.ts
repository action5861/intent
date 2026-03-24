import { Controller, Post, Get, Delete, Body, HttpCode, HttpStatus, Param, Query, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { IntentsService } from './intents.service';
import { UserGuard } from './user.guard';
import { AdvertiserGuard } from './advertiser.guard';

/**
 * 사용자로부터 의도를 상장받고, 광고주의 매칭 수락을 처리하는 컨트롤러
 */
@Controller('api/intents')
export class IntentsController {
  constructor(private readonly intentsService: IntentsService) {}

  /**
   * 1. 사용자 의도 상장 (POST /api/intents)
   * JWT 인증 필수 — userId는 토큰에서 추출, body의 userId는 무시
   */
  @Post()
  @UseGuards(UserGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async publishIntent(@Req() req: Request, @Body() body: any) {
    const userId = (req as any).user.sub;
    return this.intentsService.handleIncomingIntent({
      userId,
      rawText: body.rawText,
      enrichedText: body.enrichedText,
    });
  }

  /**
   * 사용자 의도 목록 조회 (GET /api/intents) — JWT에서 userId 추출
   */
  @Get()
  @UseGuards(UserGuard)
  getUserIntents(@Req() req: Request) {
    const userId = (req as any).user.sub;
    return this.intentsService.getUserIntents(userId);
  }

  /**
   * 1-b. 대화형 Intent 수집 (POST /api/intents/chat)
   * JWT 인증 필수 — userId는 토큰에서 추출
   */
  @Post('chat')
  @UseGuards(UserGuard)
  @HttpCode(HttpStatus.OK)
  async chatIntent(@Req() req: Request, @Body() body: { messages: { role: string; content: string }[] }) {
    const userId = (req as any).user.sub;
    return this.intentsService.chatIntent({ userId, messages: body.messages });
  }

  /**
   * 광고주에게 매칭된 Intent 목록 — JWT에서 advertiserId 추출
   */
  @Get('advertiser-matches')
  @UseGuards(AdvertiserGuard)
  getAdvertiserMatches(@Req() req: Request) {
    const advertiserId = (req as any).advertiser.sub;
    return this.intentsService.getAdvertiserMatches(advertiserId);
  }

  /**
   * [의도삭제 #1] 사용자 의도 소프트 딜리트 (DELETE /api/intents/:intentId)
   * JWT에서 userId 추출 — DB에서는 삭제되지 않고 숨김 처리
   */
  @Delete(':intentId')
  @UseGuards(UserGuard)
  @HttpCode(HttpStatus.OK)
  async deleteIntent(@Req() req: Request, @Param('intentId') intentId: string) {
    const userId = (req as any).user.sub;
    return this.intentsService.softDeleteIntent(intentId, userId);
  }

  /**
   * 광고주 의도 수락 — JWT에서 advertiserId 추출
   */
  @Post(':intentId/accept')
  @UseGuards(AdvertiserGuard)
  async acceptIntentMatch(
    @Req() req: Request,
    @Param('intentId') intentId: string,
    @Body() matchDto: any,
  ) {
    const advertiserId = (req as any).advertiser.sub;
    const result = await this.intentsService.acceptMatch(intentId, { ...matchDto, advertiserId });
    return { success: true, matchData: result };
  }
}
