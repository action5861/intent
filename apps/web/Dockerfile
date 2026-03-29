# [배포] Railway 웹 서버용 Dockerfile
# dockerContext = "." (레포 루트) 기준으로 빌드됨
FROM node:20-alpine
WORKDIR /app

RUN npm install -g pnpm@9.0.0

# 의존성 레이어 캐시 최적화
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter web...

# 소스 복사 및 빌드 (standalone 출력 포함)
COPY apps/web apps/web
RUN cd apps/web && pnpm run build

EXPOSE 3000

# Next.js standalone 서버 직접 실행
CMD ["node", "apps/web/.next/standalone/apps/web/server.js"]
