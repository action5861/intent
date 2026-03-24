/**
 * Intendex E2E 통합 테스트
 *
 * 실행: pnpm test:e2e-flow  (apps/api/)
 *        pnpm --filter api test:e2e-flow  (루트)
 *
 * 테스트 순서:
 *   SETUP  — 테스트 전용 사용자 생성 + 어드민 로그인
 *   STEP 1 — 광고주 등록 (POST /api/admin/advertisers)
 *   STEP 2 — 의도 채팅 → 상장 (POST /api/intents/chat → POST /api/intents)
 *   STEP 3 — AI 자동 매칭 대기 (폴링, 최대 60초)
 *   STEP 4 — SLA 검증 + 이중 정산 방지 (POST /api/sla/verify)
 *   STEP 5 — 사용자 rewardBalance 확인 (GET /api/auth/me + /rewards)
 *   STEP 6 — 광고주 remainingBudget 차감 확인
 *   TEARDOWN — 생성한 광고주 / 사용자 자동 삭제
 */

import axios, { AxiosInstance } from 'axios';

// ── 설정 ──────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.API_URL ?? 'http://localhost:4000';
const UNIQUE   = Date.now();

const TEST_USER_EMAIL = `e2e_${UNIQUE}@intendex-test.dev`;
const TEST_ADV_EMAIL  = `e2e_adv_${UNIQUE}@intendex-test.dev`;

// 정리 추적
const cleanup: { userId: string; advertiserId: string; intentIds: string[] } = {
  userId:       '',
  advertiserId: '',
  intentIds:    [],
};

// axios 인스턴스 — charset=utf-8 명시로 한글 깨짐 원천 차단
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  validateStatus: () => true,   // 모든 HTTP 상태를 throw 없이 반환
  timeout: 30_000,
});

// ── 유틸리티 ──────────────────────────────────────────────────────────────────

function pass(step: string, msg: string): void {
  console.log(`  ✅ [${step}] ${msg}`);
}

function fail(step: string, msg: string, data?: unknown): never {
  console.error(`  ❌ [${step}] ${msg}`);
  if (data !== undefined) {
    console.error('     Response:', JSON.stringify(data, null, 2));
  }
  throw new Error(`[${step}] ${msg}`);
}

function assertStatus(step: string, actual: number, ...expected: number[]): void {
  if (!expected.includes(actual)) {
    fail(step, `HTTP ${actual} (expected ${expected.join(' or ')})`);
  }
}

// ── SETUP ─────────────────────────────────────────────────────────────────────

async function setup(): Promise<{ userToken: string; adminToken: string }> {
  console.log('\n── SETUP ──────────────────────────────────────────────');

  const regRes = await api.post('/api/auth/register', {
    name:     'E2E테스터',
    email:    TEST_USER_EMAIL,
    password: 'test1234!',
  });
  assertStatus('setup/register', regRes.status, 200, 201);
  cleanup.userId = regRes.data.userId as string;
  pass('setup', `사용자 생성: ${TEST_USER_EMAIL} (${cleanup.userId})`);

  const adminRes = await api.post('/api/admin/auth/login', {
    username: 'admin',
    password: 'admin1234!',
  });
  assertStatus('setup/admin-login', adminRes.status, 200, 201);
  pass('setup', '어드민 토큰 확보');

  return {
    userToken:  regRes.data.accessToken  as string,
    adminToken: adminRes.data.accessToken as string,
  };
}

// ── STEP 1: 광고주 등록 ───────────────────────────────────────────────────────

