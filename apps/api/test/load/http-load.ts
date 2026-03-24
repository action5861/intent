/**
 * HTTP 엔드포인트 부하 테스트
 * - POST /api/auth/login       (bcrypt 병목 측정)
 * - GET  /api/auth/me          (JWT 검증 + DB read, 경량 기준선)
 * - POST /api/intents          (rate limit + DB write + AI 트리거)
 * - POST /api/sla/verify       (Prisma $transaction + Redis Pub/Sub)
 */

import autocannon from 'autocannon';
import { BASE_URL, PHASES } from './config';
import { printAutocannReport, printSection, TestUser, api } from './utils';

type PhaseResult = ReturnType<typeof printAutocannReport>;

// ── 헬퍼: autocannon Promise 래퍼 ─────────────────────────

function runAutocannon(opts: autocannon.Options): Promise<autocannon.Result> {
  return new Promise((resolve, reject) => {
    const inst = autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    autocannon.track(inst, { renderProgressBar: true, renderResultsTable: false });
  });
}

// ── 1. Login 부하 테스트 ──────────────────────────────────

export async function runLoginLoadTest(): Promise<PhaseResult[]> {
  printSection('1. POST /api/auth/login  —  bcrypt 병목 측정');

  const body = JSON.stringify({ email: 'admin@intendex.dev', password: 'wrong_password_for_401' });
  const results: PhaseResult[] = [];

  for (const phase of PHASES) {
    console.log(`\n  🔄 [${phase.label}] connections=${phase.connections}  duration=${phase.duration}s`);

    const result = await runAutocannon({
      url: `${BASE_URL}/api/auth/login`,
      connections: phase.connections,
      duration: phase.duration,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      // 비밀번호 오류로 401 예상 — non2xx 카운트되지만 서버 정상 응답
    });

    // 401=잘못된 비밀번호(의도), 429=rate limit — 모두 서버 정상 응답
    results.push(printAutocannReport(`login/${phase.label}`, result, true));
  }

  return results;
}

// ── 2. JWT 검증 경량 기준선 ───────────────────────────────

export async function runMeEndpointTest(users: TestUser[]): Promise<PhaseResult[]> {
  printSection('2. GET /api/auth/me  —  JWT 검증 + DB 읽기 (경량 기준선)');

  if (users.length === 0) {
    console.log('  ⚠  테스트 계정 없음 — 스킵');
    return [];
  }

  const results: PhaseResult[] = [];
  let idx = 0;

  for (const phase of PHASES) {
    console.log(`\n  🔄 [${phase.label}] connections=${phase.connections}  duration=${phase.duration}s`);

    const result = await runAutocannon({
      url: `${BASE_URL}/api/auth/me`,
      connections: phase.connections,
      duration: phase.duration,
      method: 'GET',
      setupClient: (client) => {
        const user = users[idx % users.length];
        idx++;
        client.setHeaders({ Authorization: `Bearer ${user.token}` });
      },
    });

    results.push(printAutocannReport(`GET /me/${phase.label}`, result, false));
  }

  return results;
}

// ── 3. Intent 제출 — Rate Limit + DB Write ────────────────

