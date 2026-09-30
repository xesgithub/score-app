import { Router } from 'express';
import { prisma } from '../prisma';
import { logActivity } from '../activity';

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

  const teamLocks = await prisma.teamLock.findMany({
    where: { judgeId: judge.id },
    select: { competitorId: true },
  });

  res.json({
    judge: { id: judge.id, label: judge.label, scoresLockedAt: judge.scoresLockedAt },
    competition: {
      id: competition.id,
      name: competition.name,
      description: competition.description,
      status: competition.status,
    },
    criteria: competition.criteria,
    competitors: competition.competitors,
    lockedCompetitorIds: teamLocks.map((t) => t.competitorId),
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
  // ล็อกระดับกรรมการ (B1) — ถ้ายืนยันคะแนนแล้วต้องขอแก้ไขก่อน
  if (judge.scoresLockedAt) {
    return res.status(409).json({ error: 'คุณยืนยันคะแนนแล้ว หากต้องแก้ไข กรุณากด "ขอแก้ไข" ก่อน' });
  }

  const { competitorId, criterionId, value } = req.body;
  if (!competitorId || !criterionId || typeof value !== 'number') {
    return res.status(400).json({ error: 'competitorId, criterionId, value (number) จำเป็น' });
  }
  if (value < 0 || value > 5) {
    return res.status(400).json({ error: 'คะแนนต้องอยู่ในช่วง 0 - 5' });
  }
  // จำนวนเต็ม 0–5
  const rounded = Math.round(value);

  // ตรวจว่า criterion/competitor อยู่ในการแข่งขันเดียวกับกรรมการ
  const [criterion, competitor, existing] = await Promise.all([
    prisma.criterion.findFirst({ where: { id: criterionId, competitionId: judge.competitionId } }),
    prisma.competitor.findFirst({ where: { id: competitorId, competitionId: judge.competitionId } }),
    prisma.score.findUnique({
      where: { judgeId_competitorId_criterionId: { judgeId: judge.id, competitorId, criterionId } },
    }),
  ]);
  if (!criterion || !competitor) {
    return res.status(400).json({ error: 'หัวข้อหรือผู้เข้าแข่งไม่อยู่ในการแข่งขันนี้' });
  }

  // ล็อกรายทีม — ถ้ากรรมการล็อกทีมนี้ไว้ ต้องปลดก่อนจึงแก้ได้ (กันกดผิด)
  const teamLock = await prisma.teamLock.findUnique({
    where: { judgeId_competitorId: { judgeId: judge.id, competitorId } },
  });
  if (teamLock) {
    return res.status(409).json({ error: 'ทีมนี้ถูกล็อกไว้ กดปลดล็อกทีมก่อนจึงจะแก้คะแนนได้' });
  }

  const prevValue = existing?.value ?? null;

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

  // log เฉพาะเมื่อค่าเปลี่ยนจริง (กัน log ท่วมจาก auto-save)
  if (prevValue !== rounded) {
    const teamName = competitor.bibNumber ? `#${competitor.bibNumber} ${competitor.name}` : competitor.name;
    await logActivity({
      competitionId: judge.competitionId,
      actorType: 'judge',
      actorLabel: judge.label,
      actorJudgeId: judge.id,
      action: 'score.set',
      detail: `ให้คะแนน "${teamName}" · ${criterion.name}: ${prevValue ?? '-'} → ${rounded}`,
      metadata: { competitorId, criterionId, from: prevValue, to: rounded },
    });
  }

  res.json({ competitorId: score.competitorId, criterionId: score.criterionId, value: score.value });
});

// ยืนยัน (ล็อก) คะแนนของกรรมการคนนี้
router.post('/scores/lock', async (req, res) => {
  const judge = await getJudgeByToken(req.query.token);
  if (!judge) return res.status(401).json({ error: 'ลิงก์ไม่ถูกต้องหรือถูกเพิกถอน' });
  if (judge.scoresLockedAt) {
    return res.json({ scoresLockedAt: judge.scoresLockedAt });
  }
  const updated = await prisma.judge.update({
    where: { id: judge.id },
    data: { scoresLockedAt: new Date() },
  });
  await logActivity({
    competitionId: judge.competitionId,
    actorType: 'judge',
    actorLabel: judge.label,
    actorJudgeId: judge.id,
    action: 'score.lock',
    detail: 'ยืนยันคะแนน (ล็อก)',
  });
  res.json({ scoresLockedAt: updated.scoresLockedAt });
});

