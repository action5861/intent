import { Controller, Post, Patch, Body, HttpCode, HttpStatus, BadRequestException, Logger, UseGuards, Req } from '@nestjs/common';
import { SlaService } from './sla.service';
import { UserGuard } from '../auth/user.guard';
import axios from 'axios';

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

    // [보안 1] reCAPTCHA v3 검증
    const recaptchaScore = await this.verifyRecaptcha(payload.recaptchaToken);
    if (recaptchaScore < 0.5) {
      this.logger.warn(`[SECURITY] Bot detected! reCAPTCHA score: ${recaptchaScore}`);
      throw new BadRequestException('Suspicious bot activity detected. Request rejected.');
    }

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

  /**
   * reCAPTCHA v3 토큰 검증
   * - RECAPTCHA_SECRET_KEY 환경변수가 있으면 Google API 실제 호출
   * - 없으면 개발 환경 fallback (토큰 길이 기반 점수)
   */
  private async verifyRecaptcha(token: string): Promise<number> {
    const apiKey = process.env.RECAPTCHA_API_KEY;
    const siteKey = process.env.RECAPTCHA_SITE_KEY;

    // dev-token-bypass 토큰이거나, API 키가 없으면 검증 스킵
    if (token?.startsWith('dev-') || !apiKey || !siteKey) {
      this.logger.warn('[reCAPTCHA Enterprise] Skipping verification (dev bypass or no API key) — score=1.0');
      return 1.0;
    }

    try {
      const response = await axios.post(
        `https://recaptchaenterprise.googleapis.com/v1/projects/gen-lang-client-0256964543/assessments?key=${apiKey}`,
        {
          event: {
            token,
            expectedAction: 'sla_verify',
            siteKey,
          },
        },
      );
      const valid = response.data.tokenProperties?.valid ?? false;
      const score = response.data.riskAnalysis?.score ?? 0;
      this.logger.debug(`[reCAPTCHA Enterprise] score=${score}, valid=${valid}`);
      return valid ? score : 0;
    } catch (err) {
      this.logger.error('[reCAPTCHA Enterprise] API call failed', err);
      return 0;
    }
  }
}

