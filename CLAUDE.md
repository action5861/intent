# Intendex — CLAUDE.md

> AdTech Intent Exchange Platform. 사용자가 검색 의도를 상장하면 광고주가 AI 자동 매칭으로 구매. 실시간 WebSocket + 포인트 리워드.

---

## 빠른 참조

| 항목 | 값 |
|---|---|
| **DB** | `postgresql://postgres:ljh04021@localhost:5432/intendex_dev` |
| **JWT_SECRET** | `local_dev_secret_jwt_key_982374982374` |
| **어드민 계정** | `admin` / `admin1234!` |
| **Gemini 모델** | `gemini-2.5-flash` |
| **Node.js** | v20.18.0 → Prisma **v6** 필수 (v7은 Node 20.19+ 필요) |
| **API 포트** | 4000 |
| **Web 포트** | 3000 |

---

## 프로젝트 구조

```
C:\Users\MS\intent/          ← pnpm Turborepo 루트
├── apps/api/                ← NestJS 11 백엔드
│   ├── src/
│   │   ├── prisma/          ← PrismaService (@Global)
│   │   ├── auth/            ← 사용자/광고주 인증 + JWT
│   │   ├── admin/           ← 어드민 CRUD + AdminGuard
│   │   ├── intents/         ← 의도 상장 + AI 매칭 + WebSocket
│   │   ├── ai/              ← Gemini (파싱/채팅/스코어링/사이트분석)
│   │   ├── redis/           ← 3개 독립 클라이언트
│   │   ├── sla/             ← reCAPTCHA + 체류시간 검증 + 정산
│   │   ├── database/        ← Prisma $transaction (ACID)
│   │   ├── common/categories.constants.ts  ← 15개 고정 카테고리
│   │   ├── rate-limit.middleware.ts         ← JWT 기반 5회/24h
│   │   └── auth-rate-limit.middleware.ts   ← IP 기반 로그인/회원가입
│   └── prisma/schema.prisma
└── apps/web/app/            ← Next.js 16
    ├── /                    ← 랜딩
    ├── /login  /register    ← 사용자 인증
    ├── /intent              ← AI 채팅 의도 상장
    ├── /dashboard           ← 의도 목록 + 리워드
    ├── /rewards             ← 포인트 내역 + 인출
    ├── /sla-visit           ← 광고주 사이트 방문 추적
    ├── /admin/*             ← 어드민 패널
    └── /advertiser/*        ← 광고주 대시보드
```

---

## 개발 명령어

```bash
# 루트
pnpm install
pnpm run dev          # 두 앱 동시 실행

# API (apps/api/)
pnpm run start:dev
npx prisma migrate dev --name <name>
npx prisma db seed
npx prisma studio

# Web (apps/web/)
pnpm run dev
```

> ⚠️ **Prisma generate EPERM**: Windows에서 API 서버 실행 중 `npx prisma generate` 실행 시 EPERM. 서버 중지 후 실행.

---

## 인증 체계 (반드시 준수)

### JWT 가드 종류

| 가드 | 파일 | 적용 대상 |
|---|---|---|
| `UserGuard` | `auth/user.guard.ts`, `intents/user.guard.ts` | role 필드 없는 일반 사용자 JWT |
| `AdvertiserGuard` | `intents/advertiser.guard.ts` | role=advertiser JWT 필수 |
| `AdminGuard` | `admin/` | role=admin JWT 필수 |

### 보호된 엔드포인트

```
POST /api/intents              → UserGuard (userId는 JWT에서 추출, ?userId= 쿼리 사용 금지)
POST /api/intents/chat         → UserGuard
GET  /api/intents              → UserGuard
GET  /api/intents/advertiser-matches → AdvertiserGuard
GET  /api/auth/me              → UserGuard
GET  /api/auth/rewards         → UserGuard
POST /api/auth/withdraw        → UserGuard
POST /api/sla/verify           → UserGuard
POST /api/admin/*              → AdminGuard
```

### localStorage 키 (프론트엔드)

```
사용자:    user_token, user_id, user_name
광고주:    advertiser_token, advertiser_id, advertiser_company
어드민:    admin_token, admin_username
```

---

## API 엔드포인트 요약

```
# 사용자 인증
POST /api/auth/register                → 회원가입 (비밀번호 8자+)
POST /api/auth/login                   → 로그인
GET  /api/auth/me                      → 프로필 { rewardBalance, totalIntents }
GET  /api/auth/rewards                 → 적립 내역 { rewardBalance, totalEarned, history[] }
POST /api/auth/withdraw                → 인출 신청 (최소 10,000P, 1,000P 단위)

# 광고주 인증
POST /api/auth/advertiser/login        → { accessToken, advertiserId, company }

# 의도
POST /api/intents/chat                 → Gemini 대화 (완료 시 { type: "ready", enrichedText })
POST /api/intents                      → 의도 상장 → DB 저장 + AI 매칭 트리거
GET  /api/intents                      → 사용자별 목록 (JWT에서 userId 추출)
GET  /api/intents/advertiser-matches   → 광고주 매칭 목록

# SLA
POST /api/sla/verify                   → reCAPTCHA + 체류시간(19초+) 검증 → 정산

# 어드민
POST /api/admin/auth/login
GET  /api/admin/users
GET  /api/admin/advertisers
POST /api/admin/advertisers            → AI 사이트 분석 후 등록 → rematch 자동 호출
POST /api/admin/intents/rematch-waiting → WAITING_MATCH intent 전체 재매칭
```

---

## 핵심 비즈니스 로직

