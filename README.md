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
