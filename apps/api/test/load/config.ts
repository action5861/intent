/** 부하 테스트 공통 설정 */

export const BASE_URL = 'http://localhost:4000';
export const WS_URL  = 'http://localhost:4000';

/** 테스트 단계 정의 */
export const PHASES = [
  { label: '워밍업',       connections:   50, duration:  10 },
  { label: '중간 부하',    connections:  500, duration:  20 },
  { label: '고부하',       connections: 1000, duration:  20 },
  { label: '스파이크',     connections: 2000, duration:  10 },
  { label: '냉각',         connections:  200, duration:  10 },
] as const;

/** 사전 생성할 테스트 계정 수 */
export const PRELOAD_USER_COUNT = 100;

/** WebSocket 동시 연결 목표 */
export const WS_TARGET_CONNECTIONS = [50, 200, 500, 1000];

/** Rate limit 체크 반복 수 */
export const RATE_LIMIT_REQS = 20;

export const ADMIN_CRED = { username: 'admin', password: 'admin1234!' };

export const TEST_ADVERTISER = {
  company:        '부하테스트전자',
  contactName:    '부하테스트담당자',
  email:          `load-adv-${Date.now()}@loadtest.dev`,
  password:       'LoadTest1234!',
  category:       '전자기기',
  keywords:       ['스마트폰', '노트북', '태블릿'],
  siteUrl:        'https://loadtest-electronics.example.com',
  siteDescription: '부하 테스트용 전자기기 쇼핑몰입니다.',
  rewardPerVisit:  800,
  totalBudget:     9_999_999,
};
