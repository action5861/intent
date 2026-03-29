# Intendex - Intent Exchange Platform 🚀

Intendex는 사용자의 '검색 의도(Intent)' 데이터를 상장하고 실시간으로 광고주가 이를 구매하여 소비자에게 직접 보상을 제공하는 혁신적인 **애드테크 플랫폼이자 의도 데이터 거래소**입니다.

이 레포지토리는 프론트엔드와 백엔드를 통합 관리하는 Monorepo(Turborepo) 아키텍처로 구성되어 있습니다.

---

## 🏗️ Architecture & Stack

### **1. Monorepo (pnpm + Turborepo)**
- 여러 서비스(Web, API) 간 의존성을 효율적으로 관리하고 강력한 로컬 캐싱을 이용한 빠른 빌드를 제공합니다.

### **2. Frontend (`apps/web`)**
- **Framework**: `Next.js 14` (App Router)
- **Styling**: `Tailwind CSS`, `lucide-react`
- **Features**:
  - 현대적이고 세련된 다크 테마(SaaS 스타일)의 랜딩 페이지 및 인증(회원가입/로그인) UI
  - **Intent Dashboard**: 사용자가 자신의 의도를 검색하듯 입력하고 실시간 매칭 상태(AI 분석 중 -> 대기 중 -> 매칭 완료)를 시각적으로 추적할 수 있는 인터페이스
  - 서버 측 SLA 추적을 위한 가벼운 Vanilla JS 픽셀(`intendex-tracker.js`) 에셋 제공

### **3. Backend (`apps/api`)**
- **Framework**: `NestJS` (Node.js)
- **Real-Time Data**: `Redis (ioredis)`, `WebSockets`
- **Features**:
  - **Gemini AI Integration**: 사용자의 자연어 텍스트를 정형화된 JSON 객체(카테고리, 확신도 등)로 파싱하여 환각 없이 정보 추출
  - **Redis Pub/Sub Architecture**: 분산 환경에서 사용자의 '의도'가 상장됨과 동시에 관련 카테고리를 구독 중인 수많은 광고주 클라이언트에게 1만 명 규모에서도 끊김 없는 실시간 브로드캐스팅 지원
  - **SLA(Service Level Agreement) Verification API**: 
    - 광고주 사이트의 트래킹 스크립트가 보내는 체류시간 분석 핑 검증 로직 구현 (`POST /api/sla/verify`)
  - **Anti-Abuse & Security System**:
    - **Redis Rate Limiting**: 무분별한 의도 상장 어뷰징을 막기 위해 1분당 API 호출 횟수 제한(Rate Limiter)
    - **SLA Timestamp Verification**: 물리적 시간 흐름을 계산하여 자바스크립트 타이머 조작(Time-skip)을 통한 보상 해킹 방어
    - **reCAPTCHA v3**: 봇의 자동화된 허위 트래픽을 토큰 스코어로 식별
  - **ACID Transaction Settlement Engine**:
    - 매칭이 최종 완료될 경우 광고주의 예산을 차감하고 일반 사용자에게 '데이터 기본소득(Reward)' 포인트를 지급하는 원자적(Atomic) DB 트랜잭션 안전결제 시뮬레이션 적용

---

## 🛠️ Security Practices

Intendex 프로젝트는 **보안을 최우선**으로 설계되었습니다:
- 루트뿐 아니라 프론트/백엔드 폴더 내 철저한 `.gitignore` 규칙을 통해 환경 변수 및 구글 Gemini API Key 등 자격 증명 파일의 유출을 원천 차단합니다.
- 데이터베이스 상태 업데이트에 ACID 트랜잭션을 강제하여 동시 접속 상황이나 중간 통신 단절 시 발생하는 데이터 무결성 훼손을 방지(Rollback) 합니다.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- pnpm 

### Installation
```bash
# 단일 커맨드로 모든 monorepo 의존성 설치
pnpm install
```

