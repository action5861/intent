import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SKIP_COMPANIES = ['올리브영', '화해', '글로우픽'];

const STOPWORDS = new Set([
  '기반', '대형', '국내', '최대', '전문', '서비스', '플랫폼', '운영', '제공',
  '다양한', '온라인', '오프라인', '종합', '전국', '주요', '관련', '통한', '위한',
  '포함', '이상', '이하', '약', '및', '등', '수', '중', '위', '내', '의',
  '에서', '으로', '으로서', '이며', '이다', '있는', '없는', '하는', '되는',
]);

function extractKeywords(company: string, category: string, siteDescription: string | null): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const add = (token: string) => {
    const t = token.trim();
    if (t.length < 2 || t.length > 8) return;
    if (/^\d+$/.test(t)) return;           // 숫자만
    if (/^[a-zA-Z]+$/.test(t)) return;    // 영문만 (브랜드명은 company에서 처리)
    if (STOPWORDS.has(t)) return;
    if (seen.has(t)) return;
    seen.add(t);
    result.push(t);
  };

  // a. company명 첫 번째
  add(company);

  // c. category 추가
  add(category);

  // d. siteDescription split
  if (siteDescription) {
    const tokens = siteDescription
      .split(/[\s,，·\/\n\(\)\[\]\-\|]+/)
      .map(t => t.trim());
    for (const token of tokens) {
      if (result.length >= 7) break;
      add(token);
    }
  }

  return result.slice(0, 7);
}

async function main() {
  const advertisers = await prisma.advertiser.findMany({
    select: { id: true, company: true, category: true, keywords: true, siteDescription: true },
    orderBy: { company: 'asc' },
  });

  console.log(`전체 광고주: ${advertisers.length}개\n`);

  let updated = 0;
  let skippedManual = 0;
  let skippedAlreadyGood = 0;

  for (const adv of advertisers) {
    // 수동 수정된 광고주 스킵
    if (SKIP_COMPANIES.includes(adv.company)) {
      skippedManual++;
      continue;
    }

    // 이미 전부 8자 이하이고 2개 이상이면 스킵
    const alreadyGood = adv.keywords.length >= 2 && adv.keywords.every(k => k.length <= 8);
    if (alreadyGood) {
      skippedAlreadyGood++;
      continue;
    }

    try {
      const newKeywords = extractKeywords(adv.company, adv.category, adv.siteDescription);
      await prisma.advertiser.update({
        where: { id: adv.id },
        data: { keywords: newKeywords },
      });
      console.log(`✅ ${adv.company}`);
      console.log(`   이전: [${adv.keywords.join(', ')}]`);
      console.log(`   이후: [${newKeywords.join(', ')}]`);
      updated++;
    } catch (err: any) {
      console.warn(`⚠️  ${adv.company} 스킵: ${err.message}`);
    }
  }

  console.log(`\n완료!`);
  console.log(`  수정:           ${updated}개`);
  console.log(`  수동수정 스킵:  ${skippedManual}개 (${SKIP_COMPANIES.join(', ')})`);
  console.log(`  정상 스킵:      ${skippedAlreadyGood}개`);
  console.log(`  전체:           ${advertisers.length}개`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