async function step1RegisterAdvertiser(adminToken: string): Promise<string> {
  console.log('\n── STEP 1: 광고주 등록 ─────────────────────────────────');

  const res = await api.post(
    '/api/admin/advertisers',
    {
      company:         'E2E전자쇼핑몰',
      contactName:     '테스트담당자',
      email:           TEST_ADV_EMAIL,
      password:        'adv1234!',
      category:        '전자기기',
      keywords:        ['노트북', '삼성', '갤럭시', '스마트폰', '전자기기'],
      siteDescription: '삼성전자 공식 쇼핑몰 — 노트북, 갤럭시, 스마트폰 최신 전자기기 구매',
      siteUrl:         'https://www.samsung.com/sec/',
      rewardPerVisit:  800,
      totalBudget:     100_000,
    },
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  assertStatus('step1', res.status, 200, 201);

  cleanup.advertiserId = res.data.id as string;

  // 인코딩 검증: category 길이가 4자(전자기기)여야 함
  const cat: string = res.data.category;
  if ([...cat].length !== 4) {
    fail('step1', `category 인코딩 이상 — 예상 4자(전자기기), 실제 ${[...cat].length}자: "${cat}"`);
  }

  pass('step1', `광고주 등록: ${res.data.id}`);
  pass('step1', `  category="${cat}" | budget=${res.data.totalBudget}P | rewardPerVisit=${res.data.rewardPerVisit}P | status=${res.data.status}`);

  return res.data.id as string;
}

// ── STEP 2: 의도 채팅 → 상장 ─────────────────────────────────────────────────

async function step2SubmitIntent(userToken: string): Promise<string> {
  console.log('\n── STEP 2: 의도 채팅 → 상장 ───────────────────────────');

  const authHeader = { Authorization: `Bearer ${userToken}` };

  // 채팅 1차
  const chat1 = await api.post(
    '/api/intents/chat',
    { messages: [{ role: 'user', content: '삼성 갤럭시 노트북 사고 싶어요' }] },
    { headers: authHeader },
  );
  assertStatus('step2/chat1', chat1.status, 200, 201);
  pass('step2', `채팅 1차 완료 — type=${chat1.data.type}`);

  // 채팅 2차
  const chat2 = await api.post(
    '/api/intents/chat',
    {
      messages: [
        { role: 'user',      content: '삼성 갤럭시 노트북 사고 싶어요' },
        { role: 'assistant', content: chat1.data.message as string },
        { role: 'user',      content: '업무용으로 예산은 150만원이고 빠른 배송 원해요' },
      ],
    },
    { headers: authHeader },
  );
  assertStatus('step2/chat2', chat2.status, 200, 201);
  pass('step2', `채팅 2차 완료 — type=${chat2.data.type}`);

  // 채팅 3차 (AI가 3회 이상 진행 시 ready 전환 — 보장용)
  let enrichedText: string =
    chat2.data.type === 'ready' ? (chat2.data.enrichedText as string) : '';

  if (!enrichedText) {
    const chat3 = await api.post(
      '/api/intents/chat',
      {
        messages: [
          { role: 'user',      content: '삼성 갤럭시 노트북 사고 싶어요' },
          { role: 'assistant', content: chat1.data.message as string },
          { role: 'user',      content: '업무용으로 예산은 150만원이고 빠른 배송 원해요' },
          { role: 'assistant', content: chat2.data.message as string },
          { role: 'user',      content: '특별한 조건은 없고 빨리 구매하고 싶어요' },
        ],
      },
      { headers: authHeader },
    );
    assertStatus('step2/chat3', chat3.status, 200, 201);
    pass('step2', `채팅 3차 완료 — type=${chat3.data.type}`);
    enrichedText =
      chat3.data.type === 'ready'
        ? (chat3.data.enrichedText as string)
        : '업무용 삼성 전자기기 노트북 구매, 예산 150만원, 빠른 배송, 전자기기 가격 비교';
  }

  // 의도 상장
  const intentRes = await api.post(
    '/api/intents',
    { rawText: '삼성 갤럭시 노트북 사고 싶어요', enrichedText },
    { headers: authHeader },
  );
  assertStatus('step2/submit', intentRes.status, 200, 201, 202);

  const intentId = intentRes.data.intentId as string;
  cleanup.intentIds.push(intentId);

  pass('step2', `의도 상장 완료 — intentId=${intentId}`);
  pass('step2', `  category=${intentRes.data.parsedData?.category} | expectedPrice=${intentRes.data.parsedData?.expectedPrice}`);

  return intentId;
}

// ── STEP 3: AI 매칭 폴링 ──────────────────────────────────────────────────────

async function step3WaitForMatch(userToken: string, intentId: string): Promise<void> {
  console.log('\n── STEP 3: AI 매칭 대기 ────────────────────────────────');

  const MAX_MS      = 60_000;
  const INTERVAL_MS =    500;
  const started     = Date.now();

  process.stdout.write('  ');

  while (Date.now() - started < MAX_MS) {
    await new Promise<void>((r) => setTimeout(r, INTERVAL_MS));

    const res = await api.get<unknown[]>('/api/intents', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    if (res.status !== 200) continue;

    const intent = res.data.find((i: any) => i.id === intentId) as any;
    if (!intent) continue;

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    process.stdout.write(`\r  ⏳ ${elapsed}s — status: ${intent.status}             `);

    if (intent.status === 'MATCHED') {
      console.log();
      pass('step3', `AI 매칭 완료 (${elapsed}초 소요)`);
      pass('step3', `  matchedCompany=${intent.matchedAdvertiserCompany} | rewardPerVisit=${intent.rewardPerVisit}P`);
      return;
    }
  }

  console.log();
  fail(
    'step3',
    `${MAX_MS / 1000}초 내 MATCHED 상태 미달성\n` +
    '     원인 가능성: ① Gemini 스코어 < 70 ② 카테고리 불일치 ③ API 타임아웃\n' +
    '     조치: POST /api/admin/intents/rematch-waiting 수동 트리거 후 재시도',
  );
}

// ── STEP 4: SLA 검증 + 이중 정산 방지 ───────────────────────────────────────

async function step4SlaVerify(userToken: string, intentId: string): Promise<{ rewardAmount: number; matchedAdvId: string; slaRemainingBudget: number }> {
  console.log('\n── STEP 4: SLA 검증 ────────────────────────────────────');

  const now = Date.now();
  const slaRes = await api.post(
    '/api/sla/verify',
    {
      transactionId:    intentId,
      accumulatedTimeMs: 20_000,
      timestamp:        now,
      clickTimestamp:   now - 25_000,   // 25초 전 클릭 시뮬레이션
      recaptchaToken:   'dev-token-bypass',
    },
    { headers: { Authorization: `Bearer ${userToken}` } },
  );
  assertStatus('step4/sla', slaRes.status, 200, 201);

  const { rewardAmount, remainingBudget, status, advertiserId: matchedAdvId } = slaRes.data.data as {
    rewardAmount: number;
    remainingBudget: number;
    status: string;
    advertiserId: string;
  };

  if (status !== 'SLA_VERIFIED') {
    fail('step4', `intent status 이상 — 예상 SLA_VERIFIED, 실제 ${status}`);
  }

  pass('step4', `SLA 검증 완료 — status=${status}`);
  pass('step4', `  rewardAmount=${rewardAmount}P | matchedAdvertiserId=${matchedAdvId} | advertiserRemainingBudget=${remainingBudget}P`);

  // 이중 정산 방지 검증
  const dupRes = await api.post(
    '/api/sla/verify',
    {
      transactionId:    intentId,
      accumulatedTimeMs: 20_000,
      timestamp:        Date.now(),
      clickTimestamp:   Date.now() - 25_000,
      recaptchaToken:   'dev-token-bypass',
    },
    { headers: { Authorization: `Bearer ${userToken}` } },
  );
  if (dupRes.status !== 409) {
    fail('step4', `이중 정산 방지 실패 — 예상 HTTP 409, 실제 ${dupRes.status}`);
  }
  pass('step4', '이중 정산 방지 확인 (HTTP 409 Conflict)');

  return { rewardAmount, matchedAdvId, slaRemainingBudget: remainingBudget };
}

// ── STEP 5: 사용자 rewardBalance 확인 ────────────────────────────────────────

async function step5VerifyReward(userToken: string, expectedReward: number): Promise<void> {
  console.log('\n── STEP 5: 사용자 rewardBalance 확인 ──────────────────');

  const authHeader = { Authorization: `Bearer ${userToken}` };

  // GET /auth/me
  const meRes = await api.get('/api/auth/me', { headers: authHeader });
  assertStatus('step5/me', meRes.status, 200);

  const { rewardBalance } = meRes.data as { rewardBalance: number };
  if (rewardBalance !== expectedReward) {
    fail('step5', `rewardBalance 불일치 — 예상 ${expectedReward}P, 실제 ${rewardBalance}P`);
  }
  pass('step5', `GET /auth/me — rewardBalance=${rewardBalance}P ✓`);

  // GET /auth/rewards (paidReward 컬럼 검증)
  const rewardsRes = await api.get('/api/auth/rewards', { headers: authHeader });
  assertStatus('step5/rewards', rewardsRes.status, 200);

  const history = rewardsRes.data.history as Array<{ intentId: string; rewardAmount: number; advertiserCompany: string }>;
  if (history.length === 0) {
    fail('step5', '리워드 내역 없음 — SLA 정산이 history에 반영되지 않음');
  }

  const lastIntentId = cleanup.intentIds[cleanup.intentIds.length - 1];
  const record = history.find((h) => h.intentId === lastIntentId);
  if (!record) {
    fail('step5', `intentId ${lastIntentId} 에 대한 리워드 내역 없음`);
  }
  if (record!.rewardAmount !== expectedReward) {
    fail('step5', `내역 금액 불일치 — 예상 ${expectedReward}P, 실제 ${record!.rewardAmount}P (paidReward 컬럼 확인 필요)`);
  }
  pass('step5', `GET /auth/rewards — rewardAmount=${record!.rewardAmount}P ✓ (paidReward 컬럼 정상)`);
  pass('step5', `  totalEarned=${rewardsRes.data.totalEarned}P | history 건수=${history.length}`);
}

// ── STEP 6: 광고주 예산 차감 확인 ────────────────────────────────────────────

async function step6VerifyBudget(
  adminToken:          string,
  matchedAdvId:        string,
  slaRemainingBudget:  number,
  rewardAmount:        number,
): Promise<void> {
  console.log('\n── STEP 6: 광고주 remainingBudget 확인 ────────────────');

  const res = await api.get('/api/admin/advertisers', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assertStatus('step6', res.status, 200);

  const adv = (res.data as Array<{
    id: string;
    totalBudget: number;
    remainingBudget: number;
    matchCount: number;
  }>).find((a) => a.id === matchedAdvId);

  if (!adv) {
    fail('step6', `매칭된 광고주 ${matchedAdvId} 를 목록에서 찾을 수 없음`);
  }

  // SLA 응답의 remainingBudget과 DB 실제 값 일치 검증
  if (adv!.remainingBudget !== slaRemainingBudget) {
    fail(
      'step6',
      `DB remainingBudget 불일치 — SLA 응답 ${slaRemainingBudget}P vs DB ${adv!.remainingBudget}P`,
    );
  }

  // 예산이 실제로 차감됐는지 검증 (totalBudget - remainingBudget >= rewardAmount)
  const totalSpent = adv!.totalBudget - adv!.remainingBudget;
  if (totalSpent < rewardAmount) {
    fail('step6', `예산 미차감 — totalSpent=${totalSpent}P, rewardAmount=${rewardAmount}P`);
  }

  pass('step6', `광고주 ${matchedAdvId}`);
  pass('step6', `  totalBudget=${adv!.totalBudget}P | remainingBudget=${adv!.remainingBudget}P | totalSpent=${totalSpent}P`);
  pass('step6', `  이번 정산 차감 ${rewardAmount}P ✓ | DB ↔ SLA 응답 일치 ✓ | matchCount=${adv!.matchCount}`);
}

// ── TEARDOWN ──────────────────────────────────────────────────────────────────

async function teardown(adminToken: string): Promise<void> {
  console.log('\n── TEARDOWN ────────────────────────────────────────────');

  if (!adminToken) {
    console.warn('  ⚠ 어드민 토큰 없음 — 수동 정리 필요');
    console.warn(`     userId:       ${cleanup.userId || '없음'}`);
    console.warn(`     advertiserId: ${cleanup.advertiserId || '없음'}`);
    return;
  }

  // 광고주 삭제
  if (cleanup.advertiserId) {
    const res = await api.delete(`/api/admin/advertisers/${cleanup.advertiserId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.status === 200 || res.status === 204) {
      console.log(`  🗑  광고주 삭제 완료: ${cleanup.advertiserId}`);
    } else {
      console.warn(`  ⚠  광고주 삭제 실패 (HTTP ${res.status}) — 수동 삭제 필요: ${cleanup.advertiserId}`);
    }
  }

  // 사용자 삭제 (연관 intent는 orphan으로 남음 — dev DB이므로 무방)
  if (cleanup.userId) {
    const res = await api.delete(`/api/admin/users/${cleanup.userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.status === 200 || res.status === 204) {
      console.log(`  🗑  사용자 삭제 완료: ${cleanup.userId}`);
    } else {
      console.warn(`  ⚠  사용자 삭제 실패 (HTTP ${res.status}) — 수동 삭제 필요: ${cleanup.userId}`);
    }
  }

  if (cleanup.intentIds.length > 0) {
    console.log(`  ℹ  Intent ${cleanup.intentIds.length}건은 DB에 orphan으로 잔류 (dev 환경 무방)`);
  }

  console.log('  정리 완료');
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       Intendex E2E 통합 테스트                       ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  대상 서버: ${BASE_URL}`);
  console.log(`  실행 시각: ${new Date().toISOString()}`);

  let adminToken = '';

  try {
    const { userToken, adminToken: at } = await setup();
    adminToken = at;

    await step1RegisterAdvertiser(adminToken);
    const intentId                     = await step2SubmitIntent(userToken);
    await step3WaitForMatch(userToken, intentId);
    const { rewardAmount, matchedAdvId, slaRemainingBudget } = await step4SlaVerify(userToken, intentId);
    await step5VerifyReward(userToken, rewardAmount);
    await step6VerifyBudget(adminToken, matchedAdvId, slaRemainingBudget, rewardAmount);

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║  ✅  전체 E2E 테스트 PASS                            ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    process.exitCode = 0;

  } catch (err: unknown) {
    console.error('\n╔══════════════════════════════════════════════════════╗');
    console.error('║  ❌  E2E 테스트 FAIL                                 ║');
    console.error('╚══════════════════════════════════════════════════════╝');
    console.error('  원인:', err instanceof Error ? err.message : String(err));
    console.error();
    process.exitCode = 1;

  } finally {
    await teardown(adminToken);
  }
}

main();