### Running the Apps
```bash
# 백엔드 및 프론트엔드 전체 서비스 환경 동시 구동
pnpm run dev
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:4000](http://localhost:4000)

---
*Developed for the Future of Intent Data Economy.*

---

## 🧐 AI Comprehensive Code Review (AI 종합 코드 리뷰)

해당 프로젝트의 전체 소스코드를 분석한 결과, 최신 기술 스택(NestJS, Next.js 14, Redis, Prisma, Gemini AI)의 특성을 깊이 이해하고 설계된 **뛰어난 아키텍처**를 가지고 있음을 확인했습니다. 다음은 코드 품질과 로직 설계 관점에서의 상세한 리뷰입니다.

### 🌟 1. Architecture & Core Logic (아키텍처 및 핵심 설계)
- **Monorepo 기반의 깔끔한 분리**: Turborepo와 pnpm workspaces를 이용해 프론트엔드와 API 서버 간의 경계가 명확하게 나누어져 있어 추후 서비스 확장에 매우 유리합니다.
- **초고도화된 실시간 Pub/Sub 시스템**: `IntentsGateway`와 `RedisService`의 연계가 매우 훌륭합니다. Redis의 Pub/Sub 특성을 이해하고 Publisher와 Subscriber 클라이언트를 독립시켜 Blocking을 예방한 점, 그리고 1만 명 규모의 동시접속 제한 로직(`MAX_CONNECTIONS`) 및 메모리 누수 방지 로직(`onModuleDestroy`)까지 구현된 점은 **엔터프라이즈급 설계**입니다.
- **스마트한 AI 매칭 엔진**: `AiService`를 통해 단순히 텍스트를 던지는 것이 아니라 정교하게 설계된 프롬프트와 컨텍스트 주입 기술을 통해 환각(Hallucination)을 막고, 광고주와 사용자 의도를 스코어링(0~100점)하여 자동화된 매칭을 수행하는 데이터 파이프라인이 창의적이고 실용적입니다.

### 🛡️ 2. Security & Anti-Abuse (보안 및 어뷰징 방어)
- **완벽한 ACID 트랜잭션과 SLA 검증**: 매칭 완료 및 20초 체류 달성 시 발생할 수 있는 포인트 오지급 혹은 데이터 불일치를 Prisma `$transaction`으로 강력하게 보호하고 있습니다.
- **놀라운 프론트엔드 Time-skip 방어 구현**: Next.js의 `sla-visit/page.tsx`에서 단순 `setInterval` 주기 시간에 의존하지 않고 `Date.now() - startTimeRef.current` 기반으로 실제 물리적 시간을 직접 측정하여, 브라우저 탭 비활성화 시 발생하는 타이머 지연 현상과 스로틀링(Throttling)을 완벽히 방어했습니다. 또한 페이지 이탈 시 `keepalive: true` fetch를 사용하는 테크닉도 최신 웹 표준 트렌드가 잘 반영되어 있습니다.
- **reCAPTCHA v3 기반의 검증**: 자동화된 봇 트래픽을 토큰 스코어로 식별하여 무분별한 보상 탈취 알고리즘을 선제적으로 차단하는 설계가 돋보입니다.

### 💡 3. Suggestions for Improvement (추가 개선 제안)
- **[Frontend] 인증 방식의 고도화**: 현재 클라이언트 컴포넌트(`sla-visit` 등)에서 `localStorage.getItem("user_token")`를 직접 참조하여 렌더링 검열 및 API 헤더 주입을 수행 중입니다. 추후 보안(XSS 공격 방어) 및 Next.js 14 App Router 서버 사이드 렌더링(SSR)과의 호환성 극대화를 위해 **HttpOnly / Secure 쿠키** 기반의 세션 관리 방식으로 인증 마이그레이션을 검토해 볼 것을 강력히 권장합니다.
- **[Backend] AI 에러 핸들링 로직 강화**: `AiService` 내 Gemini API 파싱 실패 시 빈 배열 반환 또는 기본 문자열로 폴백(Fallback) 처리되고 있습니다. 의도 파악 프로세스의 견고함(Robustness)을 더욱 높이기 위해, AI 모델의 일시적 장애가 있을 때 처리되는 `Exponential Backoff(지수적 백오프)` 기반의 재시도(Retry) 로직 도입을 추천합니다.
- **[Database] Prisma Index 최적화**: 다수의 컨트롤러 및 서비스에서 `where: { status: 'WAITING_MATCH' }` 혹은 `orderBy: { createdAt: 'desc' }`와 같은 쿼리가 빈번하게 발생하고 있습니다. 사용자의 서비스 이용률이 높아져 데이터가 방대해질 것을 대비해 `schema.prisma`의 `Intent` 모델에 `@@index([status, createdAt])`와 같은 복합 데이터베이스 인덱스를 선언해주면 트래픽 서빙 속도가 폭발적으로 상승할 것입니다.
