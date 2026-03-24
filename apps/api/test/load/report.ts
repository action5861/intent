/**
 * 부하 테스트 결과 분석 리포트 생성
 * - 병목 자동 감지
 * - 개선 방안 출력
 */

export interface PhaseResult {
  label:   string;
  rps:     number;
  p50:     number;
  p95:     number;
  p99:     number;
  errPct:  number;
}

export interface WsResult {
  target:      number;
  connected:   number;
  failed:      number;
  connectTime: { min: number; max: number; avg: number };
  durationMs:  number;
}

// ── 병목 감지 기준 ──────────────────────────────────────

const THRESHOLDS = {
  /** p99 > 이 값(ms)이면 응답 지연 경고 */
  p99WarnMs:    2_000,
  p99CriticalMs: 5_000,
  /** 에러율 > 이 값(%)이면 경고 */
  errWarnPct:   1.0,
  errCriticalPct: 5.0,
  /** RPS가 직전 단계 대비 이 비율 이하로 떨어지면 포화 감지 */
  rpsDegradePct: 0.5,
  /** WS 연결 성공률 < 이 값이면 경고 */
  wsSuccessMin:  0.9,
};

// ── 리포트 출력 ─────────────────────────────────────────

function bar(value: number, max: number, width = 30): string {
  const filled = Math.round((value / max) * width);
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, width - filled));
}

