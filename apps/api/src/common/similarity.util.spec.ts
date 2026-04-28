import {
  calcJaccardSimilarity,
  getDuplicatePeriodDays,
  DEFAULT_DUPLICATE_DAYS,
} from './similarity.util';

describe('calcJaccardSimilarity', () => {
  it('완전 동일한 배열 → 1.0', () => {
    expect(calcJaccardSimilarity(['맥북', '프로', '추천'], ['맥북', '프로', '추천'])).toBe(1.0);
  });

  it('완전 다른 배열 → 0.0', () => {
    expect(calcJaccardSimilarity(['맥북', '프로'], ['삼성', '냉장고'])).toBe(0.0);
  });

  it('부분 겹침 통과: 유사도 70% 미만', () => {
    const score = calcJaccardSimilarity(
      ['대만', '여행', '2박3일', '항공권', '숙소'],
      ['뉴욕', '여행', '2박3일', '항공권', '숙소'],
    );
    // 교집합 4 / 합집합 6 = 0.666...
    expect(score).toBeCloseTo(0.667, 2);
    expect(score).toBeLessThan(0.7);
  });

  it('부분 겹침 차단: 유사도 70% 이상', () => {
    const score = calcJaccardSimilarity(
      ['대만', '여행', '2박3일'],
      ['대만', '여행', '2박3일', '패키지'],
    );
    // 교집합 3 / 합집합 4 = 0.75
    expect(score).toBeCloseTo(0.75, 2);
    expect(score).toBeGreaterThanOrEqual(0.7);
  });

  it('보험 종류 다름 → 0.0', () => {
    expect(
      calcJaccardSimilarity(['암보험', '30대', '추천'], ['실손보험', '가족', '가입']),
    ).toBe(0.0);
  });

  it('빈 배열 vs 빈 배열 → 0.0', () => {
    expect(calcJaccardSimilarity([], [])).toBe(0.0);
  });

  it('한쪽만 빈 배열 → 0.0', () => {
    expect(calcJaccardSimilarity(['맥북'], [])).toBe(0.0);
    expect(calcJaccardSimilarity([], ['맥북'])).toBe(0.0);
  });

  it('대소문자 정규화: 동일 단어로 처리 → 1.0', () => {
    expect(calcJaccardSimilarity(['MacBook', 'PRO'], ['macbook', 'pro'])).toBe(1.0);
  });
});

describe('getDuplicatePeriodDays', () => {
  it('"식품" → 7일', () => {
    expect(getDuplicatePeriodDays('식품')).toBe(7);
  });

  it('"뷰티" → 14일', () => {
    expect(getDuplicatePeriodDays('뷰티')).toBe(14);
  });

  it('"전자기기" → 기본값 30일', () => {
    expect(getDuplicatePeriodDays('전자기기')).toBe(DEFAULT_DUPLICATE_DAYS);
  });

  it('"보험" → 기본값 30일', () => {
    expect(getDuplicatePeriodDays('보험')).toBe(DEFAULT_DUPLICATE_DAYS);
  });

  it('"여행" → 기본값 30일', () => {
    expect(getDuplicatePeriodDays('여행')).toBe(DEFAULT_DUPLICATE_DAYS);
  });
});
