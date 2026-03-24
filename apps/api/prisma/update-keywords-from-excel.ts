import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

const STOPWORDS = new Set([
  '방법', '사용', '서비스', '사이트', '정보', '확인', '보기', '가입',
  '무료', '온라인', '모음', '추천', '비교', '검색', '찾기', '문의',
  '안내', '소개', '이용', '관련',
]);

// 이미 수동으로 좋은 키워드를 가진 광고주 (스킵)
const SKIP_COMPANIES = new Set([
  '올리브영', '화해', '글로우픽',
  '롯데렌탈', '쏘카', '제주렌트카', 'AJ렌탈', '그린카',
]);

function buildKeywords(company: string, category: string, keywordSentences: string[]): string[] {
  // 1. 5개 키워드 문장을 공백으로 split → 개별 단어
  const allWords: string[] = [];
  for (const sentence of keywordSentences) {
    if (!sentence) continue;
    const words = sentence.split(/\s+/);
    allWords.push(...words);
  }

  // 2. 필터: 2자 이상, 불용어 제거, 중복 제거
  const filtered: string[] = [];
  const seen = new Set<string>();
  for (const word of allWords) {
    const w = word.trim();
    if (w.length >= 2 && !STOPWORDS.has(w) && !seen.has(w)) {
      seen.add(w);
      filtered.push(w);
    }
  }

  // 3. 최종 키워드: company(1) + category(1) + 필터된 단어, 최대 10개
  const result: string[] = [];
  const resultSeen = new Set<string>();

  const addKw = (kw: string) => {
    const k = kw.trim();
    if (k && !resultSeen.has(k) && result.length < 10) {
      resultSeen.add(k);
      result.push(k);
    }
  };

  addKw(company);
  addKw(category);
  for (const w of filtered) {
    if (result.length >= 10) break;
    addKw(w);
  }

  return result;
}

async function main() {
  const excelPath = path.join(__dirname, '광고주별_추천키워드_최종.xlsx');
  const workbook = XLSX.readFile(excelPath);

  const sheetName = '광고주별 추천 키워드';
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.error(`❌ 시트 "${sheetName}" 를 찾을 수 없습니다.`);
    console.error('사용 가능한 시트:', workbook.SheetNames);
    process.exit(1);
  }

  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`📊 엑셀 행 수: ${rows.length}`);
  if (rows.length > 0) {
    console.log('컬럼 샘플:', Object.keys(rows[0]));
  }

  // 컬럼명 정규화 헬퍼 (공백·BOM·특수문자 포함 가능)
  function getCol(row: any, ...candidates: string[]): string {
    for (const c of candidates) {
      if (row[c] !== undefined && row[c] !== '') return String(row[c]).trim();
    }
    // 부분 일치 fallback
    const keys = Object.keys(row);
    for (const c of candidates) {
      const found = keys.find((k) => k.includes(c));
      if (found && row[found] !== undefined && row[found] !== '') return String(row[found]).trim();
    }
    return '';
  }

  // DB에서 전체 광고주 로드
  const allAdvertisers = await prisma.advertiser.findMany({
    select: { id: true, company: true, siteUrl: true, category: true, keywords: true },
  });

  // company → advertiser 맵, siteUrl → advertiser 맵
  const byCompany = new Map<string, typeof allAdvertisers[0]>();
  const bySiteUrl = new Map<string, typeof allAdvertisers[0]>();
  for (const adv of allAdvertisers) {
    byCompany.set(adv.company.trim(), adv);
    if (adv.siteUrl) {
      const normalUrl = adv.siteUrl.replace(/\/$/, '').toLowerCase();
      bySiteUrl.set(normalUrl, adv);
    }
  }

  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  const notFoundList: string[] = [];

  for (const row of rows) {
    const siteName = getCol(row, '사이트명');
    const url = getCol(row, 'URL');

    if (!siteName && !url) continue;

    // 스킵 대상
    if (SKIP_COMPANIES.has(siteName)) {
      console.log(`⏭️  스킵 (수동 설정): ${siteName}`);
      skipped++;
      continue;
    }

    // DB 매칭: company 우선, 없으면 siteUrl
    let adv = byCompany.get(siteName);
    if (!adv && url) {
      const normalUrl = url.replace(/\/$/, '').toLowerCase();
      adv = bySiteUrl.get(normalUrl);
      // URL 부분 일치 시도
      if (!adv) {
        for (const [dbUrl, dbAdv] of bySiteUrl.entries()) {
          if (normalUrl.includes(dbUrl) || dbUrl.includes(normalUrl)) {
            adv = dbAdv;
            break;
          }
        }
      }
    }

    if (!adv) {
      console.log(`⚠️  매칭 안 됨: "${siteName}" (${url})`);
      notFoundList.push(siteName);
      notFound++;
      continue;
    }

    // 키워드 문장 수집 (추천 키워드 1~5)
    const keywordSentences = [
      getCol(row, '추천 키워드 1', '추천키워드1', '키워드1', '키워드 1'),
      getCol(row, '추천 키워드 2', '추천키워드2', '키워드2', '키워드 2'),
      getCol(row, '추천 키워드 3', '추천키워드3', '키워드3', '키워드 3'),
      getCol(row, '추천 키워드 4', '추천키워드4', '키워드4', '키워드 4'),
      getCol(row, '추천 키워드 5', '추천키워드5', '키워드5', '키워드 5'),
    ].filter(Boolean);

    if (keywordSentences.length === 0) {
      console.log(`⚠️  키워드 없음: "${siteName}"`);
      skipped++;
      continue;
    }

    const newKeywords = buildKeywords(adv.company, adv.category, keywordSentences);
    const oldKeywords = adv.keywords;

    await prisma.advertiser.update({
      where: { id: adv.id },
      data: { keywords: newKeywords },
    });

    console.log(`✅ ${adv.company}: [${oldKeywords.join(', ')}] → [${newKeywords.join(', ')}]`);
    updated++;
  }

  console.log('\n========================================');
  console.log(`✅ 업데이트 완료: ${updated}개`);
  console.log(`⏭️  스킵:        ${skipped}개`);
  console.log(`❌ 매칭 실패:    ${notFound}개`);
  if (notFoundList.length > 0) {
    console.log('\n매칭 실패 목록:');
    notFoundList.forEach((n) => console.log(`  - ${n}`));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
