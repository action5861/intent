/**
 * PM2 Cluster 설정 — Intendex API
 *
 * 실행:
 *   pnpm run build          # 먼저 빌드
 *   pm2 start ecosystem.config.js --env production
 *   pm2 monit               # 모니터링
 *   pm2 logs                # 로그
 *   pm2 reload intendex-api # 무중단 재시작 (Rolling restart)
 *   pm2 delete intendex-api # 중지 및 삭제
 *
 * 주의: WebSocket 다중 프로세스 분산은 @socket.io/redis-adapter 필수
 *       (적용 위치: apps/api/src/main.ts)
 */
module.exports = {
  apps: [
    {
      name: 'intendex-api',
      script: './dist/src/main.js',

      // ── Cluster 모드 ──────────────────────────────────────
      instances: 4,          // 운영 환경에서는 'max' (CPU 코어 전체 사용)
      exec_mode: 'cluster',  // Node.js cluster: 요청 라운드로빈 분배

      // ── 메모리 제한 ───────────────────────────────────────
      max_memory_restart: '1G',  // 1GB 초과 시 자동 재시작

      // ── 파일 감시 비활성화 (운영 환경) ───────────────────
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],

      // ── 로그 ─────────────────────────────────────────────
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,   // cluster 모드에서 로그 파일 통합

      // ── 재시작 정책 ───────────────────────────────────────
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',  // 10초 미만 실행 후 죽으면 재시작 안 함

      // ── 무중단 배포 ───────────────────────────────────────
      kill_timeout: 5000,          // 5초 후 강제 종료
      wait_ready: true,             // app.emit('ready') 대기
      listen_timeout: 10000,        // 리슨 대기 10초

      // ── 환경변수 ─────────────────────────────────────────
      env: {
        NODE_ENV: 'development',
        API_PORT: 4000,
      },
      env_production: {
        NODE_ENV: 'production',
        API_PORT: 4000,
        // 운영 환경에서는 .env 파일 대신 여기에 직접 주입
        // DATABASE_URL: 'postgresql://...',
        // JWT_SECRET: '...',
        // REDIS_HOST: '...',
        // GEMINI_API_KEY: '...',
        // FRONTEND_URL: 'https://intendex.example.com',
      },
    },
  ],
};
