# [배포] Railway API 서버용 Dockerfile
# dockerContext = "." (레포 루트) 기준으로 빌드됨
FROM node:20-alpine
WORKDIR /app

RUN npm install -g pnpm@9.0.0

# 의존성 레이어 캐시 최적화
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api...

# 소스 복사 및 빌드
COPY apps/api apps/api
# 빌드 시 DB 접속 불필요 — 더미 URL로 스키마 파싱만 수행
RUN cd apps/api && DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate
RUN cd apps/api && pnpm run build

EXPOSE 4000

# 시작 시 마이그레이션 자동 적용 후 서버 기동
CMD ["sh", "-c", "cd apps/api && npx prisma migrate deploy && node dist/main.js"]
