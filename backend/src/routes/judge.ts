import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

/** helper: หา judge จาก token (ตรวจ revoked ด้วย) */
async function getJudgeByToken(token: unknown) {
  if (!token || typeof token !== 'string') return null;
  const judge = await prisma.judge.findUnique({ where: { accessToken: token } });
  if (!judge || judge.tokenRevoked) return null;
  return judge;
}

// session: ตรวจ token + คืนข้อมูลการแข่งขัน + รายชื่อผู้เข้าแข่ง + หัวข้อ
router.get('/session', async (req, res) => {
  const judge = await getJudgeByToken(req.query.token);
  if (!judge) return res.status(401).json({ error: 'ลิงก์ไม่ถูกต้องหรือถูกเพิกถอน' });

  const competition = await prisma.competition.findUnique({
    where: { id: judge.competitionId },
    include: {
      criteria: { orderBy: { displayOrder: 'asc' } },
      competitors: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } },
    },
  });
  if (!competition) return res.status(404).json({ error: 'ไม่พบการแข่งขัน' });

  res.json({
    judge: { id: judge.id, label: judge.label },
    competition: {
      id: competition.id,
      name: competition.name,
      description: competition.description,
      status: competition.status,
    },
    criteria: competition.criteria,
    competitors: competition.competitors,
  });
});

// scores: คืนเฉพาะคะแนน "ของกรรมการคนนี้" เท่านั้น (privacy)
router.get('/scores', async (req, res) => {
  const judge = await getJudgeByToken(req.query.token);
  if (!judge) return res.status(401).json({ error: 'ลิงก์ไม่ถูกต้องหรือถูกเพิกถอน' });

  const scores = await prisma.score.findMany({
    where: { judgeId: judge.id },
    select: { competitorId: true, criterionId: true, value: true },
  });
  res.json({ scores });
});

// บันทึก/แก้คะแนน 1 ช่อง (auto-save) — upsert
router.put('/scores', async (req, res) => {
  const judge = await getJudgeByToken(req.query.token);
  if (!judge) return res.status(401).json({ error: 'ลิงก์ไม่ถูกต้องหรือถูกเพิกถอน' });

  const competition = await prisma.competition.findUnique({ where: { id: judge.competitionId } });
  if (!competition) return res.status(404).json({ error: 'ไม่พบการแข่งขัน' });
  if (competition.status === 'closed') {
    return res.status(403).json({ error: 'การแข่งขันปิดแล้ว แก้คะแนนไม่ได้' });
  }

  const { competitorId, criterionId, value } = req.body;
  if (!competitorId || !criterionId || typeof value !== 'number') {
    return res.status(400).json({ error: 'competitorId, criterionId, value (number) จำเป็น' });
  }
  if (value < 0 || value > 5) {
    return res.status(400).json({ error: 'คะแนนต้องอยู่ในช่วง 0.00 - 5.00' });
  }
  // ปัดทศนิยม 2 ตำแหน่ง
  const rounded = Math.round(value * 100) / 100;

  // ตรวจว่า criterion/competitor อยู่ในการแข่งขันเดียวกับกรรมการ
  const [criterion, competitor] = await Promise.all([
    prisma.criterion.findFirst({ where: { id: criterionId, competitionId: judge.competitionId } }),
    prisma.competitor.findFirst({ where: { id: competitorId, competitionId: judge.competitionId } }),
  ]);
  if (!criterion || !competitor) {
    return res.status(400).json({ error: 'หัวข้อหรือผู้เข้าแข่งไม่อยู่ในการแข่งขันนี้' });
  }

  const score = await prisma.score.upsert({
    where: {
      judgeId_competitorId_criterionId: {
        judgeId: judge.id,
        competitorId,
        criterionId,
      },
    },
    update: { value: rounded },
    create: { judgeId: judge.id, competitorId, criterionId, value: rounded },
  });

  res.json({ competitorId: score.competitorId, criterionId: score.criterionId, value: score.value });
});

export default router;
