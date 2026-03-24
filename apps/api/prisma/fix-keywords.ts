import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function extractKeywords(company: string, siteDescription: string | null): string[] {
  const candidates: string[] = [];

  // company명 첫 번째로 추가
  if (company) candidates.push(company.trim());

  // siteDescription을 쉼표·중점·슬래시·줄바꿈으로 split
  if (siteDescription) {
    const parts = siteDescription.split(/[,，·\/\n]/).map((s) => s.trim()).filter((s) => s.length >= 2);
    candidates.push(...parts);
  }

  // 중복 제거 후 최대 5개
  const seen = new Set<string>();
  const result: string[] = [];
  for (const k of candidates) {
    if (!seen.has(k) && result.length < 5) {
      seen.add(k);
      result.push(k);
    }
  }
  return result;
}

async function main() {
  const targets = await prisma.$queryRaw<
    { id: string; company: string; siteDescription: string | null; keywords: string[] }[]
  >`
    SELECT id, company, "siteDescription", keywords
    FROM advertisers
    WHERE category = '기타'
    AND (keywords = '{}' OR array_length(keywords, 1) IS NULL OR array_length(keywords, 1) <= 1)
  `;

  console.log(`대상 광고주: ${targets.length}개\n`);

  let updated = 0;
  for (const adv of targets) {
    const newKeywords = extractKeywords(adv.company, adv.siteDescription);
    await prisma.advertiser.update({ where: { id: adv.id }, data: { keywords: newKeywords } });
    console.log(`✅ ${adv.company}`);
    console.log(`   이전: [${adv.keywords.join(', ')}]`);
    console.log(`   이후: [${newKeywords.join(', ')}]`);
    updated++;
  }

  console.log(`\n완료: ${updated}개 업데이트`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