// ขอแก้ไข (ปลดล็อก) — กรรมการปลดเองได้
router.post('/scores/unlock', async (req, res) => {
  const judge = await getJudgeByToken(req.query.token);
  if (!judge) return res.status(401).json({ error: 'ลิงก์ไม่ถูกต้องหรือถูกเพิกถอน' });
  const competition = await prisma.competition.findUnique({ where: { id: judge.competitionId } });
  if (competition?.status === 'closed') {
    return res.status(403).json({ error: 'การแข่งขันปิดแล้ว ปลดล็อกไม่ได้' });
  }
  if (judge.scoresLockedAt) {
    await prisma.judge.update({ where: { id: judge.id }, data: { scoresLockedAt: null } });
    await logActivity({
      competitionId: judge.competitionId,
      actorType: 'judge',
      actorLabel: judge.label,
      actorJudgeId: judge.id,
      action: 'score.unlock',
      detail: 'ขอแก้ไขคะแนน (ปลดล็อก)',
    });
  }
  res.json({ scoresLockedAt: null });
});

// ล็อกคะแนน "รายทีม" (กันกดผิดระหว่างกรอก)
router.post('/scores/team-lock', async (req, res) => {
  const judge = await getJudgeByToken(req.query.token);
  if (!judge) return res.status(401).json({ error: 'ลิงก์ไม่ถูกต้องหรือถูกเพิกถอน' });
  const { competitorId } = req.body;
  if (!competitorId || typeof competitorId !== 'string') {
    return res.status(400).json({ error: 'competitorId จำเป็น' });
  }
  const competitor = await prisma.competitor.findFirst({
    where: { id: competitorId, competitionId: judge.competitionId },
  });
  if (!competitor) return res.status(400).json({ error: 'ไม่พบทีมในการแข่งขันนี้' });

  await prisma.teamLock.upsert({
    where: { judgeId_competitorId: { judgeId: judge.id, competitorId } },
    update: {},
    create: { judgeId: judge.id, competitorId },
  });
  const teamName = competitor.bibNumber ? `#${competitor.bibNumber} ${competitor.name}` : competitor.name;
  await logActivity({
    competitionId: judge.competitionId,
    actorType: 'judge',
    actorLabel: judge.label,
    actorJudgeId: judge.id,
    action: 'team.lock',
    detail: `ล็อกคะแนนทีม "${teamName}"`,
    metadata: { competitorId },
  });
  res.json({ competitorId, locked: true });
});

// ปลดล็อกคะแนนรายทีม
router.post('/scores/team-unlock', async (req, res) => {
  const judge = await getJudgeByToken(req.query.token);
  if (!judge) return res.status(401).json({ error: 'ลิงก์ไม่ถูกต้องหรือถูกเพิกถอน' });
  const { competitorId } = req.body;
  if (!competitorId || typeof competitorId !== 'string') {
    return res.status(400).json({ error: 'competitorId จำเป็น' });
  }
  const competition = await prisma.competition.findUnique({ where: { id: judge.competitionId } });
  if (competition?.status === 'closed') {
    return res.status(403).json({ error: 'การแข่งขันปิดแล้ว ปลดล็อกไม่ได้' });
  }
  const existing = await prisma.teamLock.findUnique({
    where: { judgeId_competitorId: { judgeId: judge.id, competitorId } },
  });
  if (existing) {
    await prisma.teamLock.delete({ where: { id: existing.id } });
    const competitor = await prisma.competitor.findUnique({ where: { id: competitorId } });
    const teamName = competitor
      ? competitor.bibNumber
        ? `#${competitor.bibNumber} ${competitor.name}`
        : competitor.name
      : competitorId;
    await logActivity({
      competitionId: judge.competitionId,
      actorType: 'judge',
      actorLabel: judge.label,
      actorJudgeId: judge.id,
      action: 'team.unlock',
      detail: `ปลดล็อกคะแนนทีม "${teamName}"`,
      metadata: { competitorId },
    });
  }
  res.json({ competitorId, locked: false });
});

// logs ของกรรมการคนนี้ (เห็นเฉพาะของตัวเอง)
router.get('/logs', async (req, res) => {
  const judge = await getJudgeByToken(req.query.token);
  if (!judge) return res.status(401).json({ error: 'ลิงก์ไม่ถูกต้องหรือถูกเพิกถอน' });
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const where = { competitionId: judge.competitionId, actorJudgeId: judge.id };
  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: { id: true, action: true, detail: true, createdAt: true },
    }),
    prisma.activityLog.count({ where }),
  ]);
  res.json({ logs, total });
});

export default router;
