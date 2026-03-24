import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CATEGORIES_STRING } from '../common/categories.constants';

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

[카테고리 목록] 반드시 아래 목록 중 하나만 사용하세요. 목록에 없는 값은 절대 사용 금지.
${CATEGORIES_STRING}

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

[응답 형식] 반드시 아래 JSON 중 하나만 출력. JSON 외 텍스트 금지.
정보 부족: {"type":"question","message":"질문 (1~2문장, 자연스럽게)"}
충분한 정보: {"type":"ready","message":"감사 메시지 (1문장)","enrichedText":"수집된 정보 기반 상세 의도 설명 (광고주 타겟팅용, 한 문단)"}
`;

  /**
   * 대화형 Intent 수집: 대화 이력을 받아 다음 질문 또는 완료 응답 반환
   */
  // [추천강화 #3] advertiserContext 파라미터 추가 — 관련 광고주 키워드를 프롬프트에 주입
  async conductIntentDialog(
    messages: { role: string; content: string }[],
    advertiserContext?: string,
  ): Promise<{
    type: 'question' | 'ready';
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
    let parsed: { type: 'question' | 'ready'; message: string; enrichedText?: string };
    try {
      parsed = JSON.parse(responseText);
    } catch {
      this.logger.warn(`Dialog JSON parse failed, using raw response: ${responseText}`);
      return { type: 'question', message: responseText || '조금 더 자세히 말씀해 주시겠어요?' };
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
        // 만약 LLM이 지시를 무시하고 마크다운을 붙였다면 최소한의 정제 처리 (안전망)
        const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
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
- 0~100점 (70점 이상 = 매칭 추천)

반드시 아래 형식의 순수 JSON 배열만 출력. 마크다운 금지.
[{"advertiserId":"id값","score":85,"reason":"매칭 이유 한 문장"}]`;

    try {
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      const cleaned = (result.text ?? '').replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      this.logger.debug(`[Matching] Scored ${parsed.length} advertisers for intent`);
      return parsed;
    } catch (err) {
      this.logger.error('Advertiser ranking failed', err);
      // [개선 #3] AI 실패 시 빈 배열 반환 → 호출부에서 매칭 중단 처리
      return [];
    }
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

    const prompt = `
당신은 광고주 웹사이트를 분석하여 광고 타겟팅에 필요한 정보를 추출하는 전문가입니다.
아래 웹사이트 내용을 분석하여 반드시 순수 JSON만 출력하세요. 마크다운 블록 금지.

[분석 대상 웹사이트]
URL: ${url}
내용: ${siteText}

[출력 JSON 구조]
{
  "category": "반드시 다음 목록 중 하나: ${CATEGORIES_STRING}",
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
