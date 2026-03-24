import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { BASE_URL, ADMIN_CRED, TEST_ADVERTISER } from './config';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET ?? 'local_dev_secret_jwt_key_982374982374';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
  timeout: 30_000,
  validateStatus: () => true,
});

// ── 결과 포매터 ───────────────────────────────────────────────

export function printHeader(title: string) {
  const line = '═'.repeat(58);
  console.log(`\n╔${line}╗`);
  console.log(`║  ${title.padEnd(56)}║`);
  console.log(`╚${line}╝`);
}

export function printSection(title: string) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 52 - title.length))}`);
}

/**
 * autocannon 결과에서 핵심 지표 추출해서 출력
 * @param non2xxExpected  true면 401/429 등 의도적 non-2xx는 에러로 집계하지 않음
 */
export function printAutocannReport(label: string, result: any, non2xxExpected = false) {
  const r   = result;
  const lat = r.latency;
  const req = r.requests;
  // autocannon v8 percentile 필드명: p2_5, p50, p75, p97_5, p99
  const p50  = lat.p50   ?? lat.median ?? 0;
  const p95  = lat.p97_5 ?? lat.p95    ?? 0;
  const p99  = lat.p99   ?? 0;
  const max  = lat.max   ?? 0;

  // non2xxExpected=true이면 non2xx 카운트를 제외하고 TCP 에러만 집계
  const realErrors = r.errors ?? 0;
  const non2xx     = r.non2xx ?? 0;
  const errCount   = non2xxExpected ? realErrors : realErrors + non2xx;
  const errPct     = req.total > 0 ? ((errCount / req.total) * 100).toFixed(2) : '0.00';

  console.log(`\n  📊 [${label}]`);
  console.log(`     요청수      : ${req.total.toLocaleString()} (${req.average.toFixed(0)} req/s)`);
  console.log(`     응답시간    : p50=${p50}ms  p97.5=${p95}ms  p99=${p99}ms  max=${max}ms`);
  if (non2xxExpected && non2xx > 0) {
    console.log(`     non-2xx     : ${non2xx}건 (401/429 등 — 의도적 응답, 에러 아님)`);
  }
  console.log(`     에러율      : ${errPct}% (TCP오류 ${realErrors}건 / ${req.total.toLocaleString()})`);
  console.log(`     처리량      : ${(r.throughput.average / 1024).toFixed(1)} KB/s`);

  return { label, rps: req.average, p50, p95, p99, errPct: parseFloat(errPct) };
}

// ── 사전 준비 ───────────────────────────────────────────────

export async function getAdminToken(): Promise<string> {
  const res = await api.post('/api/admin/auth/login', ADMIN_CRED);
  if (res.status !== 200 && res.status !== 201) throw new Error(`Admin login failed: ${res.status}`);
  return res.data.accessToken as string;
}

export interface TestUser { id: string; token: string; email: string }

/**
 * 부하 테스트용 계정 풀 확보
 * 전략: Prisma로 직접 DB 삽입 → HTTP rate limit 완전 우회
 *       JWT도 직접 서명 (로그인 API 호출 없음)
 *       seed 계정은 teardown에서 보존 (재실행 시 upsert)
 */
export async function createTestUsers(count: number): Promise<TestUser[]> {
  printSection(`테스트 토큰 풀 확보 (목표: ${count}개, Prisma 직접 생성)`);

  const password     = 'LoadTest1234!';
  const SEED_COUNT   = 5;
  const passwordHash = await bcrypt.hash(password, 4); // cost=4 (속도 우선, 보안 불필요)

  const baseUsers: { id: string; email: string; name: string }[] = [];

  for (let i = 0; i < SEED_COUNT; i++) {
    const email = `load-seed-${i}@loadtest.dev`;
    const name  = `LoadSeed${i}`;

    // upsert: 이미 있으면 그냥 조회
    const user = await prisma.user.upsert({
      where:  { email },
      update: {},
      create: { name, email, passwordHash, status: 'ACTIVE' },
      select: { id: true, email: true, name: true },
    });
    baseUsers.push(user);
    console.log(`  + ${user.email} (${user.id})`);
  }

  if (baseUsers.length === 0) {
    console.log('  ⚠  계정 확보 실패');
    return [];
  }

  // JWT 직접 서명으로 count개 토큰 생성 (로그인 API 호출 없음)
  const users: TestUser[] = [];
  for (let i = 0; i < count; i++) {
    const base  = baseUsers[i % baseUsers.length];
    const token = jwt.sign(
      { sub: base.id, name: base.name, email: base.email },
      JWT_SECRET,
      { expiresIn: '2h' },
    );
    users.push({ id: base.id, token, email: base.email });
  }

  await prisma.$disconnect();
  console.log(`  ✅ seed 계정 ${baseUsers.length}개 → JWT ${users.length}개 (직접 서명)`);
  return users;
}

/** 광고주 등록 (어드민 토큰 필요) */
export async function createTestAdvertiser(adminToken: string): Promise<string> {
  const res = await api.post('/api/admin/advertisers', TEST_ADVERTISER, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Advertiser creation failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data.id as string;
}

/**
 * 테스트 사용자 일괄 삭제
 * seed 계정(load-seed-N@loadtest.dev)은 재실행을 위해 보존
 */
export async function deleteTestUsers(adminToken: string, users: TestUser[]) {
  printSection('테스트 계정 정리 중...');
  const toDelete = users.filter(u => !u.email.startsWith('load-seed-'));
  let deleted = 0;
  const BATCH = 20;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH).map(u =>
      api.delete(`/api/admin/users/${u.id}`, { headers: { Authorization: `Bearer ${adminToken}` } })
        .then(() => { deleted++; })
        .catch(() => {})
    );
    await Promise.all(batch);
  }
  const seedCount = users.length - toDelete.length;
  if (seedCount > 0) console.log(`  ℹ  seed 계정 ${seedCount}개 보존 (재실행용)`);
  if (deleted > 0)   console.log(`  🗑  임시 계정 ${deleted}개 삭제`);
}

/** 광고주 삭제 */
export async function deleteAdvertiser(adminToken: string, advId: string) {
  await api.delete(`/api/admin/advertisers/${advId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  }).catch(() => {});
  console.log(`  🗑  광고주 ${advId} 삭제 완료`);
}

export { api };
