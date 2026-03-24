import { Injectable, ConflictException, UnauthorizedException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(name: string, email: string, password: string) {
    if (!password || password.length < 8) {
      throw new BadRequestException('비밀번호는 8자 이상이어야 합니다.');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('회원가입에 실패했습니다.');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { name, email, passwordHash },
    });

    const token = this.jwtService.sign({ sub: user.id, name: user.name, email: user.email });
    return { accessToken: token, userId: user.id, name: user.name };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');

    if (user.status === 'BANNED') throw new UnauthorizedException('차단된 계정입니다. 고객센터에 문의하세요.');
    if (user.status === 'SUSPENDED') throw new UnauthorizedException('정지된 계정입니다. 고객센터에 문의하세요.');

    const token = this.jwtService.sign({ sub: user.id, name: user.name, email: user.email });
    return { accessToken: token, userId: user.id, name: user.name };
  }

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, rewardBalance: true, totalIntents: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getRewardHistory(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, rewardBalance: true, totalIntents: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const settledIntents = await this.prisma.intent.findMany({
      where: { userId, status: 'SLA_VERIFIED' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        enrichedText: true,
        rawText: true,
        category: true,
        matchedAdvertiserId: true,
        paidReward: true,
        createdAt: true,
      },
    });

    const advertiserIds = settledIntents
      .map((i) => i.matchedAdvertiserId)
      .filter((id): id is string => !!id);

    const advertisers = advertiserIds.length > 0
      ? await this.prisma.advertiser.findMany({
          where: { id: { in: advertiserIds } },
          select: { id: true, company: true },
        })
      : [];

    const advMap = new Map(advertisers.map((a) => [a.id, a]));

    const history = settledIntents.map((intent) => ({
      intentId: intent.id,
      text: intent.enrichedText ?? intent.rawText,
      category: intent.category,
      advertiserCompany: intent.matchedAdvertiserId
        ? (advMap.get(intent.matchedAdvertiserId)?.company ?? '알 수 없음')
        : '알 수 없음',
      rewardAmount: intent.paidReward ?? 0,  // 정산 시점의 실제 지급액 사용
      earnedAt: intent.createdAt,
    }));

    return {
      name: user.name,
      rewardBalance: user.rewardBalance,
      totalIntents: user.totalIntents,
      totalEarned: history.reduce((s, h) => s + h.rewardAmount, 0),
      history,
    };
  }

  async withdraw(
    userId: string,
    amount: number,
    bankName: string,
    accountNumber: string,
    accountHolder: string,
  ) {
    // [인출 #3] 금액 검증
    if (!amount || amount < 10000) {
      throw new BadRequestException('최소 인출 금액은 10,000P입니다.');
    }
    if (amount % 1000 !== 0) {
      throw new BadRequestException('인출 금액은 1,000P 단위로 입력해야 합니다.');
    }
    if (!bankName || !accountNumber || !accountHolder) {
      throw new BadRequestException('은행 정보를 모두 입력해주세요.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    if (user.rewardBalance < amount) {
      throw new BadRequestException('잔액이 부족합니다.');
    }

    // [인출 #3] PENDING 중복 신청 방지
    const existingPending = await this.prisma.withdrawalRequest.findFirst({
      where: { userId, status: 'PENDING' },
    });
    if (existingPending) {
      throw new BadRequestException('이미 처리 대기 중인 인출 요청이 있습니다.');
    }

    // [인출 #3] 신청 시점에 포인트 차감하지 않음 — 어드민 승인 시 차감
    await this.prisma.withdrawalRequest.create({
      data: { userId, amount, bankName, accountNumber, accountHolder },
    });

    return { withdrawnAmount: amount, newBalance: user.rewardBalance };
  }

  // [인출 #3] 사용자 인출 신청 내역 조회
  async getWithdrawalHistory(userId: string) {
    return this.prisma.withdrawalRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        bankName: true,
        accountNumber: true,
        accountHolder: true,
        status: true,
        adminMemo: true,
        processedAt: true,
        createdAt: true,
      },
    });
  }

  async advertiserLogin(email: string, password: string) {
    const advertiser = await this.prisma.advertiser.findUnique({ where: { email } });
    if (!advertiser || !advertiser.passwordHash) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const valid = await bcrypt.compare(password, advertiser.passwordHash);
    if (!valid) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');

    if (advertiser.status === 'SUSPENDED') throw new ForbiddenException('정지된 광고주 계정입니다.');

    const token = this.jwtService.sign({
      sub: advertiser.id,
      company: advertiser.company,
      email: advertiser.email,
      category: advertiser.category,
      role: 'advertiser',
    });
    return { accessToken: token, advertiserId: advertiser.id, company: advertiser.company };
  }
}
