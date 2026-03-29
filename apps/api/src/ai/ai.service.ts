import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  // 환각(Hallucination) 방지 및 일관된 JSON 스키마를 보장하는 마스터 프롬프트
  private readonly MASTER_PROMPT = `
당신은 사용자의 짧은 텍스트(예: 검색어, 질문, 대화형 문구)를 분석하여 구체적인 '검색 의도(Intent)'를 추출하는 초정밀 데이터 파서(Data Parser)입니다.
반드시 아래의 지시사항(System Instruction)을 엄격하게 준수하여 응답해야 합니다.

[작업 규칙]
1. 입력된 텍스트에서 사용자가 원하거나 찾고 있는 핵심 카테고리(category)와 관련 상세 정보(details), 기대하는 예산/단가 수준(expectedPrice - 추정 가능 시), 그리고 의도의 명확도(confidenceScore - 0~100)를 추출할 것.
2. 환각(Hallucination)을 금지합니다. 입력 텍스트에 없는 내용을 지어내지 말고, 모르는 값은 null로 처리할 것.
3. 응답은 오직, 단 하나의 유효한 JSON 객체 형태({ ... })여야 합니다.
4. **절대로** \`\`\`json 이나 마크다운 블록, 혹은 부가적인 텍스트 설명이나 인사말 등을 앞뒤에 붙이지 마십시오. 순수한 JSON 문자열 값만 출력하세요.

// [카테고리개선 #1] 카테고리별 분류 가이드 추가 — "기타" 남용 방지, 경계 케이스 명시
[카테고리 목록 및 분류 가이드] 반드시 아래 15개 중 하나만 사용하세요. "기타"는 아래 14개에 진짜 해당하지 않을 때만 사용하세요.

- 전자기기: 핸드폰, 노트북, 태블릿, 가전제품, IT기기, 소프트웨어(개발도구·업무용), 카메라, 이어폰, 스피커 (※ 음악·영상·게임 구독 서비스는 쇼핑으로 분류)
- 패션: 의류, 신발, 가방, 지갑, 액세서리, 시계, 스포츠웨어, 아웃도어 의류
- 식품: 음식, 배달음식, 식료품, 간식, 건강식품, 홍삼, 비타민, 영양제, 식재료, 밀키트
- 여행: 항공권, 호텔, 숙박, 렌트카, 관광, 펜션, 해외여행, 국내여행, 여행패키지
- 부동산: 아파트, 전세, 월세, 매매, 이사, 인테리어, 리모델링, 분양, 오피스텔
- 금융: 대출, 신용카드, 적금, 예금, 투자, 주식, 증권, 펀드, 가상화폐, 재테크
- 보험: 자동차보험, 암보험, 실비보험, 생명보험, 화재보험, 건강보험, 여행자보험
- 자동차: 신차, 중고차, 자동차 구매, 전기차, SUV, 세단, 자동차 관리, 튜닝
- 뷰티: 화장품, 스킨케어, 메이크업, 헤어케어, 네일, 향수, 피부 관리, 미용
- 교육: 학원, 온라인강의, 자격증, 토익, 영어, 수학, 과외, 취업준비, 채용, 이직, 커리어
- 의료: 병원, 치과, 한의원, 건강검진, 수술, 약국, 의약품, 재활, 정신건강
- 법률: 변호사, 법무사, 세무사, 소송, 법률상담, 이혼, 상속, 계약서, 특허
- 쇼핑: 온라인쇼핑몰, 최저가 비교, 오픈마켓, 해외직구, 공동구매, 쿠폰, 할인, 음악/영상/게임 구독 서비스(멜론·넷플릭스·유튜브뮤직 등), 앱스토어
- 비영리: 기부, 봉사활동, NGO, 종교, 사회적 기업, 환경, 공익 캠페인

[분류 경계 케이스 가이드]
- 건강식품(홍삼·비타민·영양제) → 식품 (병원·치료 목적이면 의료)
- 운동·스포츠용품 → 패션 (스포츠웨어), 운동 관련 건강 목적이면 의료
- 채용·구인구직·이직·커리어 → 교육
- 뉴스·미디어·언론 → 기타 (직접 서비스 없음)
- 커뮤니티·SNS·플랫폼 → 기타 (직접 서비스 없음)
- 음악 스트리밍(멜론·지니뮤직·유튜브뮤직·애플뮤직 등) → 쇼핑 (구독 서비스)
- OTT·영상 스트리밍(넷플릭스·왓챠·티빙·쿠팡플레이 등) → 쇼핑 (구독 서비스)
- 게임 구독·앱마켓(원스토어·구글플레이 등) → 쇼핑 (구독/앱 서비스)
- 렌트카(여행용) → 여행, 장기렌트·리스(소유 목적) → 자동차

[출력 JSON 구조 (예시)]
{
  "category": "전자기기",          // 위 카테고리 목록 중 가장 근접한 단일 값만 사용
  "details": {
     "location": "수원",            // 장소가 암시된 경우 (없으면 null)
     "keywords": ["조용한", "추천"] // 입력 텍스트 내 주요 속성 키워드 배열
  },
  "expectedPrice": null,           // 텍스트상 예상 가격/예산 언급 시 숫자 입력 (없으면 null)
  "confidenceScore": 95,           // 의도 파악 확신도 (0~100 정수)
  "actionType": "RECOMMENDATION"   // "PURCHASE", "INFORMATION", "RECOMMENDATION", "BOOKING", "UNKNOWN" 중 택 1
}
`;

  constructor(private readonly configService: ConfigService) { }

  // [대화개선 #6] DIALOG_PROMPT 전면 개편 — 3회 제한, 유연한 ready 판단, 자연스러운 말투
  private readonly DIALOG_PROMPT = `
당신은 인텐덱스(Intendex) 플랫폼의 Intent 수집 도우미입니다.
사용자의 구매/탐색 의도를 광고주가 타겟팅할 수 있을 만큼 구체화하는 것이 목표입니다.

[대화 원칙]
1. 대화는 최대 3회로 끝내세요. 길어지면 사용자가 이탈합니다.
2. 한 번에 최대 2가지만 묻되, 한 문장으로 자연스럽게 합치세요.
   좋은 예: "어떤 차종이세요? 월 예산도 대략 알려주시면 딱 맞게 찾아드릴게요!"
   나쁜 예: "차종이 무엇인가요? 그리고 예산은 어떻게 되시나요? 추가 요구사항도 있으신가요?"
3. 이미 언급된 정보는 절대 다시 묻지 마세요.
4. 사용자가 질문 순서나 내용을 지적하면 즉시 수용하고 해당 정보를 먼저 물어보세요.
5. 딱딱한 존댓말 대신 친근하지만 예의 바른 말투를 사용하세요.
6. 사용자의 메시지가 구매, 서비스 이용, 예약, 비교, 추천 등 상업적 의도가 아닌 경우 정중하게 안내하세요. [필터링 #1]
   등록 불가 예시:
   - 날씨, 시간 등 단순 정보 질문: '내일 날씨 알려줘', '지금 몇 시야'
   - 상식, 역사, 과학 등 지식 질문: '세종대왕이 누구야', '지구 둘레가 얼마야'
   - 일상 대화, 감정 표현: '심심해', '안녕하세요', '재미있는 얘기 해줘'
   - 불법/부적절한 요청
   ※ 애매한 경우 바로 reject하지 말고 question으로 한 번 더 확인하세요. '우산 사고 싶어' 같은 상업적 의도는 reject 금지. [필터링 #2]
   이런 경우 reject 응답을 반환하세요.

[수집 목표 — 광고주 타겟팅 기준]
아래 3가지 중 최소 2가지가 "구체적"으로 수집되면 ready입니다:
A. 제품/서비스 — 브랜드명, 모델명, 또는 구체적 종류 (예: "나이키 러닝화", "싼타페 보험", "강남 토익학원")
   → "운동화", "보험", "학원"만으로는 부족. 반드시 구체화 질문.
   → "나이키 운동화", "자동차 보험 SUV 투싼", "강남 토익학원"이면 충분.
B. 가격대/예산 — 숫자 또는 범위 (예: "10만원대", "월 5만원", "50만원 이하")
C. 구체적 조건 — 용도, 지역, 스펙, 시기 등 (예: "출퇴근용", "이번 주말", "서울 강남")

[ready 전환 판단]
- A+B, A+C, 또는 A+B+C가 모이면 즉시 ready. 추가 질문하지 마세요.
- A만 있어도 충분히 구체적이면 (예: "갤럭시 S25 울트라 256GB") 바로 ready.
- 3회 대화가 됐으면 부족해도 있는 정보로 ready.

[질문 우선순위]
1순위: 제품/서비스 구체화 (가장 중요 — 광고주 매칭의 핵심)
2순위: 가격대 (있으면 좋지만 필수는 아님)
3순위: 추가 조건 (있으면 좋지만 필수는 아님)
→ 1순위가 이미 구체적이면 2순위를 묻고, 2순위도 있으면 바로 ready.

[enrichedText 작성 규칙]
- 사용자가 말한 브랜드명, 모델명, 가격, 조건을 반드시 원문 그대로 포함
- 광고주가 읽고 바로 타겟팅 판단할 수 있는 한 문단으로 작성
- 없는 정보를 지어내지 마세요

[응답 형식] 반드시 아래 JSON 중 하나만 출력. JSON 외 텍스트 금지. [필터링 #3]
정보 부족: {"type":"question","message":"질문 (1~2문장, 자연스럽게)"}
충분한 정보: {"type":"ready","message":"감사 메시지 (1문장)","enrichedText":"수집된 정보 기반 상세 의도 설명 (광고주 타겟팅용, 한 문단)"}
상업적 의도 아닌 경우: {"type":"reject","message":"안내 메시지 (친근하게, 어떤 것을 등록할 수 있는지 예시 포함)"}
`;

  /**
   * 대화형 Intent 수집: 대화 이력을 받아 다음 질문 또는 완료 응답 반환
   */
  // [추천강화 #3] advertiserContext 파라미터 추가 — 관련 광고주 키워드를 프롬프트에 주입
  async conductIntentDialog(
    messages: { role: string; content: string }[],
    advertiserContext?: string,
  ): Promise<{
    type: 'question' | 'ready' | 'reject';
    message: string;
    enrichedText?: string;
  }> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) throw new InternalServerErrorException('GEMINI_API_KEY is not configured.');

    const conversationText = messages
      .map((m) => `${m.role === 'user' ? '사용자' : 'AI 도우미'}: ${m.content}`)
      .join('\n');

    // [대화개선 #2] user 메시지 4개 이상이면 강제 ready 지시 삽입
    const userMessageCount = messages.filter((m) => m.role === 'user').length;
    const forceReady = userMessageCount >= 4;
    const systemInstruction = forceReady
      ? '[시스템 지시] 이번이 마지막 대화입니다. 현재까지 수집된 정보로 반드시 ready 응답을 생성하세요. 추가 질문 금지.\n\n'
      : '';

    // [추천강화 #3] 광고주 컨텍스트 블록 — 있을 때만 삽입
    const contextBlock = advertiserContext
      ? `\n[참고 — 현재 등록된 관련 파트너]\n${advertiserContext}\n위 파트너 정보를 참고하여, 사용자가 구체적 상품을 모를 때 자연스럽게 방향을 제안해주세요. 단, 업체명을 직접 언급하지 마세요. 키워드와 카테고리만 참고해서 "~를 많이 찾으시는데요" "~가 인기인데요" 식으로 자연스럽게 녹여주세요.\n`
      : '';

    const payload = `${systemInstruction}${this.DIALOG_PROMPT}${contextBlock}\n\n[대화 이력]\n${conversationText}\n\nAI 도우미:`;

    const ai = new GoogleGenAI({ apiKey });
    let responseText = '';

    try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: payload,
      });
      responseText = (result.text ?? '').replace(/```json/g, '').replace(/```/g, '').trim();
      this.logger.debug(`Dialog Response: ${responseText}`);
    } catch (error) {
      this.logger.error('Dialog AI call failed', error);
      throw new InternalServerErrorException('AI 대화 처리 중 오류가 발생했습니다.');
    }

    // [대화개선 #4] JSON 파싱 실패 시 raw 텍스트를 question으로 반환 (500 방지)
    let parsed: { type: 'question' | 'ready' | 'reject'; message: string; enrichedText?: string };
    try {
      parsed = JSON.parse(responseText);
    } catch {
      this.logger.warn(`Dialog JSON parse failed, using raw response: ${responseText}`);
      return { type: 'question', message: responseText || '조금 더 자세히 말씀해 주시겠어요?' };
    }

    // [필터링 #4] 강제 ready 상황에서도 reject는 그대로 통과 — 비상업적 대화는 강제 등록하지 않음
    if (parsed.type === 'reject') {
      return parsed;
    }

    // [필터링 #5] 4회째 강제 ready 시 현재까지 대화에 상업적 의도가 없으면 reject 반환
    if (forceReady && parsed.type === 'question') {
      const allUserMessages = messages.filter((m) => m.role === 'user').map((m) => m.content).join(' ');
      const hasCommercialKeyword = /구매|사고|싶어|추천|비교|예약|찾고|알아보|주문|신청|등록|견적|상담|이용|서비스/.test(allUserMessages);
      if (!hasCommercialKeyword) {
        this.logger.warn(`[필터링 #5] No commercial intent detected after ${userMessageCount} turns — returning reject`);
        return {
          type: 'reject',
          message: '아쉽지만 상업적 의도가 없는 대화는 등록이 어려워요. 쇼핑, 여행, 교육 같은 서비스 이용 의도를 말씀해 주시면 도와드릴게요!',
        };
      }
    }

    // [대화개선 #2] 강제 ready 상황인데 Gemini가 question을 반환한 경우 코드에서 강제 전환
    if (forceReady && parsed.type === 'question') {
      this.logger.warn(`[Dialog] Force-converting question to ready after ${userMessageCount} user turns`);
      const enrichedText = await this.summarizeDialogToEnrichedText(conversationText, apiKey);
      return {
        type: 'ready',
        message: '충분한 정보가 수집되었습니다. 지금 바로 의도를 상장해 드릴게요!',
        enrichedText,
      };
    }

    return parsed;
  }

  /**
   * [대화개선 #2] 전체 대화 내용을 요약하여 enrichedText 생성 (강제 ready 시 사용)
   */
  // [가격필수 #1] 강제 ready 요약 시에도 가격대 미수집이면 명시적으로 표기
  private async summarizeDialogToEnrichedText(conversationText: string, apiKey: string): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `아래 대화에서 사용자의 구매/탐색 의도를 광고주 친화적인 한 문단으로 요약하세요.
사용자가 언급한 브랜드명, 모델명, 가격, 요구사항을 원문 그대로 포함하세요.
가격대/예산이 대화에서 언급되지 않은 경우 "가격대 미확인"이라고 명시하세요.
JSON이나 마크다운 없이 텍스트만 출력하세요.

[대화 내용]
${conversationText}`;
      const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      return (result.text ?? '').trim();
    } catch {
      return conversationText;
    }
  }

  /**
   * 사용자 텍스트를 Gemini AI로 분석하여 파싱된 JSON 형태의 Intent 객체 반환
   */
  async parseUserTextToIntent(rawText: string): Promise<any> {
    this.logger.log(`Parsing raw text with Gemini: "${rawText}"`);

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY is not configured.');
    }

    try {
      // 사용할 모델 선택 (추론에 특화된 gemini-1.5-pro 또는 구조화에 유용한 gemini-1.5-flash)
      const ai = new GoogleGenAI({ apiKey });

      const payload = `${this.MASTER_PROMPT}\n\n[입력 텍스트]\n"${rawText}"`;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: payload,
      });
      const responseText = result.text ?? '';

      this.logger.debug(`Gemini Raw Response: ${responseText}`);

      let parsedJson;
      try {
        // 마크다운 제거 + Gemini 오염 패턴 수정 (""key" → "key)
        const cleanedText = responseText
          .replace(/```json/g, '').replace(/```/g, '')
          .replace(/""/g, '"')   // ""keywords" → "keywords"
          .trim();
        parsedJson = JSON.parse(cleanedText);
      } catch (parseError) {
        this.logger.error('Failed to parse Gemini response into JSON', parseError);
        this.logger.error(`Faulty response: ${responseText}`);
        throw new InternalServerErrorException('AI returned malformed data.');
      }

      return parsedJson;

    } catch (error) {
      this.logger.error('Gemini API call failed', error);
      throw new InternalServerErrorException('Failed to process intent via AI');
    }
  }

  /**
   * 사용자 의도와 광고주 목록을 한 번의 Gemini 호출로 일괄 스코어링
   * - 0~100점 반환, 70점 이상 = 매칭 추천
   */
  async rankAdvertisersForIntent(
    intentText: string,
    advertisers: Array<{
      id: string;
      company: string;
      category: string;
      keywords: string[];
      siteDescription: string | null;
    }>,
  ): Promise<Array<{ advertiserId: string; score: number; reason: string }>> {
    if (advertisers.length === 0) return [];

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) throw new InternalServerErrorException('GEMINI_API_KEY is not configured.');

    const advertiserList = advertisers
      .map((a, i) => {
        // [속도개선 #1] siteDescription 500 → 120자로 축소 (토큰 절감)
        const safeSiteDescription = (a.siteDescription ?? '없음')
          .replace(/[<>{}[\]`]/g, '')
          .slice(0, 120);
        return `${i + 1}. ID: ${a.id} | 회사: ${a.company} | 카테고리: ${a.category} | 키워드: ${a.keywords.join(', ')} | 설명: ${safeSiteDescription}`;
      })
      .join('\n');

    const prompt = `당신은 광고 매칭 전문가입니다. 사용자 구매 의도와 광고주의 적합도를 평가하세요.

[사용자 의도]
"${intentText}"

[광고주 목록]
${advertiserList}

[평가 기준]
- 사용자 의도와 광고주 카테고리/키워드/비즈니스 설명의 일치도
- 사용자가 해당 광고주 서비스/상품에 실제 관심을 가질 가능성
- 구매 단계(탐색/비교/구매)와 광고주 타겟의 일치 여부
- [채용매칭 #5] 뉴스/언론/포털 사이트(네이버, 다음, 구글 등)는 정보 제공 목적이므로, 사용자가 직접적인 서비스(구매, 채용, 쇼핑, 예약, 배달 등)를 원하는 경우 해당 서비스를 직접 제공하는 광고주를 우선하세요. 포털/검색 사이트는 구매 의도가 명확한 경우 반드시 60점 미만으로 평가하세요.
- [직접판매 우선] 사용자가 특정 상품(사료, 분유, 의류, 전자기기 등)을 구매/추천 요청할 경우, 해당 상품을 직접 판매하는 쇼핑몰/전문몰을 포털·커뮤니티보다 최우선으로 높게 평가하세요.
- 0~100점 (70점 이상 = 매칭 추천)

반드시 아래 형식의 순수 JSON 배열만 출력. 마크다운 금지.
[{"advertiserId":"id값","score":85,"reason":"매칭 이유 한 문장"}]`;

    // [속도개선 #2] 빠른 모델 우선 시도, 404 시 다음 모델로 자동 폴백
    const SCORING_MODELS = ['gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-2.5-flash'];
    // [속도개선 #4] 재시도 딜레이 1500ms → 500ms, 최대 3회 → 2회
    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 500;

    for (const model of SCORING_MODELS) {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const t0 = Date.now();
        try {
          const ai = new GoogleGenAI({ apiKey });
          const result = await ai.models.generateContent({ model, contents: prompt });
          const cleaned = (result.text ?? '').replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          this.logger.log(`[PERF] Scoring done — model: ${model}, advertisers: ${parsed.length}, elapsed: ${Date.now() - t0}ms`);
          return parsed;
        } catch (err) {
          if (err?.status === 404) {
            this.logger.warn(`[Matching] Model ${model} not available, trying next...`);
            break; // 다음 모델로
          }
          const isRetryable = err?.status === 500 || err?.status === 503 || err?.status === 429;
          if (isRetryable && attempt < MAX_RETRIES) {
            this.logger.warn(`[Matching] ${model} error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS * attempt}ms...`);
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
            continue;
          }
          this.logger.error(`Advertiser ranking failed (model: ${model})`, err);
          break; // 재시도 소진 → 다음 모델로
        }
      }
    }
    return [];
  }

  /**
   * 광고주 웹사이트 URL을 분석하여 카테고리, 키워드, 설명 등을 추출
   */
  async analyzeAdvertiserWebsite(url: string): Promise<{
    category: string;
    description: string;
    keywords: string[];
    suggestedCompany: string | null;
  }> {
    this.logger.log(`Analyzing advertiser website: ${url}`);
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) throw new InternalServerErrorException('GEMINI_API_KEY is not configured.');

    // 웹사이트 HTML 가져오기
    let siteText = '';
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IntendexBot/1.0)' },
        maxContentLength: 500000,
      });
      siteText = (response.data as string)
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 3000);
    } catch (err) {
      this.logger.warn(`Failed to fetch website ${url}: ${err.message}`);
      // fetch 실패해도 URL 자체로 분석 시도
      siteText = `URL: ${url}`;
    }

    // [카테고리개선 #1] 분류 가이드 동기화 — MASTER_PROMPT와 동일한 기준 적용
    const prompt = `
당신은 광고주 웹사이트를 분석하여 광고 타겟팅에 필요한 정보를 추출하는 전문가입니다.
아래 웹사이트 내용을 분석하여 반드시 순수 JSON만 출력하세요. 마크다운 블록 금지.

[분석 대상 웹사이트]
URL: ${url}
내용: ${siteText}

[카테고리 목록 및 분류 가이드] 반드시 아래 15개 중 하나만 사용하세요. "기타"는 아래 14개에 진짜 해당하지 않을 때만 사용하세요.
- 전자기기: 핸드폰, 노트북, 태블릿, 가전제품, IT기기, 소프트웨어(개발도구·업무용)
- 패션: 의류, 신발, 가방, 액세서리, 시계, 스포츠웨어, 아웃도어 의류
- 식품: 음식, 배달음식, 식료품, 간식, 건강식품, 홍삼, 비타민, 영양제
- 여행: 항공권, 호텔, 숙박, 렌트카(여행용), 관광, 펜션, 여행패키지
- 부동산: 아파트, 전세, 월세, 매매, 이사, 인테리어, 분양
- 금융: 대출, 신용카드, 적금, 투자, 주식, 증권, 펀드, 재테크
- 보험: 자동차보험, 암보험, 실비보험, 생명보험, 건강보험
- 자동차: 신차, 중고차, 전기차, 자동차 구매, 장기렌트, 리스
- 뷰티: 화장품, 스킨케어, 메이크업, 헤어케어, 네일, 향수
- 교육: 학원, 온라인강의, 자격증, 취업준비, 채용, 이직, 커리어
- 의료: 병원, 치과, 한의원, 건강검진, 약국, 의약품, 재활
- 법률: 변호사, 법무사, 세무사, 소송, 법률상담, 특허
- 쇼핑: 온라인쇼핑몰, 최저가 비교, 오픈마켓, 해외직구, 할인, 음악/영상/게임 구독 서비스(멜론·넷플릭스 등), 앱스토어
- 비영리: 기부, 봉사활동, NGO, 종교, 환경, 공익 캠페인
- 기타: 뉴스/언론, 커뮤니티/SNS처럼 위 14개에 해당하지 않는 경우만

[출력 JSON 구조]
{
  "category": "위 카테고리 목록 중 하나",
  "description": "이 광고주가 어떤 사용자 의도를 타겟팅하기에 적합한지 2~3문장 설명",
  "keywords": ["타겟팅에 적합한 키워드 3~5개 배열"],
  "suggestedCompany": "웹사이트에서 파악되는 회사명 (파악 불가시 null)"
}
`;

    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    const cleaned = (result.text ?? '').replace(/```json/g, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      this.logger.error(`Failed to parse website analysis: ${cleaned}`);
      return { category: '기타', description: '분석 실패', keywords: [], suggestedCompany: null };
    }
  }
}
