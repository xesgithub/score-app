import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

function token() {
  return randomBytes(24).toString('base64url');
}

async function main() {
  // ล้างข้อมูลเดิม (dev เท่านั้น)
  await prisma.score.deleteMany();
  await prisma.judge.deleteMany();
  await prisma.competitor.deleteMany();
  await prisma.criterion.deleteMany();
  await prisma.competition.deleteMany();

  const competition = await prisma.competition.create({
    data: {
      name: 'การแข่งขันตัวอย่าง — รอบสาธิต',
      description: 'ข้อมูลตัวอย่างสำหรับ Demo01',
      status: 'open',
      criteria: {
        create: [
          { name: 'ความคิดสร้างสรรค์', weightPercent: 20, displayOrder: 1 },
          { name: 'การนำเสนอ', weightPercent: 20, displayOrder: 2 },
          { name: 'ความสมบูรณ์ของงาน', weightPercent: 30, displayOrder: 3 },
          { name: 'การตอบคำถาม', weightPercent: 30, displayOrder: 4 },
        ],
      },
      competitors: {
        create: [
          { name: 'ทีม A', bibNumber: '01', displayOrder: 1 },
          { name: 'ทีม B', bibNumber: '02', displayOrder: 2 },
          { name: 'ทีม C', bibNumber: '03', displayOrder: 3 },
        ],
      },
      judges: {
        create: [
          { label: 'กรรมการ 1', accessToken: token() },
          { label: 'กรรมการ 2', accessToken: token() },
          { label: 'กรรมการ 3', accessToken: token() },
        ],
      },
    },
    include: { judges: true, criteria: true, competitors: true },
  });

  const base = process.env.APP_BASE_URL ?? 'http://localhost:5173';
  console.log('\n=== Seed เสร็จสิ้น ===');
  console.log(`การแข่งขัน: ${competition.name} (id=${competition.id})`);
  console.log('\nลิงก์กรรมการ (แจกให้กรรมการแต่ละคน):');
  for (const j of competition.judges) {
    console.log(`  ${j.label}: ${base}/judge?token=${j.accessToken}`);
  }
  console.log(`\nหน้า Admin: ${base}/admin`);
  console.log(`Competition ID สำหรับดูผล: ${competition.id}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
