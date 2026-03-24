import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

// 실제 엑셀 대분류 → 15개 고정 카테고리 매핑 (엑셀 값 기준으로 수정)
const CATEGORY_MAP: Record<string, string> = {
  'IT·개발':       '전자기기',
  '건강·의료':     '의료',
  '교육·취업':     '교육',
  '금융·경제':     '금융',
  '기타':          '기타',
  '날씨·환경':     '기타',
  '농수축산':      '식품',
  '법률·공공':     '법률',
  '부동산·자동차': '부동산', // 세부 카테고리로 추가 분기 (자동차 → '자동차')
  '소셜·커뮤니티': '기타',
  '쇼핑·커머스':   '쇼핑',
  '스포츠·취미':   '기타',
  '엔터테인먼트':  '기타',
  '여행·교통':     '여행',
  '육아·가족':     '기타',
  '음식·생활':     '식품',
  '패션·뷰티':     '패션', // 세부 카테고리로 추가 분기 (뷰티/화장품 → '뷰티')
  '포털·미디어':   '기타',
};

function mapCategory(mainCategory: string, subCategory: string): string {
  const main = mainCategory?.trim();
  const sub = (subCategory || '').trim();

  // 부동산·자동차: 세부 카테고리 "자동차"이면 자동차, 나머지는 부동산
  if (main === '부동산·자동차') {
    return sub === '자동차' ? '자동차' : '부동산';
  }

  // 패션·뷰티: 세부 카테고리 "뷰티/화장품"이면 뷰티, 문구/스포츠는 기타, 나머지는 패션
  if (main === '패션·뷰티') {
    if (sub === '뷰티/화장품') return '뷰티';
    if (sub === '문구/사무용품' || sub === '스포츠용품') return '기타';
    return '패션';
  }

  // 금융·경제: 세부 카테고리 "보험"이면 보험, 나머지는 금융
  if (main === '금융·경제') {
    return sub === '보험' ? '보험' : '금융';
  }

  return CATEGORY_MAP[main] ?? '기타';
}

// URL에서 이메일 prefix 추출 (서브도메인 포함하여 중복 방지)
// 예: shopping.naver.com → shopping-naver, www.hyundai.co.kr → hyundai
function extractEmailPrefix(siteUrl: string, company: string): string {
  if (siteUrl) {
    try {
      const url = new URL(siteUrl.trim());
      const hostname = url.hostname.replace(/^www\./, '');
      // 다중 TLD 제거 (.co.kr, .com, .kr, .net 등)
      const cleaned = hostname
        .replace(/\.co\.kr$/, '')
        .replace(/\.or\.kr$/, '')
        .replace(/\.ne\.kr$/, '')
        .replace(/\.[a-z]{2,4}$/, ''); // .com, .kr, .net 등 제거
      // 남은 점을 하이픈으로 치환
      const prefix = cleaned.replace(/\./g, '-').toLowerCase();
      if (prefix) return prefix;
    } catch {
      // URL 파싱 실패 시 fallback
    }
  }
  // fallback: company에서 영문/숫자만 추출
  const ascii = company.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return ascii || 'company';
}

// 주요 기능에서 키워드 3~5개 추출
function extractKeywords(mainFeatures: string): string[] {
  if (!mainFeatures) return [];
  const raw = mainFeatures
    .split(/[,，、·\n]/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0 && k.length <= 20);
  return raw.slice(0, 5);
}

async function main() {
  console.log('📂 엑셀 파일 로딩...');

  const filePath = path.join(__dirname, '한국_100대카테고리_광고주_디렉토리.xlsx');
  const workbook = XLSX.readFile(filePath);

  const sheetName = '전체 사이트 목록';
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    const available = workbook.SheetNames.join(', ');
    throw new Error(`시트 "${sheetName}" 없음. 사용 가능한 시트: ${available}`);
  }

  // header: 1 → 전체를 2D 배열로 읽기
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // 헤더는 index 2 (3번째 행), 데이터는 index 3부터
  const headerRow = rows[2];
  console.log('헤더 확인:', headerRow);

  // 컬럼 인덱스 매핑 (헤더명 기반)
  const colIndex: Record<string, number> = {};
  headerRow.forEach((h: any, i: number) => {
    if (h) colIndex[String(h).trim()] = i;
  });

  const COL = {
    mainCategory: colIndex['대분류'] ?? 2,
    subCategory: colIndex['세부 카테고리'] ?? 3,
    company: colIndex['사이트명'] ?? 4,
    url: colIndex['URL'] ?? 5,
    mainFeatures: colIndex['주요 기능'] ?? 6,
  };

  const dataRows = rows.slice(3);
  console.log(`📊 데이터 행 수: ${dataRows.length}`);

  const passwordHash = await bcrypt.hash('advertiser1234!', 12);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 4; // 실제 엑셀 행 번호

    const company = String(row[COL.company] || '').trim();
    const siteUrl = String(row[COL.url] || '').trim();
    const mainCategory = String(row[COL.mainCategory] || '').trim();
    const subCategory = String(row[COL.subCategory] || '').trim();
    const mainFeatures = String(row[COL.mainFeatures] || '').trim();

    // 빈 행 스킵
    if (!company) {
      skipped++;
      continue;
    }

    try {
      const emailPrefix = extractEmailPrefix(siteUrl, company);
      const email = `${emailPrefix}@intendex.com`;
      const category = mapCategory(mainCategory, subCategory);
      const keywords = extractKeywords(mainFeatures);

      const data = {
        company,
        contactName: '담당자',
        email,
        passwordHash,
        category,
        keywords,
        siteUrl: siteUrl || null,
        siteDescription: mainFeatures || null,
        rewardPerVisit: 500,
        totalBudget: 1000000,
        remainingBudget: 1000000,
        status: 'ACTIVE' as const,
      };

      const result = await prisma.advertiser.upsert({
        where: { email },
        update: {
          company: data.company,
          category: data.category,
          keywords: data.keywords,
          siteUrl: data.siteUrl,
          siteDescription: data.siteDescription,
        },
        create: data,
      });

      // upsert 결과로 신규/업데이트 구분
      const isNew = result.joinedAt > new Date(Date.now() - 5000);
      if (isNew) {
        created++;
      } else {
        updated++;
      }

      if ((created + updated) % 10 === 0) {
        console.log(`  진행중... ${created + updated}개 처리 (행 ${rowNum})`);
      }
    } catch (err: any) {
      console.warn(`  ⚠️  행 ${rowNum} (${company}) 스킵: ${err.message}`);
      skipped++;
    }
  }

  console.log('\n✅ 완료!');
  console.log(`  신규 등록: ${created}개`);
  console.log(`  업데이트:  ${updated}개`);
  console.log(`  스킵:      ${skipped}개`);
  console.log(`  총 처리:   ${created + updated + skipped}개 / ${dataRows.length}개`);
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
