import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    private readonly dbService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * SLA(20초 체류) 달성 핑 처리
   * - Prisma $transaction으로 광고주 예산 차감 + 사용자 리워드 지급 + Intent 상태 SLA_VERIFIED
   * - 완료 후 Redis Pub/Sub으로 광고주에게 실시간 알림
   * @param intentId — acceptMatch 응답의 transactionId (= intentId)
   */
  // [체류시간 #3] accumulatedTimeMs를 DB에 저장
  async processSlaVerification(intentId: string, accumulatedTimeMs: number) {
    this.logger.log(`Processing SLA verification for Intent [${intentId}] (Time: ${accumulatedTimeMs}ms)`);

    const settlementResult = await this.dbService.executeSettlementTransaction(intentId, accumulatedTimeMs);

    this.logger.log(`Intent [${intentId}] settled — reward: ${settlementResult.rewardAmount}P`);

    // [체류시간 #3] DB 정산 완료 후 Redis Pub/Sub으로 광고주에게 실시간 브로드캐스트 (dwellTimeMs 포함)
    await this.redisService.publishIntent(`sla:${settlementResult.advertiserId}`, {
      event: 'SLA_COMPLETED',
      message: 'SLA 20초 체류 달성 및 구매 확정 완료!',
      intentId,
      dwellTimeMs: accumulatedTimeMs,
      settlement: {
        rewardDistributed: settlementResult.rewardAmount,
      },
      timestamp: Date.now(),
    });

    this.logger.log(`SLA completion broadcast sent to Advertiser [${settlementResult.advertiserId}]`);

    // 사용자에게도 실시간 리워드 적립 알림 발송
    await this.redisService.publishIntent(`user_reward:${settlementResult.userId}`, {
      event: 'REWARD_UPDATED',
      intentId,
      rewardAmount: settlementResult.rewardAmount,
      timestamp: Date.now(),
    });

    this.logger.log(`Reward notification sent to User [${settlementResult.userId}] (+${settlementResult.rewardAmount}P)`);

    // 잔여 예산이 5회치 미만이면 광고주에게 예산 부족 알림 발송
    const { remainingBudget, rewardPerVisit, advertiserId } = settlementResult;
    if (remainingBudget < rewardPerVisit * 5) {
      const remainingVisits = Math.floor(remainingBudget / rewardPerVisit);
      await this.redisService.publishIntent(`budget_alert:${advertiserId}`, {
        event: 'BUDGET_LOW',
        remainingBudget,
        remainingVisits,
        rewardPerVisit,
        isCritical: remainingBudget < rewardPerVisit,
        timestamp: Date.now(),
      });
      this.logger.warn(`Budget alert sent to Advertiser [${advertiserId}] — remaining: ${remainingBudget}원 (${remainingVisits}회)`);
    }

    return settlementResult;
  }

  /**
   * [체류시간 #4] 페이지 이탈 시 최종 체류시간 업데이트
   * - SLA_VERIFIED 상태인 intent만 허용
   * - 더 큰 값으로만 갱신 (줄어들면 무시)
   */
  async updateDwellTime(intentId: string, userId: string, finalDwellTimeMs: number) {
    const intent = await this.prisma.intent.findUnique({ where: { id: intentId } });
    if (!intent) throw new NotFoundException(`Intent [${intentId}] not found`);
    if (intent.userId !== userId) throw new BadRequestException('Unauthorized intent access');
    if (intent.status !== 'SLA_VERIFIED') {
      throw new BadRequestException(`Intent [${intentId}] is not SLA_VERIFIED`);
    }

    const currentDwell = intent.dwellTimeMs ?? 0;
    if (finalDwellTimeMs <= currentDwell) {
      this.logger.debug(`[체류시간] Intent [${intentId}] — new value ${finalDwellTimeMs}ms <= current ${currentDwell}ms, skipped`);
      return { updated: false, dwellTimeMs: currentDwell };
    }

    await this.prisma.intent.update({
      where: { id: intentId },
      data: { dwellTimeMs: finalDwellTimeMs },
    });

    this.logger.log(`[체류시간] Intent [${intentId}] dwellTimeMs updated: ${currentDwell}ms → ${finalDwellTimeMs}ms`);
    return { updated: true, dwellTimeMs: finalDwellTimeMs };
  }
}
