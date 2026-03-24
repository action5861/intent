/**
 * 플랫폼 전체에서 사용하는 고정 카테고리 목록
 * Intent 파싱 / 광고주 등록 / AI 매칭 모두 이 목록을 기준으로 합니다.
 */
export const CATEGORIES = [
  '전자기기',
  '패션',
  '식품',
  '여행',
  '부동산',
  '금융',
  '보험',
  '자동차',
  '뷰티',
  '교육',
  '의료',
  '법률',
  '쇼핑',
  '비영리',
  '기타',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORIES_STRING = CATEGORIES.join(', ');
