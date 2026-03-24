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
    const isProduction = process.env.NODE_ENV === 'production';

    // dev bypass: 운영 환경에서는 절대 허용하지 않음
    if (token.startsWith('dev-')) {
      if (isProduction) {
        this.logger.warn('[reCAPTCHA] Dev bypass attempted in PRODUCTION — rejected');
        return 0;
      }
      this.logger.warn('[reCAPTCHA] Dev bypass token — skipping verification (dev only)');
      return 0.9;
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    if (!secretKey) {
      if (isProduction) {
        this.logger.error('[reCAPTCHA] RECAPTCHA_SECRET_KEY not set in production — rejecting all requests');
        return 0;
      }
      this.logger.warn('[reCAPTCHA] RECAPTCHA_SECRET_KEY not set — using dev fallback score');
      return token.length > 5 ? 0.9 : 0.1;
    }

    try {
      // secret은 URL이 아닌 POST body로 전송 (로그/프록시 노출 방지)
      const response = await axios.post(
        'https://www.google.com/recaptcha/api/siteverify',
        new URLSearchParams({ secret: secretKey, response: token }),
      );
      const { success, score } = response.data;
      this.logger.debug(`[reCAPTCHA] score=${score}, success=${success}`);
      return success ? (score ?? 0) : 0;
    } catch (err) {
      this.logger.error('[reCAPTCHA] Google API call failed', err);
      return 0;
    }
  }
}

