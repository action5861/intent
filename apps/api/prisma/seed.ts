import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Admin 계정 생성 (이미 있으면 건너뜀)
  // [배포준비 #3] 프로덕션에서 ADMIN_PASSWORD 미설정 시 시드 거부 — 기본값 하드코딩 제거
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('[배포준비 #3] ADMIN_PASSWORD environment variable must be set before seeding');
  }
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.admin.upsert({
    where: { username: adminUsername },
    update: {},
    create: { username: adminUsername, passwordHash },
  });
  console.log(`✅ Admin created: ${adminUsername} / ${adminPassword}`);

  // 샘플 사용자
  const users = [
    { name: '김민준', email: 'minjun@example.com', status: 'ACTIVE' as const, totalIntents: 23, rewardBalance: 8400 },
    { name: '이서연', email: 'seoyeon@example.com', status: 'ACTIVE' as const, totalIntents: 41, rewardBalance: 15200 },
    { name: '박지호', email: 'jiho@example.com', status: 'SUSPENDED' as const, totalIntents: 7, rewardBalance: 1800 },
    { name: '최예린', email: 'yerin@example.com', status: 'ACTIVE' as const, totalIntents: 58, rewardBalance: 22100 },
    { name: '한도윤', email: 'doyoon@example.com', status: 'ACTIVE' as const, totalIntents: 12, rewardBalance: 4300 },
    { name: '오수아', email: 'sua@example.com', status: 'BANNED' as const, totalIntents: 3, rewardBalance: 0 },
    { name: '강현우', email: 'hyunwoo@example.com', status: 'ACTIVE' as const, totalIntents: 35, rewardBalance: 12700 },
    { name: '윤나은', email: 'naeun@example.com', status: 'ACTIVE' as const, totalIntents: 19, rewardBalance: 6900 },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: u,
      create: u,
    });
  }
  console.log(`✅ ${users.length} users seeded`);

  // 샘플 광고주
  const advertisers = [
    { company: '삼성전자', contactName: '정광현', email: 'kwanghyun@samsung.com', category: '전자제품', totalBudget: 5000000, remainingBudget: 3240000, status: 'ACTIVE' as const, matchCount: 187 },
    { company: 'LG전자', contactName: '박소진', email: 'sojin@lg.com', category: '전자제품', totalBudget: 3000000, remainingBudget: 1870000, status: 'ACTIVE' as const, matchCount: 124 },
    { company: '현대자동차', contactName: '김태양', email: 'taeyang@hyundai.com', category: '자동차', totalBudget: 8000000, remainingBudget: 6100000, status: 'ACTIVE' as const, matchCount: 93 },
    { company: '네이버쇼핑', contactName: '이지우', email: 'jiwoo@naver.com', category: '쇼핑', totalBudget: 2000000, remainingBudget: 450000, status: 'SUSPENDED' as const, matchCount: 312 },
    { company: '쿠팡', contactName: '손민기', email: 'minki@coupang.com', category: '쇼핑', totalBudget: 4500000, remainingBudget: 2900000, status: 'ACTIVE' as const, matchCount: 256 },
    { company: '에어서울', contactName: '유하은', email: 'haeun@airseoul.com', category: '여행', totalBudget: 1500000, remainingBudget: 1500000, status: 'PENDING' as const, matchCount: 0 },
    { company: '배달의민족', contactName: '장우진', email: 'woojin@baemin.com', category: '음식', totalBudget: 2500000, remainingBudget: 1200000, status: 'ACTIVE' as const, matchCount: 441 },
  ];

  for (const a of advertisers) {
    await prisma.advertiser.upsert({
      where: { email: a.email },
      update: a,
      create: a,
    });
  }
  console.log(`✅ ${advertisers.length} advertisers seeded`);

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
