/**
 * WebSocket 동시 연결 부하 테스트
 * 네임스페이스: /intents-realtime (socket.io)
 * 목표: 50 → 200 → 500 → 1000 동시 연결
 */

import { io as SocketIO, Socket } from 'socket.io-client';
import { WS_URL, WS_TARGET_CONNECTIONS } from './config';
import { printSection, TestUser } from './utils';

interface WsPhaseResult {
  target:      number;
  connected:   number;
  failed:      number;
  connectTime: { min: number; max: number; avg: number };
  durationMs:  number;
}

// ── 단일 소켓 연결 + 지연시간 측정 ──────────────────────

function connectSocket(token: string, timeoutMs = 10_000): Promise<{ socket: Socket; latencyMs: number }> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const socket = SocketIO(`${WS_URL}/intents-realtime`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      timeout: timeoutMs,
    });

    const t = setTimeout(() => {
      socket.disconnect();
      reject(new Error('connect timeout'));
    }, timeoutMs);

    socket.on('connect', () => {
      clearTimeout(t);
      resolve({ socket, latencyMs: Date.now() - start });
    });

    socket.on('connect_error', (err) => {
      clearTimeout(t);
      reject(err);
    });

    socket.on('error', (err: any) => {
      if (typeof err === 'object' && err?.message === '인증 토큰이 필요합니다.') {
        clearTimeout(t);
        reject(new Error('auth_required'));
      }
    });
  });
}

// ── 단일 페이즈 실행 ──────────────────────────────────────

async function runWsPhase(
  users: TestUser[],
  targetCount: number,
  holdSecs = 5,
): Promise<WsPhaseResult> {
  const sockets: Socket[] = [];
  const latencies: number[] = [];
  let failed = 0;

  const phaseStart = Date.now();

  if (users.length === 0) {
    return { target: targetCount, connected: 0, failed: targetCount, connectTime: { min: 0, max: 0, avg: 0 }, durationMs: 0 };
  }

  // 배치 단위로 연결 (OS 소켓 한계 + 이벤트루프 부담 고려)
  // JWT는 stateless이므로 동일 토큰으로 다중 연결 가능
  const BATCH_SIZE = 50;
  for (let i = 0; i < targetCount; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, targetCount);
    const batch = Array.from({ length: batchEnd - i }, (_, j) => {
      // 토큰 풀을 순환하며 사용 (동일 토큰 반복 사용도 허용)
      const user = users[(i + j) % users.length];
      return connectSocket(user.token).then(({ socket, latencyMs }) => {
        sockets.push(socket);
        latencies.push(latencyMs);
      }).catch(() => { failed++; });
    });
    await Promise.all(batch);
    process.stdout.write(`\r  연결됨: ${sockets.length}/${targetCount}  실패: ${failed}  `);
  }
  process.stdout.write('\n');

  // 연결 유지 (홀드 구간)
  console.log(`  ⏳ ${holdSecs}초 유지 중... (${sockets.length}개 동시 연결 상태)`);
  await new Promise(r => setTimeout(r, holdSecs * 1000));

  // 연결 해제
  sockets.forEach(s => s.disconnect());
  await new Promise(r => setTimeout(r, 1000)); // 정리 대기

  const durationMs = Date.now() - phaseStart;
  const min = latencies.length ? Math.min(...latencies) : 0;
  const max = latencies.length ? Math.max(...latencies) : 0;
  const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

  return {
    target: targetCount,
    connected: sockets.length,
    failed,
    connectTime: { min, max, avg },
    durationMs,
  };
}

// ── 전체 WebSocket 부하 테스트 ────────────────────────────

export async function runWsLoadTest(users: TestUser[]): Promise<WsPhaseResult[]> {
  printSection('WebSocket /intents-realtime  —  동시 연결 한계 측정');

  if (users.length === 0) {
    console.log('  ⚠  테스트 계정 없음 — 스킵');
    return [];
  }

  const results: WsPhaseResult[] = [];

  for (const target of WS_TARGET_CONNECTIONS) {
    const actual = Math.min(target, users.length);
    console.log(`\n  🔄 목표: ${target}개 동시 연결  (사용 가능 계정: ${actual}개)`);

    const result = await runWsPhase(users, actual, 5);
    results.push(result);

    console.log(`  📊 결과:`);
    console.log(`     연결 성공 : ${result.connected} / ${result.target}`);
    console.log(`     연결 실패 : ${result.failed}`);
    console.log(`     연결 지연 : min=${result.connectTime.min}ms  avg=${result.connectTime.avg}ms  max=${result.connectTime.max}ms`);
    console.log(`     성공률   : ${((result.connected / result.target) * 100).toFixed(1)}%`);

    // 연결 실패율 20% 이상이면 한계 도달로 판단하고 중단
    if (result.failed / result.target > 0.2) {
      console.log(`  ⛔ 실패율 20% 초과 — WebSocket 연결 한계 도달 (목표: ${target})`);
      break;
    }

    // 단계 사이 냉각
    await new Promise(r => setTimeout(r, 2000));
  }

  return results;
}

// ── Redis Pub/Sub 처리량 측정 ─────────────────────────────

export async function runWsPubSubTest(users: TestUser[]): Promise<void> {
  printSection('Redis Pub/Sub 처리량  —  이벤트 수신 지연 측정');

  if (users.length < 2) {
    console.log('  ⚠  계정 부족 — 스킵');
    return;
  }

  const LISTENER_COUNT = Math.min(50, users.length);
  const sockets: Socket[] = [];
  const receivedEvents: number[] = [];
  let totalReceived = 0;

  console.log(`  🔄 ${LISTENER_COUNT}개 소켓 연결 후 이벤트 수신 측정`);

  // 리스너 연결
  for (let i = 0; i < LISTENER_COUNT; i++) {
    try {
      const { socket } = await connectSocket(users[i].token);
      socket.on('reward_updated', () => {
        receivedEvents.push(Date.now());
        totalReceived++;
      });
      socket.on('new_intent_opportunity', () => {
        receivedEvents.push(Date.now());
        totalReceived++;
      });
      sockets.push(socket);
    } catch { /* 연결 실패 무시 */ }
  }

  console.log(`  ✅ ${sockets.length}개 소켓 연결됨 — 30초 대기 (실제 이벤트 수신 측정)`);
  await new Promise(r => setTimeout(r, 30_000));

  sockets.forEach(s => s.disconnect());

  console.log(`\n  📊 [Redis Pub/Sub 수신 현황]`);
  console.log(`     연결된 소켓   : ${sockets.length}개`);
  console.log(`     수신된 이벤트 : ${totalReceived}건`);
  console.log(`  ℹ  이 테스트는 30초 내 실제 intent 상장/SLA 발생 시에만 이벤트가 옴`);
}