export async function runIntentSubmitTest(users: TestUser[]): Promise<void> {
  printSection('3. POST /api/intents  —  Rate Limit 한계 + DB write');

  if (users.length === 0) {
    console.log('  ⚠  테스트 계정 없음 — 스킵');
    return;
  }

  // 짧은 단일 페이즈: 목적은 rate limit 동작 확인 + 짧은 시간 DB write 부담 측정
  const phase = { label: '중간 부하', connections: 50, duration: 15 };
  console.log(`\n  🔄 [${phase.label}] connections=${phase.connections}  duration=${phase.duration}s`);
  console.log('  ℹ  각 사용자 24시간 2회 rate limit → 대부분 429/200 혼합 예상');

  let userIdx = 0;
  const intentBody = JSON.stringify({
    rawText: '최신 스마트폰 구매를 고려중입니다. 아이폰16 프로 맥스 256GB',
    enrichedText: '최신 스마트폰 구매 의도 — 아이폰16 Pro Max 256GB, 예산 180만원',
    category: '전자기기',
    expectedPrice: 1_800_000,
  });

  const result = await runAutocannon({
    url: `${BASE_URL}/api/intents`,
    connections: phase.connections,
    duration: phase.duration,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    setupClient: (client) => {
      const user = users[userIdx % users.length];
      userIdx++;
      client.setHeaders({ Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' });
    },
    body: intentBody,
    // 202=성공, 429=rate limit 정상 동작 — 둘 다 서버 정상 응답
  });

  printAutocannReport(`POST /intents/${phase.label}`, result, true);
  console.log('  ℹ  429 는 rate limit 정상 동작, 202 는 의도 상장 성공');
}

// ── 4. SLA verify — $transaction + Redis Pub/Sub ──────────

export async function runSlaVerifyTest(users: TestUser[], intentIds: string[]): Promise<void> {
  printSection('4. POST /api/sla/verify  —  Prisma $transaction + Redis Pub/Sub');

  if (users.length === 0 || intentIds.length === 0) {
    console.log('  ⚠  사전 매칭된 intent 없음 — 축소 테스트 (인증 오류 응답 측정)');

    // 빈 페이로드로 에러 경로 처리 성능 측정
    const result = await runAutocannon({
      url: `${BASE_URL}/api/sla/verify`,
      connections: 200,
      duration: 15,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionId: 'nonexistent-intent-id',
        accumulatedTimeMs: 20_000,
        timestamp: Date.now(),
        clickTimestamp: Date.now() - 25_000,
        recaptchaToken: 'dev-token-bypass',
      }),
      // 에러 응답(400/404/409)도 서버가 정상 처리한 것 — 처리 성능 측정
    });

    printAutocannReport('POST /sla/verify (에러경로)', result, true);
    return;
  }

  // 실제 매칭된 intent로 SLA 처리 (한 번만 처리되므로 1회성 테스트)
  printSection('  MATCHED intent로 SLA 순차 처리 성능 측정');

  const start = Date.now();
  let success = 0, fail = 0;

  const tasks = intentIds.slice(0, Math.min(intentIds.length, users.length)).map((intentId, i) =>
    api.post('/api/sla/verify', {
      transactionId: intentId,
      accumulatedTimeMs: 20_000,
      timestamp: Date.now(),
      clickTimestamp: Date.now() - 25_000,
      recaptchaToken: 'dev-token-bypass',
    }, { headers: { Authorization: `Bearer ${users[i % users.length].token}` } })
    .then(res => { if (res.status === 200 || res.status === 201) success++; else fail++; })
    .catch(() => { fail++; })
  );

  await Promise.all(tasks);
  const elapsed = Date.now() - start;

  console.log(`\n  📊 [SLA verify 동시 처리]`);
  console.log(`     처리된 intent : ${intentIds.length}건`);
  console.log(`     성공/실패     : ${success} / ${fail}`);
  console.log(`     총 소요시간   : ${elapsed}ms`);
  console.log(`     처리량        : ${(success / (elapsed / 1000)).toFixed(1)} transactions/s`);
}

// ── 5. Rate Limit 집중 테스트 ────────────────────────────

export async function runRateLimitTest(): Promise<void> {
  printSection('5. Rate Limit 정확도 테스트  —  동일 IP 반복 로그인');

  const body = JSON.stringify({ email: 'ratelimit@test.dev', password: 'wrong' });

  // IP당 10회/15분 제한 → 11회 이상 시 429 확인
  const results: number[] = [];
  for (let i = 0; i < 15; i++) {
    const res = await api.post('/api/auth/login', JSON.parse(body));
    results.push(res.status);
    process.stdout.write(`  req#${i + 1}: ${res.status}  `);
    if ((i + 1) % 5 === 0) process.stdout.write('\n');
  }

  const hit429 = results.filter(s => s === 429).length;
  const hit401 = results.filter(s => s === 401).length;
  console.log(`\n  📊 401(인증실패): ${hit401}  429(레이트리밋): ${hit429}`);
  if (hit429 > 0) {
    console.log('  ✅ Rate Limit 정상 동작 확인');
  } else {
    console.log('  ⚠  10회 제한인데 15회 모두 통과됨 — Rate Limit 미작동 또는 Redis 오류');
  }
}
