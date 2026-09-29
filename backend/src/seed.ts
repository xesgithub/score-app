// Seed สำหรับ production (คอมไพล์เป็น dist/seed.js) — idempotent: seed เฉพาะตอน DB ว่าง
import { randomBytes } from 'crypto';
import { prisma } from './prisma';

function token() {
  return randomBytes(24).toString('base64url');
}

async function main() {
  const existing = await prisma.competition.count();
  if (existing > 0) {
    console.log(`seed: มีข้อมูลอยู่แล้ว (${existing} การแข่งขัน) — ข้าม`);
    return;
  }

  const competition = await prisma.competition.create({
    data: {
      name: 'การแข่งขันตัวอย่าง — รอบสาธิต',
      description: 'ข้อมูลตัวอย่างสำหรับ Demo01',
      status: 'open',
      criteria: {
        create: [
          { name: 'Presentation (นำเสนอ + การจัดการเวลา)', weightPercent: 15, displayOrder: 1 },
          { name: 'Flow Design (การออกแบบ Flow)', weightPercent: 20, displayOrder: 2 },
          { name: 'Prompting Techniques', weightPercent: 20, displayOrder: 3 },
          { name: 'ความสมบูรณ์และการทำงานของ challenges', weightPercent: 25, displayOrder: 4 },
          { name: 'Use Case (ประยุกต์อย่างไร)', weightPercent: 20, displayOrder: 5 },
        ],
      },
      competitors: {
        create: [
          { name: 'ทีม A', bibNumber: '1', displayOrder: 1 },
          { name: 'ทีม B', bibNumber: '2', displayOrder: 2 },
          { name: 'ทีม C', bibNumber: '3', displayOrder: 3 },
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
    include: { judges: true },
  });

  console.log('seed: สร้างข้อมูลตัวอย่างเสร็จ');
  for (const j of competition.judges) {
    console.log(`  ${j.label}: /judge?token=${j.accessToken}`);
  }
}

main()
  .catch((e) => {
    console.error('seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
