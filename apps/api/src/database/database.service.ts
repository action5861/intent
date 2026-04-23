import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 광고주 매칭 수락 시 실행되는 ACID 트랜잭션
   * - Intent 상태 → MATCHED, matchedAdvertiserId 저장
   * - Advertiser matchCount 증가
   */
  async executeMatchTransaction(intentId: string, advertiserId: string) {
    this.logger.debug(`[DB Transaction] Accepting match for Intent [${intentId}] by Advertiser [${advertiserId}]`);

    const matchId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      const intent = await tx.intent.findUnique({ where: { id: intentId } });
      if (!intent) throw new NotFoundException(`Intent [${intentId}] not found`);
      if (intent.status === 'MATCHED') throw new ConflictException(`Intent [${intentId}] is already matched`);

      await tx.intent.update({
        where: { id: intentId },
        data: { status: 'MATCHED', matchedAdvertiserId: advertiserId },
      });

      await tx.advertiser.update({
        where: { id: advertiserId },
        data: { matchCount: { increment: 1 } },
      });
    });

    this.logger.debug(`[DB Transaction COMMIT] Match recorded — matchId: ${matchId}`);
    return { matchId, status: 'MATCHED' };
  }

  /**
   * SLA 20초 달성 시 실행되는 정산 ACID 트랜잭션
   * - Advertiser remainingBudget 차감
   * - User rewardBalance 증가 (입찰가의 70%)
   * - Intent 상태 → SLA_VERIFIED
   * @param intentId — acceptMatch 시 반환된 intentId (= SLA transactionId)
   */
  // [체류시간 #2] dwellTimeMs를 함께 저장
  async executeSettlementTransaction(intentId: string, dwellTimeMs?: number) {
    this.logger.debug(`[DB Transaction] Settlement for Intent [${intentId}]`);

    const result = await this.prisma.$transaction(async (tx) => {
      const intent = await tx.intent.findUnique({ where: { id: intentId } });
      if (!intent) throw new NotFoundException(`Intent [${intentId}] not found`);
      if (!intent.matchedAdvertiserId) throw new BadRequestException(`Intent [${intentId}] has no matched advertiser`);
      if (intent.status === 'SLA_VERIFIED') throw new ConflictException(`Intent [${intentId}] is already settled`);

      const advertiser = await tx.advertiser.findUnique({ where: { id: intent.matchedAdvertiserId! } });
      if (!advertiser) throw new NotFoundException(`Advertiser [${intent.matchedAdvertiserId}] not found`);

      // 일일 적립 상한 체크 (오늘 0시 UTC 기준)
      const DAILY_REWARD_CAP = 1000;
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayEarnings = await tx.intent.aggregate({
        where: { userId: intent.userId, status: 'SLA_VERIFIED', slaVerifiedAt: { gte: todayStart } },
        _sum: { paidReward: true },
      });
      const earnedToday = todayEarnings._sum.paidReward ?? 0;
      const remainingCap = DAILY_REWARD_CAP - earnedToday;
      if (remainingCap <= 0) {
        throw new BadRequestException(`오늘 최대 적립 한도(${DAILY_REWARD_CAP}P)에 도달했습니다. 내일 다시 이용해주세요.`);
      }

      // 광고주 단가 vs 일일 잔여 한도 중 낮은 값 지급
      const rewardAmount = Math.min(advertiser.rewardPerVisit, remainingCap);

      if (advertiser.remainingBudget < rewardAmount) {
        throw new BadRequestException(`Advertiser [${advertiser.id}] has insufficient budget`);
      }

      await tx.advertiser.update({
        where: { id: advertiser.id },
        data: { remainingBudget: { decrement: rewardAmount } },
      });

      await tx.user.update({
        where: { id: intent.userId },
        data: { rewardBalance: { increment: rewardAmount } },
      });

      // [체류시간 #2] slaVerifiedAt, dwellTimeMs 함께 저장
      await tx.intent.update({
        where: { id: intentId },
        data: {
          status: 'SLA_VERIFIED',
          paidReward: rewardAmount,
          slaVerifiedAt: new Date(),
          ...(dwellTimeMs !== undefined && { dwellTimeMs }),
        },
      });

      return {
        advertiserId: advertiser.id,
        userId: intent.userId,
        rewardAmount,
        remainingBudget: advertiser.remainingBudget - rewardAmount,
        rewardPerVisit: advertiser.rewardPerVisit,
        status: 'SLA_VERIFIED',
      };
    });

    this.logger.debug(
      `[DB Transaction COMMIT] Advertiser [${result.advertiserId}] | User [${result.userId}] +${result.rewardAmount}P`,
    );
    return result;
  }
}
