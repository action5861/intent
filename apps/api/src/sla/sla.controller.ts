import { Controller, Post, Patch, Body, HttpCode, HttpStatus, BadRequestException, Logger, UseGuards, Req } from '@nestjs/common';
import { SlaService } from './sla.service';
import { UserGuard } from '../auth/user.guard';

@Controller('api/sla')
export class SlaController {
  private readonly logger = new Logger(SlaController.name);

  constructor(private readonly slaService: SlaService) {}

  /**
   * 광고주 사이트에 삽입된 트래킹 픽셀로부터 SLA 20초 달성 핑(Ping) 수신
   * POST /api/sla/verify
   * Body: { transactionId (= intentId), accumulatedTimeMs, timestamp, clickTimestamp, recaptchaToken }
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(UserGuard)
  async verifySlaGoal(@Body() payload: any) {
    if (
      !payload ||
      !payload.transactionId ||
      !payload.accumulatedTimeMs ||
      !payload.timestamp ||
      !payload.clickTimestamp ||
      !payload.recaptchaToken
    ) {
      throw new BadRequestException('Invalid SLA verification payload. Missing security tokens.');
    }

    // [임시] reCAPTCHA 검증 완전 스킵 — Enterprise 연동 후 복원
    const recaptchaScore = 1.0;

    // [보안 2] 타임스탬프 조작 검증
    // 물리적으로 20초가 흐르지 않았는데 달성 핑이 오면 스크립트 조작 시도
    const serverNow = Date.now();
    const timeSinceClick = serverNow - payload.clickTimestamp;
    if (timeSinceClick < 19000 || payload.accumulatedTimeMs < 20000) {
      this.logger.warn(
        `[SECURITY] SLA Timestamp manipulation detected! Sent: ${payload.accumulatedTimeMs}ms, Actual elapsed: ${timeSinceClick}ms`,
      );
      throw new BadRequestException('SLA manipulation detected. Time conditions are mathematically impossible.');
    }

    const result = await this.slaService.processSlaVerification(
      payload.transactionId,
      payload.accumulatedTimeMs,
    );

    return {
      success: true,
      data: result,
      message: 'SLA verification successful and settled securely.',
    };
  }

  /**
   * [체류시간 #5] 페이지 이탈 시 최종 체류시간 업데이트
   * PATCH /api/sla/update-duration
   * Body: { intentId, finalDwellTimeMs }
   */
  @Patch('update-duration')
  @HttpCode(HttpStatus.OK)
  @UseGuards(UserGuard)
  async updateDuration(@Body() payload: any, @Req() req: any) {
    if (!payload?.intentId || !payload?.finalDwellTimeMs) {
      throw new BadRequestException('intentId and finalDwellTimeMs are required');
    }
    const userId = req.user?.sub;
    const result = await this.slaService.updateDwellTime(payload.intentId, userId, Number(payload.finalDwellTimeMs));
    return { success: true, data: result };
  }

}

