/**
 * Intendex 부하 테스트 메인 러너
 *
 * 실행: pnpm --filter api test:load
 *
 * 테스트 순서:
 *   SETUP    — 테스트 계정 생성 + 광고주 등록
 *   PHASE 1  — POST /api/auth/login  (bcrypt 병목 측정)
 *   PHASE 2  — GET /api/auth/me      (JWT 검증 경량 기준선)
 *   PHASE 3  — POST /api/intents     (rate limit + DB write)
 *   PHASE 4  — POST /api/sla/verify  ($transaction + Pub/Sub)
 *   PHASE 5  — Rate Limit 정확도
 *   PHASE 6  — WebSocket 동시 연결 한계
 *   REPORT   — 병목 분석 + 개선 방안
 *   TEARDOWN — 테스트 데이터 정리
 */

import { printHeader, printSection, getAdminToken, createTestUsers, createTestAdvertiser, deleteTestUsers, deleteAdvertiser, TestUser } from './utils';
import { runLoginLoadTest, runMeEndpointTest, runIntentSubmitTest, runSlaVerifyTest, runRateLimitTest } from './http-load';
import { runWsLoadTest } from './ws-load';
import { generateReport, PhaseResult, WsResult } from './report';
import { PRELOAD_USER_COUNT } from './config';

// ── 메인 ────────────────────────────────────────────────

async function main() {
  printHeader('Intendex 부하 테스트 — 최대 10,000 동시 사용자 시나리오');
  console.log(`  서버: http://localhost:4000`);
  console.log(`  실행: ${new Date().toISOString()}`);
  console.log(`  계획 사전 계정수: ${PRELOAD_USER_COUNT}개`);

  let adminToken = '';
  let advId = '';
  let users: TestUser[] = [];

  let loginResults:  PhaseResult[] = [];
  let meResults:     PhaseResult[] = [];
  let wsResults:     WsResult[]    = [];

  try {
    // ── SETUP ──────────────────────────────────────────
    printSection('SETUP  —  사전 준비');

    adminToken = await getAdminToken();
    console.log('  ✅ 어드민 토큰 확보');

    advId = await createTestAdvertiser(adminToken);
    console.log(`  ✅ 부하테스트 광고주 등록: ${advId}`);

    users = await createTestUsers(PRELOAD_USER_COUNT);

    // ── PHASE 1: Login ─────────────────────────────────
    printHeader('PHASE 1 — POST /api/auth/login  (bcrypt 부하 측정)');
    loginResults = await runLoginLoadTest();

    // ── PHASE 2: GET /me 경량 기준선 ──────────────────
    printHeader('PHASE 2 — GET /api/auth/me  (경량 기준선)');
    meResults = await runMeEndpointTest(users);

    // ── PHASE 3: Intent 제출 ───────────────────────────
    printHeader('PHASE 3 — POST /api/intents  (Rate Limit + DB write)');
    await runIntentSubmitTest(users);

    // ── PHASE 4: SLA Verify ────────────────────────────
    printHeader('PHASE 4 — POST /api/sla/verify  ($transaction + Redis)');
    // 사전 매칭된 intent ID 없음 → 에러 경로 성능 측정
    await runSlaVerifyTest(users, []);

    // ── PHASE 5: Rate Limit 정확도 ────────────────────
    printHeader('PHASE 5 — Rate Limit 정확도 검증');
    await runRateLimitTest();

    // ── PHASE 6: WebSocket 동시 연결 ──────────────────
    printHeader('PHASE 6 — WebSocket 동시 연결 한계');
    wsResults = await runWsLoadTest(users);

    // ── 종합 리포트 ────────────────────────────────────
    generateReport(loginResults, meResults, wsResults);

    process.exitCode = 0;

  } catch (err: unknown) {
    console.error('\n╔════════════════════════════════════════════════════╗');
    console.error('║  ❌  부하 테스트 중 오류 발생                      ║');
    console.error('╚════════════════════════════════════════════════════╝');
    console.error('  원인:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;

  } finally {
    // ── TEARDOWN ───────────────────────────────────────
    printSection('TEARDOWN  —  테스트 데이터 정리');
    if (adminToken && users.length > 0) {
      await deleteTestUsers(adminToken, users);
    }
    if (adminToken && advId) {
      await deleteAdvertiser(adminToken, advId);
    }
    console.log('  정리 완료');
  }
}

main();