### 의도 상장 플로우

```
1. /intent 채팅 UI → POST /api/intents/chat (2~3회 대화)
2. AI ready 판단 → enrichedText 생성
3. 사용자 "상장하기" → POST /api/intents
4. Gemini: enrichedText → category, expectedPrice, keywords 파싱
5. [중복 체크] 최근 30일 이내 사용자 intent와 Jaccard 유사도 비교 → 70% 이상이면 409 반환
6. PostgreSQL 저장 + Redis TTL 10분
7. 비동기 runAiMatching():
   - 카테고리/키워드 일치 광고주 최대 20개 조회
   - Gemini 스코어링 → 70점 이상 최고점 광고주 자동 MATCHED
   - executeMatchTransaction() → intent MATCHED
   - match:ads:{advertiserId} Redis 발행
```

### 중복 의도 방지 (Jaccard 유사도)

```
위치: apps/api/src/intents/intents.service.ts → handleIncomingIntent()
유틸: apps/api/src/common/similarity.util.ts → calcJaccardSimilarity(), extractKeywords(), getDuplicatePeriodDays()

의도 중복 방지: 카테고리별 차등 기간(식품 7일, 뷰티 14일, 기타 30일) 내
keywords Jaccard 유사도 70% 이상이면 409 거부

판단 기준:
- keywords가 있으면 keywords 배열로 비교
- keywords 없으면 enrichedText(또는 rawText)를 공백 split, 2글자 이상 단어 추출
- Jaccard = 교집합 / 합집합 (소문자 정규화)
- 70% 이상 → 409 Conflict, "이미 유사한 의도가 등록되어 있습니다. 다른 관심사를 등록해주세요."
- rate-limit(5회/24h)과 독립적인 별도 방어층
```

### 리워드 계산

```
지급 포인트 = Math.min(advertiser.rewardPerVisit, 1000)
(expectedPrice 기반 비율 계산 방식 폐지됨)
```

### SLA 개발 우회

```javascript
// recaptchaToken에 "dev-" 접두사 → reCAPTCHA 검증 건너뜀
recaptchaToken: "dev-token-bypass"
// production에서는 즉시 거부됨
```

---

## DB 스키마 (핵심 필드)

```prisma
User               { id, name, email, passwordHash, status, totalIntents, rewardBalance }
Advertiser         { id, company, email, passwordHash, category, keywords[], siteUrl,
                     siteDescription, rewardPerVisit(max:1000), totalBudget, remainingBudget,
                     status, matchCount }
Intent             { id, userId, rawText, enrichedText, category, expectedPrice,
                     status(WAITING_MATCH→MATCHED→SLA_VERIFIED), matchedAdvertiserId }
Admin              { id, username, passwordHash }
WithdrawalRequest  { id, userId, amount, bankName, accountNumber, accountHolder,
                     status(PENDING), createdAt }
```

> 마지막 마이그레이션: `20260317144023_add_withdrawal_request` (적용 완료)

---

## WebSocket

```
네임스페이스: /intents-realtime (socket.io)
CORS: FRONTEND_URL 환경변수 (기본 http://localhost:3000)

이벤트:
  new_intent_opportunity  → 광고주: 자동 매칭 완료
  sla_completed           → 광고주: SLA 완료
  reward_updated          → 사용자: { rewardAmount, newBalance, intentId, status }
  budget_alert            → 광고주: { remainingBudget, remainingVisits, isCritical }

Redis Pub/Sub 채널:
  match:ads:{advertiserId}      → AI 매칭 결과
  user_reward:{userId}          → 리워드 적립
  budget_alert:{advertiserId}   → 예산 부족 경고
```

---

## 고정 카테고리 (15개)

```
전자기기, 패션, 식품, 여행, 부동산, 금융, 보험, 자동차,
뷰티, 교육, 의료, 법률, 쇼핑, 비영리, 기타
```

위치: `apps/api/src/common/categories.constants.ts`  
AI 프롬프트와 어드민 UI에 `CATEGORIES_STRING` 상수로 주입됨. **목록 외 카테고리 절대 사용 금지.**

---

## Rate Limit

| 미들웨어 | 기준 | 제한 |
|---|---|---|
| `rate-limit.middleware.ts` | JWT userId | 5회/24시간 (POST /api/intents) |
| `auth-rate-limit.middleware.ts` | IP | 로그인 10회/15분, 회원가입 5회/1시간 |

> fail-closed 패턴: Redis 에러 시 503 반환 (통과 허용 안 함)

---

## 보안 규칙

- **비밀번호**: 8자 이상 (프론트 + 서버 양쪽)
- **이메일 열거 방지**: 회원가입 중복 에러 → "회원가입에 실패했습니다." (일반화)
- **helmet v8.1.0**: HSTS, CSP (frameSrc: none), X-Frame-Options 등
- **광고주 자가 회원가입 없음**: 어드민 전용 등록 유지

---

## 미완성 기능 (작업 시 주의)

- `WithdrawalRequest` APPROVED/REJECTED 어드민 처리 UI 미구현
- 어드민 감사 로그 미구현

---

## 알려진 이슈

| 이슈 | 해결책 |
|---|---|
| intent 상장 후 광고주 등록 시 매칭 0건 | 어드민 광고주 등록 → `POST /api/admin/intents/rematch-waiting` 자동 호출 |
| `subscribedSlaChannels` Set이 match/SLA/budget 채널 모두 관리 | Set 이름 오해 소지 있으나 기능 정상 |
| Prisma generate EPERM (Windows) | 서버 중지 후 generate 실행 |