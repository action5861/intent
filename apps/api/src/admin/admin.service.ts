import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus, AdvertiserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AiService } from '../ai/ai.service';

export { UserStatus, AdvertiserStatus };

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  // ── 통계 ──────────────────────────────────────────────
  async getStats() {
    const [users, advertisers] = await Promise.all([
      this.prisma.user.findMany({ select: { status: true, rewardBalance: true } }),
      this.prisma.advertiser.findMany({ select: { status: true, totalBudget: true, remainingBudget: true, matchCount: true } }),
    ]);

    return {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.status === 'ACTIVE').length,
      totalAdvertisers: advertisers.length,
      activeAdvertisers: advertisers.filter((a) => a.status === 'ACTIVE').length,
      totalRewardsPaid: users.reduce((s, u) => s + u.rewardBalance, 0),
      totalBudgetSpent: advertisers.reduce((s, a) => s + (a.totalBudget - a.remainingBudget), 0),
      totalMatches: advertisers.reduce((s, a) => s + a.matchCount, 0),
    };
  }

  // ── 사용자 ────────────────────────────────────────────
  async getUsers() {
    return this.prisma.user.findMany({
      orderBy: { joinedAt: 'desc' },
      select: {
        id: true, name: true, email: true, status: true,
        totalIntents: true, rewardBalance: true, joinedAt: true,
        // passwordHash 응답 제외
      },
    });
  }

  async updateUserStatus(id: string, status: UserStatus) {
    try {
      return await this.prisma.user.update({ where: { id }, data: { status } });
    } catch {
      throw new NotFoundException(`User ${id} not found`);
    }
  }

  async deleteUser(id: string) {
    try {
      await this.prisma.user.delete({ where: { id } });
      return { deleted: true };
    } catch {
      throw new NotFoundException(`User ${id} not found`);
    }
  }

  async getUserIntents(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    return this.prisma.intent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ── 광고주 ────────────────────────────────────────────
  async getAdvertisers() {
    return this.prisma.advertiser.findMany({
      orderBy: { joinedAt: 'desc' },
      select: {
        id: true, company: true, contactName: true, email: true,
        category: true, keywords: true, siteDescription: true, siteUrl: true,
        rewardPerVisit: true, totalBudget: true, remainingBudget: true,
        status: true, matchCount: true, joinedAt: true,
        // passwordHash은 응답에서 제외
      },
    });
  }

  async createAdvertiser(data: {
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
  }) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const budget = data.totalBudget ?? 0;
    const rewardPerVisit = Math.min(Math.max(data.rewardPerVisit ?? 500, 1), 1000);
    return this.prisma.advertiser.create({
      data: {
        company: data.company,
        contactName: data.contactName,
        email: data.email,
        passwordHash,
        category: data.category,
        keywords: data.keywords ?? [],
        siteDescription: data.siteDescription ?? null,
        siteUrl: data.siteUrl ?? null,
        rewardPerVisit,
        totalBudget: budget,
        remainingBudget: budget,
        status: 'ACTIVE',
      },
      select: {
        id: true, company: true, contactName: true, email: true,
        category: true, keywords: true, siteDescription: true, siteUrl: true,
        rewardPerVisit: true, totalBudget: true, remainingBudget: true,
        status: true, matchCount: true, joinedAt: true,
      },
    });
  }

  async resetAdvertiserPassword(id: string, newPassword: string) {
    const adv = await this.prisma.advertiser.findUnique({ where: { id } });
    if (!adv) throw new NotFoundException(`Advertiser ${id} not found`);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.advertiser.update({ where: { id }, data: { passwordHash } });
    return { success: true };
  }

  // [어드민개선 #2] 수정 가능 필드 확장 (company, category, keywords, siteUrl, siteDescription, remainingBudget 추가)
  async updateAdvertiser(id: string, patch: {
    status?: AdvertiserStatus;
    company?: string;
    category?: string;
    keywords?: string[];
    siteUrl?: string;
    siteDescription?: string;
    totalBudget?: number;
    remainingBudget?: number;
    rewardPerVisit?: number;
  }) {
    const adv = await this.prisma.advertiser.findUnique({ where: { id } });
    if (!adv) throw new NotFoundException(`Advertiser ${id} not found`);

    const data: any = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.company !== undefined) data.company = patch.company;
    if (patch.category !== undefined) data.category = patch.category;
    // [키워드관리 #1] 빈 문자열 필터링 + trim 처리
    if (patch.keywords !== undefined)
      data.keywords = patch.keywords.map((k) => k.trim()).filter(Boolean);
    if (patch.siteUrl !== undefined) data.siteUrl = patch.siteUrl;
    if (patch.siteDescription !== undefined) data.siteDescription = patch.siteDescription;
    if (patch.rewardPerVisit !== undefined) {
      data.rewardPerVisit = Math.min(Math.max(patch.rewardPerVisit, 1), 1000);
    }
    // totalBudget 단독 수정 시 기존 diff 방식 유지, remainingBudget 직접 지정 시 그대로 반영
    if (patch.totalBudget !== undefined && patch.remainingBudget === undefined) {
      const diff = patch.totalBudget - adv.totalBudget;
      data.totalBudget = patch.totalBudget;
      data.remainingBudget = Math.max(0, adv.remainingBudget + diff);
    } else {
      if (patch.totalBudget !== undefined) data.totalBudget = patch.totalBudget;
      if (patch.remainingBudget !== undefined) data.remainingBudget = Math.max(0, patch.remainingBudget);
    }

    return this.prisma.advertiser.update({
      where: { id },
      data,
      select: {
        id: true, company: true, contactName: true, email: true,
        category: true, keywords: true, siteDescription: true, siteUrl: true,
        rewardPerVisit: true, totalBudget: true, remainingBudget: true,
        status: true, matchCount: true, joinedAt: true,
      },
    });
  }

  // [어드민개선 #3] 비밀번호 초기화 — 고정값 "advertiser1234!" 로 재설정
  async resetAdvertiserPasswordToDefault(id: string) {
    const adv = await this.prisma.advertiser.findUnique({ where: { id } });
    if (!adv) throw new NotFoundException(`Advertiser ${id} not found`);
    const passwordHash = await bcrypt.hash('advertiser1234!', 10);
    await this.prisma.advertiser.update({ where: { id }, data: { passwordHash } });
    return { success: true };
  }

  async deleteAdvertiser(id: string) {
    try {
      await this.prisma.advertiser.delete({ where: { id } });
      return { deleted: true };
    } catch {
      throw new NotFoundException(`Advertiser ${id} not found`);
    }
  }

  // [어드민매칭 #1] 광고주별 매칭 상세 — 비식별 처리 + 요약 통계
  async getAdvertiserMatches(advertiserId: string) {
    const adv = await this.prisma.advertiser.findUnique({
      where: { id: advertiserId },
      select: {
        id: true, company: true, category: true,
        matchCount: true, remainingBudget: true, totalBudget: true,
      },
    });
    if (!adv) throw new NotFoundException(`Advertiser ${advertiserId} not found`);

    const rawMatches = await this.prisma.intent.findMany({
      where: { matchedAdvertiserId: advertiserId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        enrichedText: true,
        category: true,
        expectedPrice: true,
        status: true,
        dwellTimeMs: true,
        paidReward: true,
        slaVerifiedAt: true,
        createdAt: true,
        userId: true,
      },
    });

    // [어드민매칭 #1] 비식별 변환 — userId 원본 제거, displayId만 노출
    const matches = rawMatches.map(({ userId, ...rest }) => ({
      ...rest,
      user: { displayId: 'USER_' + userId.slice(-4).toUpperCase() },
    }));

    // [어드민매칭 #1] 요약 통계
    const slaVerified = rawMatches.filter((m) => m.status === 'SLA_VERIFIED');
    const summary = {
      totalMatches: rawMatches.length,
      slaVerified: slaVerified.length,
      avgDwellTimeMs:
        slaVerified.length > 0
          ? Math.round(
              slaVerified.reduce((sum, m) => sum + (m.dwellTimeMs ?? 0), 0) / slaVerified.length,
            )
          : 0,
      totalPaidReward: slaVerified.reduce((sum, m) => sum + (m.paidReward ?? 0), 0),
    };

    return { advertiser: adv, summary, matches };
  }

  async analyzeAdvertiserSite(url: string) {
    return this.aiService.analyzeAdvertiserWebsite(url);
  }

  // ── 인출 관리 ─────────────────────────────────────────

  // [인출 #5] 전체 인출 요청 목록 (최신순, user 정보 포함)
  async getWithdrawals() {
    return this.prisma.withdrawalRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, rewardBalance: true },
        },
      },
    });
  }

  // [인출 #5] 인출 승인 — $transaction 콜백 + 잔액 조건부 UPDATE (TOCTOU 방지)
  async approveWithdrawal(id: string) {
    const withdrawal = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
      include: { user: { select: { id: true, rewardBalance: true } } },
    });
    if (!withdrawal) throw new NotFoundException('인출 요청을 찾을 수 없습니다.');
    if (withdrawal.status !== 'PENDING') {
      throw new BadRequestException('이미 처리된 인출 요청입니다.');
    }
    if (withdrawal.user.rewardBalance < withdrawal.amount) {
      throw new BadRequestException('사용자 잔액이 부족합니다.');
    }

    // [인출 #5] TOCTOU 방지: updateMany의 where 조건에 잔액 하한선을 걸어
    // 체크 → 트랜잭션 사이 잔액이 소진되면 count=0이 되어 에러 처리
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: withdrawal.userId, rewardBalance: { gte: withdrawal.amount } },
        data: { rewardBalance: { decrement: withdrawal.amount } },
      });
      if (updated.count === 0) {
        throw new BadRequestException('사용자 잔액이 부족합니다.');
      }
      await tx.withdrawalRequest.update({
        where: { id },
        data: { status: 'APPROVED', processedAt: new Date() },
      });
    });

    return { success: true };
  }

  // [인출 #5] 인출 거부 — adminMemo 저장, 포인트 차감 없음
  async rejectWithdrawal(id: string, memo: string) {
    const withdrawal = await this.prisma.withdrawalRequest.findUnique({ where: { id } });
    if (!withdrawal) throw new NotFoundException('인출 요청을 찾을 수 없습니다.');
    if (withdrawal.status !== 'PENDING') {
      throw new BadRequestException('이미 처리된 인출 요청입니다.');
    }

    await this.prisma.withdrawalRequest.update({
      where: { id },
      data: { status: 'REJECTED', adminMemo: memo || null, processedAt: new Date() },
    });

    return { success: true };
  }
}
