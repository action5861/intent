import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { DatabaseService } from '../database/database.service';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class IntentsService {
  private readonly logger = new Logger(IntentsService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly dbService: DatabaseService,
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 사용자 의도 상장 — AI 파싱 후 Redis(실시간 매칭) + PostgreSQL(영구 보관) 동시 저장
   */
  async handleIncomingIntent(intentDto: { userId: string; rawText: string; enrichedText?: string }) {
    if (!intentDto.rawText || !intentDto.userId) {
      throw new BadRequestException('rawText and userId are required');
    }

    // 1. Gemini AI로 의도 파싱
    const textToAnalyze = intentDto.enrichedText || intentDto.rawText;
    const parsedIntent = await this.aiService.parseUserTextToIntent(textToAnalyze);

    const intentId = randomUUID();
    const intentData = {
      id: intentId,
      userId: intentDto.userId,
      rawText: intentDto.rawText,
      enrichedText: intentDto.enrichedText ?? null,
      ...parsedIntent,
      status: 'WAITING_MATCH',
      createdAt: new Date().toISOString(),
    };

    if (!intentData.category) {
      this.logger.warn(`AI failed to extract category for text: ${textToAnalyze}`);
      intentData.category = 'UNKNOWN';
    }

    // 2. PostgreSQL에 영구 저장 (핵심 추가)
    await this.prisma.intent.create({
      data: {
        id: intentId,
        userId: intentDto.userId,
        rawText: intentDto.rawText,
        enrichedText: intentDto.enrichedText ?? null,
        category: intentData.category,
        details: parsedIntent.details ?? undefined,
        expectedPrice: parsedIntent.expectedPrice ?? null,
        confidenceScore: parsedIntent.confidenceScore ?? null,
        actionType: parsedIntent.actionType ?? null,
        status: 'WAITING_MATCH',
      },
    });

    // 3. Redis 캐시에 임시 저장 (실시간 매칭용 TTL 10분)
    await this.redisService.setCache(`intent:data:${intentId}`, intentData, 600);

    // 4. Pub/Sub — 카테고리 채널 브로드캐스트 (기존 방식 유지)
    await this.redisService.publishIntent(intentData.category, intentData);

    // 5. 사용자의 totalIntents 카운트 증가
    await this.prisma.user.updateMany({
      where: { id: intentDto.userId },
      data: { totalIntents: { increment: 1 } },
    });

    // 6. AI 기반 선별 매칭 — 비동기로 실행 (상장 응답 속도에 영향 없음)
    this.runAiMatching(intentId, intentData, parsedIntent).catch((err) =>
      this.logger.error(`AI matching failed for intent [${intentId}]`, err),
    );

    this.logger.log(`Intent [${intentId}] saved to DB and published to category: ${intentData.category}`);

    return {
      message: 'Intent successfully saved and published for real-time match.',
      intentId,
      parsedData: parsedIntent,
      expiresIn: '10m',
    };
  }

  /**
   * AI 기반 선별 매칭 — 카테고리 적합 광고주를 Gemini로 스코어링 후 70점 이상만 개인 채널 발송
   */
  private async runAiMatching(intentId: string, intentData: any, parsedIntent: any) {
    const baseIntentText = intentData.enrichedText || intentData.rawText;
    const category = intentData.category;
    const expectedPrice: number | null = parsedIntent.expectedPrice ?? null;

    // [개선 #5] 스코어링 프롬프트에 예상 예산 정보 포함
    const intentText = expectedPrice
      ? `${baseIntentText} (예상 예산: ${expectedPrice.toLocaleString('ko-KR')}원)`
      : baseIntentText;

    // [속도개선 #3] 후보 수 20 → 12로 축소 (키워드 5 + 카테고리 5 + 기타 2)
    // 프롬프트 토큰 절감 → 스코어링 시간 비례 감소
    const KW_LIMIT = 5;
    const CAT_LIMIT = 5;
    const OTHER_LIMIT = 2;
    const baseWhere = { status: 'ACTIVE' as const, remainingBudget: { gt: 0 } };
    const selectFields = {
      id: true, company: true, category: true, keywords: true,
      siteDescription: true, siteUrl: true, rewardPerVisit: true, remainingBudget: true,
    };

    // [채용매칭 #1] 키워드 일치 광고주를 최우선 조회
    const intentKeywords: string[] = parsedIntent.details?.keywords ?? [];
    const keywordMatched = intentKeywords.length > 0
      ? await this.prisma.advertiser.findMany({
          where: {
            ...baseWhere,
            keywords: { hasSome: intentKeywords },
          },
          select: selectFields,
          take: KW_LIMIT,
        })
      : [];

    const keywordMatchedIds = new Set(keywordMatched.map((a) => a.id));

    const categoryMatched = await this.prisma.advertiser.findMany({
      where: { ...baseWhere, category, id: { notIn: [...keywordMatchedIds] } },
      select: selectFields,
      take: CAT_LIMIT,
    });

    const categoryMatchedIds = new Set(categoryMatched.map((a) => a.id));

    const otherCandidates = await this.prisma.advertiser.findMany({
      where: {
        ...baseWhere,
        category: { not: category },
        id: { notIn: [...keywordMatchedIds, ...categoryMatchedIds] },
      },
      select: selectFields,
      take: OTHER_LIMIT,
    });

    const candidates = [...keywordMatched, ...categoryMatched, ...otherCandidates];

    if (candidates.length === 0) {
      this.logger.log(`[AI Matching] No candidate advertisers for intent [${intentId}] (category: ${category})`);
      return;
    }

    this.logger.log(`[AI Matching] Scoring ${candidates.length} advertisers for intent [${intentId}]`);

    // Gemini로 일괄 스코어링
    const scores = await this.aiService.rankAdvertisersForIntent(intentText, candidates);

    // [개선 #3] AI 실패(빈 배열) 시 매칭 중단
    if (scores.length === 0) {
      this.logger.warn(`[AI Matching] Scoring returned empty — aborting match for intent [${intentId}]`);
      return;
    }

    // [개선 #4] 70점 이상 내림차순 정렬 후 예산 충분한 첫 번째 광고주 선택
    const qualified = scores.filter((s) => s.score >= 70).sort((a, b) => b.score - a.score);
    if (qualified.length === 0) {
      this.logger.log(`[AI Matching] No match >= 70 for intent [${intentId}] — trying fallback`);
      await this.prisma.intent.update({ where: { id: intentId }, data: { recommendedAdvertisers: [] } });
      await this.runFallbackMatching(intentId, intentData, intentKeywords);
      return;
    }

    let topMatch: (typeof qualified)[0] | null = null;
    for (const candidate of qualified) {
      // [개선 #2] 매칭 직전 예산 재확인 (스코어링 사이에 예산 소진 가능성 대비)
      const advertiser = await this.prisma.advertiser.findUnique({
        where: { id: candidate.advertiserId },
        select: { remainingBudget: true, rewardPerVisit: true },
      });
      if (advertiser && advertiser.remainingBudget >= advertiser.rewardPerVisit) {
        topMatch = candidate;
        break;
      }
      this.logger.warn(`[AI Matching] Advertiser [${candidate.advertiserId}] skipped — insufficient budget`);
    }

    if (!topMatch) {
      this.logger.warn(`[AI Matching] All qualified advertisers have insufficient budget for intent [${intentId}] — trying fallback`);
      await this.prisma.intent.update({ where: { id: intentId }, data: { recommendedAdvertisers: [] } });
      await this.runFallbackMatching(intentId, intentData, intentKeywords);
      return;
    }

    this.logger.log(`[AI Matching] Auto-matching intent [${intentId}] with advertiser [${topMatch.advertiserId}] (score: ${topMatch.score})`);

    // 추천 광고주: 1등 제외, 50점 이상, 최대 2개 (자동매칭 70점보다 완화)
    const recommended = scores
      .filter((s) => s.score >= 50 && s.advertiserId !== topMatch!.advertiserId)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((s) => {
        const adv = candidates.find((c) => c.id === s.advertiserId);
        return {
          advertiserId: s.advertiserId,
          company: adv?.company ?? null,
          siteUrl: adv?.siteUrl ?? null,
          score: s.score,
          reason: s.reason,
        };
      });

    // 자동 매칭 트랜잭션 실행
    await this.dbService.executeMatchTransaction(intentId, topMatch.advertiserId);

    // [추천매칭 #2] 추천 광고주 DB 저장 (보상 없음, 노출 전용)
    await this.prisma.intent.update({
      where: { id: intentId },
      data: { recommendedAdvertisers: recommended },
    });

    // 광고주에게 매칭 완료 알림 발송
    const channel = `match:ads:${topMatch.advertiserId}`;
    const payload = {
      ...intentData,
      matchScore: topMatch.score,
      matchReason: topMatch.reason,
    };
    await this.redisService.publishIntent(channel, payload);

    // 사용자에게 매칭 완료 알림 발송
    const matchedAdvertiser = candidates.find((c) => c.id === topMatch!.advertiserId);
    const userChannel = `user_match:${intentData.userId}`;
    await this.redisService.publishIntent(userChannel, {
      intentId,
      matchedAdvertiserCompany: matchedAdvertiser?.company ?? null,
      matchedAdvertiserSiteUrl: matchedAdvertiser?.siteUrl ?? null,
      rewardPerVisit: matchedAdvertiser?.rewardPerVisit ?? null,
      recommendedAdvertisers: recommended,
    });

    this.logger.log(`[AI Matching] Auto-matched and notified advertiser [${topMatch.advertiserId}] — ${recommended.length} recommended`);
  }

  /**
   * 폴백 매칭 — 정규 AI 매칭 실패 시 폴백 광고주(쿠팡·네이버쇼핑·옥션) 중 가장 관련 있는 광고주로 자동 매칭
   */
  private async runFallbackMatching(intentId: string, intentData: any, intentKeywords: string[]) {
    const fallbacks = await this.prisma.advertiser.findMany({
      where: { isFallback: true, status: 'ACTIVE', remainingBudget: { gt: 0 } },
      select: { id: true, company: true, siteUrl: true, keywords: true, rewardPerVisit: true, remainingBudget: true },
    });

    if (fallbacks.length === 0) {
      this.logger.warn(`[Fallback Matching] No available fallback advertisers for intent [${intentId}]`);
      return;
    }

    // 의도 키워드와 가장 많이 겹치는 폴백 광고주 선택, 동점이면 순서 유지 (쿠팡 우선)
    const scored = fallbacks.map((fb) => ({
      advertiser: fb,
      overlap: fb.keywords.filter((kw) => intentKeywords.includes(kw)).length,
    }));
    scored.sort((a, b) => b.overlap - a.overlap);

    const selected = scored[0].advertiser;
    this.logger.log(`[Fallback Matching] Matching intent [${intentId}] with fallback [${selected.company}] (keyword overlap: ${scored[0].overlap})`);

    await this.dbService.executeMatchTransaction(intentId, selected.id);

    const channel = `match:ads:${selected.id}`;
    await this.redisService.publishIntent(channel, { ...intentData, matchScore: 0, matchReason: '폴백 자동 매칭' });

    const userChannel = `user_match:${intentData.userId}`;
    await this.redisService.publishIntent(userChannel, {
      intentId,
      matchedAdvertiserCompany: selected.company,
      matchedAdvertiserSiteUrl: selected.siteUrl,
      rewardPerVisit: selected.rewardPerVisit,
      recommendedAdvertisers: [],
    });

    this.logger.log(`[Fallback Matching] Fallback matched intent [${intentId}] with [${selected.company}]`);
  }

  /**
   * 사용자의 의도 목록 조회 (DB에서)
   */
  async getUserIntents(userId: string) {
    // [추천매칭 #3] recommendedAdvertisers 필드 포함 조회
    // [의도삭제 #1] 사용자가 삭제한 의도는 제외
    const intents = await this.prisma.intent.findMany({
      where: { userId, deletedByUser: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, userId: true, rawText: true, enrichedText: true,
        category: true, details: true, expectedPrice: true,
        confidenceScore: true, actionType: true, status: true,
        matchedAdvertiserId: true, paidReward: true, createdAt: true,
        recommendedAdvertisers: true,
      },
    });

    const advertiserIds = intents
      .map((i) => i.matchedAdvertiserId)
      .filter((id): id is string => !!id);

    if (advertiserIds.length === 0) return intents;

    const advertisers = await this.prisma.advertiser.findMany({
      where: { id: { in: advertiserIds } },
      select: { id: true, company: true, siteUrl: true, rewardPerVisit: true },
    });

    const advMap = new Map(advertisers.map((a) => [a.id, a]));

    return intents.map((intent) => ({
      ...intent,
      matchedAdvertiserCompany: intent.matchedAdvertiserId
        ? (advMap.get(intent.matchedAdvertiserId)?.company ?? null)
        : null,
      matchedAdvertiserSiteUrl: intent.matchedAdvertiserId
        ? (advMap.get(intent.matchedAdvertiserId)?.siteUrl ?? null)
        : null,
      rewardPerVisit: intent.matchedAdvertiserId
        ? (advMap.get(intent.matchedAdvertiserId)?.rewardPerVisit ?? null)
        : null,
    }));
  }

  /**
   * 대화형 Intent 수집
   * [추천강화 #1] 마지막 사용자 메시지에서 카테고리 유추 → 관련 광고주 컨텍스트 주입
   */
  async chatIntent(dto: { userId: string; messages: { role: string; content: string }[] }) {
    if (!dto.userId || !dto.messages?.length) {
      throw new BadRequestException('userId and messages are required');
    }

    // [추천강화 #1] 전체 대화에서 카테고리 힌트 추출 (마지막 사용자 메시지 기준)
    const lastUserMsg = dto.messages.filter((m) => m.role === 'user').pop()?.content ?? '';
    const categoryHints = this.detectCategoryFromText(lastUserMsg);

    // [추천강화 #1] 카테고리별 균등 조회 (총 10개, 카테고리당 최대 5개) — 다중 카테고리 시 한쪽이 밀리지 않도록
    let advertiserContext = '';
    if (categoryHints.length > 0) {
      const perCat = Math.max(2, Math.floor(10 / categoryHints.length));
      const results = await Promise.all(
        categoryHints.map((cat) =>
          this.prisma.advertiser.findMany({
            where: { status: 'ACTIVE', remainingBudget: { gt: 0 }, category: cat },
            select: { company: true, keywords: true, category: true },
            take: perCat,
          }),
        ),
      );
      const advertisers = results.flat();
      if (advertisers.length > 0) {
        advertiserContext = advertisers
          .map((a) => `${a.company} (${a.category}): ${a.keywords.slice(0, 3).join(', ')}`)
          .join('\n');
      }
    }

    return this.aiService.conductIntentDialog(dto.messages, advertiserContext);
  }

  /**
   * [추천강화 #2] 텍스트에서 카테고리 힌트 추출 — AI 호출 없이 키워드 매칭으로 빠르게 처리
   * - 매핑 실패 시 빈 배열 반환 (기타 폴백 제거 — 무관한 광고주 주입 방지)
   * - 건강기능식품 관련 키워드는 식품+의료 동시 매핑
   */
  private detectCategoryFromText(text: string): string[] {
    const mapping: Record<string, string[]> = {
      '전자기기': ['핸드폰', '노트북', '컴퓨터', '갤럭시', '아이폰', '태블릿', '이어폰', '가전'],
      '패션': ['옷', '신발', '운동화', '자켓', '코트', '가방', '의류'],
      '식품': ['음식', '간식', '식품', '선물세트', '배달', '맛집', '레시피'],
      '의료': ['건강식품', '홍삼', '비타민', '영양제', '병원', '치과', '한의원', '건강검진', '의료', '건강기능'],
      '여행': ['여행', '호텔', '항공', '숙소', '펜션', '렌트카'],
      '부동산': ['아파트', '전세', '월세', '부동산', '이사'],
      '금융': ['대출', '카드', '적금', '투자', '주식'],
      '보험': ['보험', '암보험', '실비', '자동차보험'],
      '자동차': ['자동차', '중고차', '카니발', '현대차', '기아차'],
      '뷰티': ['화장품', '스킨케어', '로션', '메이크업', '뷰티'],
      '교육': ['학원', '인강', '토익', '영어', '수학', '과외', '자격증'],
      '법률': ['변호사', '법률', '상담', '소송'],
      '쇼핑': ['쇼핑', '최저가', '할인', '배송'],
      // [채용매칭 #2] 채용/구인구직 의도 → '기타' 카테고리 광고주(사람인, 잡코리아, 원티드) 우선 조회
      '기타': ['채용', '구인', '구직', '이력서', '면접', '연봉', '취업', '인사', '경력직', '신입', '헤드헌터'],
    };

    const categories: string[] = [];
    for (const [category, keywords] of Object.entries(mapping)) {
      if (keywords.some((kw) => text.includes(kw))) {
        categories.push(category);
      }
    }
    // [버그수정] 매핑 실패 시 빈 배열 반환 — '기타' 폴백은 무관한 포털/뉴스 광고주를 주입해 AI 오염
    return categories;
  }

  /**
   * 광고주에게 매칭된 Intent 목록 조회
   */
  async getAdvertiserMatches(advertiserId: string) {
    return this.prisma.intent.findMany({
      where: { matchedAdvertiserId: advertiserId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        enrichedText: true,
        rawText: true,
        category: true,
        expectedPrice: true,
        status: true,
        createdAt: true,
        // [체류시간 #6] 체류시간, 검증 시각, 지급 포인트 포함
        dwellTimeMs: true,
        slaVerifiedAt: true,
        paidReward: true,
      },
    });
  }

  /**
   * 대기 중인 Intent 재매칭 트리거 (광고주 신규 등록 시 또는 어드민 수동 호출)
   */
  async retriggerMatchingForWaitingIntents() {
    const waitingIntents = await this.prisma.intent.findMany({
      where: { status: 'WAITING_MATCH' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    this.logger.log(`[Re-matching] Triggering AI matching for ${waitingIntents.length} waiting intents`);

    for (const intent of waitingIntents) {
      const parsedDetails = (intent.details as any) ?? {};
      const intentData = {
        id: intent.id,
        userId: intent.userId,
        rawText: intent.rawText,
        enrichedText: intent.enrichedText,
        category: intent.category,
        expectedPrice: intent.expectedPrice,
        status: intent.status,
        createdAt: intent.createdAt.toISOString(),
      };
      this.runAiMatching(intent.id, intentData, { details: parsedDetails, category: intent.category }).catch((err) =>
        this.logger.error(`Re-matching failed for intent [${intent.id}]`, err),
      );
    }

    return { triggered: waitingIntents.length };
  }

  /**
   * [의도삭제 #1] 사용자 의도 소프트 딜리트
   * - DB/어드민에서는 보존, 사용자 대시보드에서만 숨김
   */
  async softDeleteIntent(intentId: string, userId: string) {
    const intent = await this.prisma.intent.findUnique({ where: { id: intentId } });
    if (!intent) throw new NotFoundException(`Intent ${intentId} not found`);
    if (intent.userId !== userId) throw new BadRequestException('본인의 의도만 삭제할 수 있습니다.');

    await this.prisma.intent.update({
      where: { id: intentId },
      data: { deletedByUser: true },
    });
    return { success: true };
  }

  /**
   * 광고주 매칭 수락
   */
  async acceptMatch(intentId: string, matchDto: any) {
    if (!matchDto.advertiserId) {
      throw new BadRequestException('AdvertiserId required');
    }

    const redisKey = `intent:data:${intentId}`;
    const intentData = await this.redisService.getCache<any>(redisKey);

    // DB에서 최신 상태 확인 (Redis 캐시 만료 여부와 무관하게)
    const dbIntent = await this.prisma.intent.findUnique({ where: { id: intentId } });
    if (!dbIntent) throw new NotFoundException('Intent has expired or does not exist');
    if (dbIntent.status !== 'WAITING_MATCH') {
      throw new BadRequestException(`Intent [${intentId}] is not in WAITING_MATCH status (current: ${dbIntent.status})`);
    }

    await this.dbService.executeMatchTransaction(intentId, matchDto.advertiserId);

    await this.redisService.setCache(redisKey, null, 1);

    this.logger.log(`Intent [${intentId}] matched with Advertiser [${matchDto.advertiserId}]`);

    return {
      intentId,
      transactionId: intentId,  // SLA 검증 시 이 값을 /api/sla/verify 의 transactionId로 사용
      status: 'MATCH_COMPLETED',
    };
  }
}