export function generateReport(
  loginResults:  PhaseResult[],
  meResults:     PhaseResult[],
  wsResults:     WsResult[],
) {
  const line = '═'.repeat(62);
  console.log(`\n\n╔${line}╗`);
  console.log(`║${'  📋  부하 테스트 종합 분석 리포트'.padEnd(62)}║`);
  console.log(`╚${line}╝\n`);

  // ── 1. 응답시간 추이 ──────────────────────────────────
  console.log('  ┌─ Login 응답시간 추이 (bcrypt cost=12 영향) ─────────────┐');
  const maxP99 = Math.max(...loginResults.map(r => r.p99), 1);
  for (const r of loginResults) {
    const flag = r.p99 > THRESHOLDS.p99CriticalMs ? '🔴' :
                 r.p99 > THRESHOLDS.p99WarnMs     ? '🟡' : '🟢';
    console.log(`  │ ${flag} [${r.label.padEnd(8)}] p50=${String(r.p50).padStart(5)}ms  p95=${String(r.p95).padStart(5)}ms  p99=${String(r.p99).padStart(5)}ms  err=${r.errPct.toFixed(1)}%`);
    console.log(`  │    ${bar(r.p99, maxP99)} p99`);
  }
  console.log('  └──────────────────────────────────────────────────────────┘');

  if (meResults.length > 0) {
    console.log('\n  ┌─ GET /me 응답시간 추이 (경량 기준선) ─────────────────┐');
    const maxMeP99 = Math.max(...meResults.map(r => r.p99), 1);
    for (const r of meResults) {
      const flag = r.p99 > THRESHOLDS.p99WarnMs ? '🟡' : '🟢';
      console.log(`  │ ${flag} [${r.label.padEnd(8)}] p50=${String(r.p50).padStart(5)}ms  p95=${String(r.p95).padStart(5)}ms  p99=${String(r.p99).padStart(5)}ms`);
      console.log(`  │    ${bar(r.p99, maxMeP99)} p99`);
    }
    console.log('  └──────────────────────────────────────────────────────────┘');
  }

  // ── 2. WebSocket 결과 ─────────────────────────────────
  if (wsResults.length > 0) {
    console.log('\n  ┌─ WebSocket 동시 연결 한계 ────────────────────────────┐');
    let wsLimit = wsResults[wsResults.length - 1].connected;
    for (const r of wsResults) {
      const successRate = r.target > 0 ? r.connected / r.target : 0;
      const flag = successRate < THRESHOLDS.wsSuccessMin ? '🔴' : '🟢';
      console.log(`  │ ${flag} 목표=${r.target.toString().padStart(4)}  성공=${r.connected.toString().padStart(4)}  실패=${r.failed.toString().padStart(4)}  성공률=${(successRate * 100).toFixed(0).padStart(3)}%  avgConn=${r.connectTime.avg}ms`);
      if (successRate >= THRESHOLDS.wsSuccessMin) wsLimit = r.connected;
    }
    console.log(`  │`);
    console.log(`  │  ✅ 안정적 동시 연결 한계: 약 ${wsLimit}개`);
    console.log('  └──────────────────────────────────────────────────────────┘');
  }

  // ── 3. 병목 자동 감지 ─────────────────────────────────
  console.log('\n  ┌─ 🔍 자동 병목 감지 결과 ──────────────────────────────┐');
  const bottlenecks: { severity: string; component: string; detail: string }[] = [];

  // bcrypt 병목 — p99 지연으로만 판단 (에러율 아님, login은 401 의도적)
  const loginHighLoad = loginResults.find(r => r.label.includes('고부하') || r.label.includes('스파이크'));
  if (loginHighLoad && loginHighLoad.p99 > THRESHOLDS.p99WarnMs) {
    bottlenecks.push({
      severity: loginHighLoad.p99 > THRESHOLDS.p99CriticalMs ? '🔴 CRITICAL' : '🟡 WARNING',
      component: 'bcrypt (auth/login)',
      detail: `고부하 p99=${loginHighLoad.p99}ms — cost=12 × 동시요청 → CPU 포화`,
    });
  }

  // RPS 포화 감지
  for (let i = 1; i < loginResults.length; i++) {
    const prev = loginResults[i - 1];
    const curr = loginResults[i];
    if (prev.rps > 0 && curr.rps < prev.rps * THRESHOLDS.rpsDegradePct) {
      bottlenecks.push({
        severity: '🟡 WARNING',
        component: 'Event Loop 포화',
        detail: `${prev.label}→${curr.label} RPS ${prev.rps.toFixed(0)}→${curr.rps.toFixed(0)} (${((curr.rps/prev.rps)*100).toFixed(0)}%)`,
      });
    }
  }

  // 에러율 이상 (loginResults는 401 의도적 non2xx → 에러율 체크 제외)
  for (const r of meResults) {
    if (r.errPct > THRESHOLDS.errCriticalPct) {
      bottlenecks.push({
        severity: '🔴 CRITICAL',
        component: `에러율 급증 (${r.label})`,
        detail: `에러율 ${r.errPct.toFixed(1)}% — DB 커넥션 풀 소진 또는 OOM 의심`,
      });
    } else if (r.errPct > THRESHOLDS.errWarnPct) {
      bottlenecks.push({
        severity: '🟡 WARNING',
        component: `에러율 상승 (${r.label})`,
        detail: `에러율 ${r.errPct.toFixed(1)}%`,
      });
    }
  }

  // WS 연결 실패
  for (const r of wsResults) {
    if (r.failed / r.target > 0.1) {
      bottlenecks.push({
        severity: '🟡 WARNING',
        component: 'WebSocket 연결',
        detail: `목표 ${r.target}에서 ${r.failed}건 실패 — socket.io 처리 한계 또는 OS 포트 고갈`,
      });
    }
  }

  if (bottlenecks.length === 0) {
    console.log('  │  ✅ 감지된 병목 없음 — 테스트 범위 내 성능 양호');
  } else {
    for (const b of bottlenecks) {
      console.log(`  │  ${b.severity}  [${b.component}]`);
      console.log(`  │      → ${b.detail}`);
    }
  }
  console.log('  └──────────────────────────────────────────────────────────┘');

  // ── 4. 개선 방안 ──────────────────────────────────────
  console.log(`
╔${line}╗
║${'  🛠  병목 원인 분석 및 개선 방안'.padEnd(62)}║
╚${line}╝

  ① bcrypt cost=12  —  가장 큰 단일 병목
  ┌───────────────────────────────────────────────────────────┐
  │ 원인: bcrypt cost=12 → 단일 CPU 코어 ~250-400ms 점유     │
  │       Node.js 단일 프로세스에서 동시 로그인 폭증 시      │
  │       Event Loop 완전 차단 (CPU-bound 작업)              │
  │                                                           │
  │ 해결책 A (즉시): cost 낮추기 (12 → 10)                  │
  │   · 로그인 p99: ~400ms → ~100ms (4배 개선)              │
  │   · apps/api/src/auth/auth.service.ts:                   │
  │     bcrypt.hash(password, 10)  // cost=12→10            │
  │                                                           │
  │ 해결책 B (권장): Node.js cluster 모드 (CPU 코어 수 만큼) │
  │   · apps/api/src/main.ts에 cluster 분기 추가             │
  │   · 4코어 = 4배 처리량                                   │
  │                                                           │
  │ 해결책 C (장기): Argon2id 전환 (메모리-hard, CPU 효율↑) │
  │   · pnpm add argon2                                      │
  └───────────────────────────────────────────────────────────┘

  ② Prisma 커넥션 풀 미설정  —  고부하 시 DB 병목
  ┌───────────────────────────────────────────────────────────┐
  │ 원인: 기본값 connection_limit = cpu_cores * 2 + 1        │
  │       4코어 기준 = 9개 → 동시 1000 요청 시 대기 급증    │
  │                                                           │
  │ 해결책: DATABASE_URL에 명시적 풀 설정                    │
  │   apps/api/.env:                                         │
  │   DATABASE_URL="postgresql://...?connection_limit=20     │
  │                &pool_timeout=10"                         │
  │                                                           │
  │ 단, PostgreSQL max_connections(기본 100)도 함께 조정     │
  │   postgresql.conf: max_connections = 200                 │
  └───────────────────────────────────────────────────────────┘

  ③ Redis subscriber 단일 커넥션  —  WebSocket 확장 한계
  ┌───────────────────────────────────────────────────────────┐
  │ 원인: subscriberClient 1개가 모든 채널 메시지 처리       │
  │       WebSocket 연결 수 증가 → 채널 수 증가              │
  │       → 단일 리스너에서 message 이벤트 필터링 O(n)       │
  │                                                           │
  │ 해결책: Redis Adapter for Socket.IO 도입                 │
  │   pnpm add @socket.io/redis-adapter                      │
  │   Socket.IO가 Redis Pub/Sub을 직접 관리                  │
  │   → 수평 확장(다중 서버)도 자동 지원                    │
  └───────────────────────────────────────────────────────────┘

  ④ 단일 NestJS 프로세스  —  CPU 병목 근본 원인
  ┌───────────────────────────────────────────────────────────┐
  │ 원인: Node.js 이벤트루프는 단일 스레드                   │
  │       bcrypt 같은 CPU-bound 작업이 전체 요청 차단        │
  │                                                           │
  │ 해결책 A: PM2 cluster 모드 (빠른 적용)                   │
  │   pm2 start dist/main.js -i max  # CPU 코어 수만큼       │
  │                                                           │
  │ 해결책 B: Kubernetes Horizontal Pod Autoscaling          │
  │   · Pod당 1 NestJS 프로세스                              │
  │   · Redis Pub/Sub + Socket.IO Redis Adapter로 상태 공유  │
  │   · PostgreSQL PgBouncer로 커넥션 풀 집중 관리           │
  └───────────────────────────────────────────────────────────┘

  ⑤ Rate Limit fail-closed (Redis 의존)  —  가용성 리스크
  ┌───────────────────────────────────────────────────────────┐
  │ 원인: Redis 장애 시 503 반환 (fail-closed 정책)          │
  │       이는 보안상 올바른 선택이지만                      │
  │       Redis 다운 → 전체 인증 서비스 중단                 │
  │                                                           │
  │ 해결책: Redis Sentinel 또는 Redis Cluster 구성           │
  │   · Sentinel: 3노드 HA (마스터 장애 시 자동 페일오버)   │
  │   · 운영 환경에서는 Elasticache Redis (AWS) 권장         │
  └───────────────────────────────────────────────────────────┘

  ⑥ WebSocket 동시 연결  —  메모리 및 OS 소켓 한계
  ┌───────────────────────────────────────────────────────────┐
  │ 원인: Socket.IO 연결당 약 40KB 메모리                    │
  │       10,000 연결 = ~400MB + Node.js 기본 메모리         │
  │       Windows 기본 ulimit = 제한 없음(단, 동적 포트 고갈)│
  │                                                           │
  │ 해결책:                                                   │
  │   · Node.js --max-old-space-size=4096 설정               │
  │   · Nginx upstream으로 WS 로드밸런싱 (sticky session)    │
  │   · Socket.IO Redis Adapter로 다중 서버 상태 공유        │
  └───────────────────────────────────────────────────────────┘`);
}
