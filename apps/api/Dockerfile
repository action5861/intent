# [배포] Railway API 서버용 Dockerfile
# dockerContext = "." (레포 루트) 기준으로 빌드됨
ARG CACHEBUST=1
FROM node:20-alpine
WORKDIR /app

RUN npm install -g pnpm@9.0.0

# 빌드 타임 더미 DATABASE_URL — prisma generate/postinstall이 DB 없이 실행되도록
# 실제 DATABASE_URL은 컨테이너 시작 시 Railway가 환경변수로 주입
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# 의존성 레이어 캐시 최적화
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api...

# 소스 복사 및 빌드
COPY apps/api apps/api
RUN cd apps/api && npx prisma generate
RUN cd apps/api && pnpm run build

# 빌드 결과물 확인 (디버그 — 배포 안정화 후 삭제)
RUN ls -la apps/api/dist/src/ || echo "dist/src not found"

EXPOSE 4000

# 실제 빌드 출력: dist/src/main.js (tsconfig rootDir=src 설정에 의해 src 경로 유지)
CMD ["sh", "-c", "cd apps/api && (npx prisma migrate deploy || echo '[WARN] prisma migrate deploy failed — check DATABASE_URL') && node dist/src/main.js"]
