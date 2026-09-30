import express, { Router } from 'express';
import { prisma } from '../prisma';
import { generateToken } from '../token';
import { computeResults } from '../scoring';
import { exportCompetition, importCompetition, ImportError } from '../excel';
import { logActivity } from '../activity';

const router = Router();

// ---------- Competitions ----------

// สร้างการแข่งขัน (พร้อมหัวข้อ/ผู้เข้าแข่ง/กรรมการ แบบ optional ในครั้งเดียว)
router.post('/competitions', async (req, res) => {
  const { name, description, eventDate } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }
  const competition = await prisma.competition.create({
    data: {
      name,
      description: description ?? null,
      eventDate: eventDate ? new Date(eventDate) : null,
    },
  });
  res.status(201).json(competition);
});

// list การแข่งขันทั้งหมด
router.get('/competitions', async (_req, res) => {
  const competitions = await prisma.competition.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { competitors: true, judges: true, criteria: true } } },
  });
  res.json(competitions);
});

// รายละเอียดการแข่งขัน
router.get('/competitions/:id', async (req, res) => {
  const competition = await prisma.competition.findUnique({
    where: { id: req.params.id },
    include: {
      criteria: { orderBy: { displayOrder: 'asc' } },
      competitors: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } },
      judges: true,
    },
  });
  if (!competition) return res.status(404).json({ error: 'not found' });
  res.json(competition);
});

// แก้ไข / เปลี่ยนสถานะการแข่งขัน
router.patch('/competitions/:id', async (req, res) => {
  const { name, description, eventDate, status } = req.body;
  if (status && !['draft', 'open', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  // ตรวจน้ำหนักรวม = 100 ก่อนเปิดแข่ง
  if (status === 'open') {
    const criteria = await prisma.criterion.findMany({ where: { competitionId: req.params.id } });
    const totalWeight = criteria.reduce((s, c) => s + c.weightPercent, 0);
    if (criteria.length === 0) {
      return res.status(400).json({ error: 'ต้องมีหัวข้ออย่างน้อย 1 หัวข้อก่อนเปิดแข่ง' });
    }
    if (Math.round(totalWeight * 100) / 100 !== 100) {
      return res.status(400).json({ error: `น้ำหนักรวมต้องเท่ากับ 100% (ปัจจุบัน ${totalWeight}%)` });
    }
  }
  const competition = await prisma.competition.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(eventDate !== undefined ? { eventDate: eventDate ? new Date(eventDate) : null } : {}),
      ...(status !== undefined ? { status } : {}),
    },
  });

  if (status !== undefined) {
    const label: Record<string, string> = { draft: 'ร่าง', open: 'เปิดรับคะแนน', closed: 'ล็อกแล้ว' };
    await logActivity({
      competitionId: competition.id,
      actorType: 'admin',
      actorLabel: 'Admin',
      action: 'competition.status',
      detail: `เปลี่ยนสถานะเป็น "${label[status] ?? status}"`,
      metadata: { status },
    });
  }
  res.json(competition);
});

// ลบการแข่งขัน — อนุญาตเฉพาะเมื่อล็อกแล้ว (closed) กันลบผิดระหว่างแข่ง
router.delete('/competitions/:id', async (req, res) => {
  const competition = await prisma.competition.findUnique({ where: { id: req.params.id } });
  if (!competition) return res.status(404).json({ error: 'not found' });
  if (competition.status !== 'closed') {
    return res.status(409).json({ error: 'ต้องล็อกการแข่งขันก่อนจึงจะลบได้' });
  }
  // criteria/competitors/judges/scores ถูกลบตาม onDelete: Cascade
  await prisma.competition.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// Export เป็น Excel
router.get('/competitions/:id/export', async (req, res) => {
  const out = await exportCompetition(req.params.id);
  if (!out) return res.status(404).json({ error: 'not found' });
  const safeName = out.name.replace(/[\\/:*?"<>|]/g, '_');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="competition.xlsx"; filename*=UTF-8''${encodeURIComponent(safeName)}.xlsx`
  );
  res.send(out.buffer);
});

// Import จาก Excel (body = ไฟล์ .xlsx แบบ raw) → สร้างการแข่งขันใหม่
router.post(
  '/competitions/import',
  express.raw({ type: '*/*', limit: '10mb' }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'ไม่พบไฟล์' });
    }
    try {
      const result = await importCompetition(req.body);
      res.status(201).json(result);
    } catch (e) {
      if (e instanceof ImportError) return res.status(400).json({ error: e.message });
      console.error('import error:', e);
      res.status(500).json({ error: 'นำเข้าไม่สำเร็จ: ' + String((e as Error)?.message ?? e) });
    }
  }
);

// ---------- Criteria ----------

router.post('/competitions/:id/criteria', async (req, res) => {
  const { name, weightPercent, displayOrder } = req.body;
  if (!name || typeof weightPercent !== 'number') {
    return res.status(400).json({ error: 'name และ weightPercent (number) จำเป็น' });
  }
  const criterion = await prisma.criterion.create({
    data: {
      competitionId: req.params.id,
      name,
      weightPercent,
      displayOrder: displayOrder ?? 0,
    },
  });
  res.status(201).json(criterion);
});

router.patch('/criteria/:id', async (req, res) => {
  const { name, weightPercent, displayOrder } = req.body;
  const criterion = await prisma.criterion.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(weightPercent !== undefined ? { weightPercent } : {}),
      ...(displayOrder !== undefined ? { displayOrder } : {}),
    },
  });
  res.json(criterion);
});

router.delete('/criteria/:id', async (req, res) => {
  const c = await prisma.criterion.findUnique({ where: { id: req.params.id } });
  await prisma.criterion.delete({ where: { id: req.params.id } });
  if (c) {
    await logActivity({
      competitionId: c.competitionId,
      actorType: 'admin',
      actorLabel: 'Admin',
      action: 'criterion.delete',
      detail: `ลบหัวข้อ "${c.name}"`,
    });
  }
  res.status(204).end();
});

// ---------- Competitors ----------

router.post('/competitions/:id/competitors', async (req, res) => {
  const { name, bibNumber, note, displayOrder } = req.body;
  if (!name) return res.status(400).json({ error: 'name จำเป็น' });
  const competitor = await prisma.competitor.create({
    data: {
      competitionId: req.params.id,
      name,
      bibNumber: bibNumber ?? null,
      note: note ?? null,
      displayOrder: displayOrder ?? 0,
    },
  });
  res.status(201).json(competitor);
});

router.patch('/competitors/:id', async (req, res) => {
  const { name, bibNumber, note, displayOrder } = req.body;
  const competitor = await prisma.competitor.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(bibNumber !== undefined ? { bibNumber } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(displayOrder !== undefined ? { displayOrder } : {}),
    },
  });
  res.json(competitor);
});

// soft delete
router.delete('/competitors/:id', async (req, res) => {
  const c = await prisma.competitor.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });
  await logActivity({
    competitionId: c.competitionId,
    actorType: 'admin',
    actorLabel: 'Admin',
    action: 'competitor.delete',
    detail: `ลบผู้เข้าแข่ง "${c.bibNumber ? `#${c.bibNumber} ` : ''}${c.name}"`,
  });
  res.status(204).end();
});

// ---------- Judges ----------

router.post('/competitions/:id/judges', async (req, res) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: 'label จำเป็น' });
  const judge = await prisma.judge.create({
    data: {
      competitionId: req.params.id,
      label,
      accessToken: generateToken(),
    },
  });
  res.status(201).json(judge);
});

// แก้ไขชื่อกรรมการ (label)
router.patch('/judges/:id', async (req, res) => {
  const { label } = req.body;
  if (label !== undefined && (typeof label !== 'string' || !label.trim())) {
    return res.status(400).json({ error: 'label ต้องไม่ว่าง' });
  }
  const judge = await prisma.judge.update({
    where: { id: req.params.id },
    data: { ...(label !== undefined ? { label: label.trim() } : {}) },
  });
  res.json(judge);
});

// ดึงลิงก์กรรมการ
router.get('/judges/:id/link', async (req, res) => {
  const judge = await prisma.judge.findUnique({ where: { id: req.params.id } });
  if (!judge) return res.status(404).json({ error: 'not found' });
  // ใช้ APP_BASE_URL ถ้าตั้งไว้; ไม่งั้น derive จาก request (origin เดียวกับ frontend)
  // backend เสิร์ฟทั้ง API และ frontend จาก origin เดียวกัน ลิงก์จึงตรงกับที่ผู้ใช้เปิดอยู่เสมอ
  const base = process.env.APP_BASE_URL ?? `${req.protocol}://${req.get('host')}`;
  res.json({ url: `${base}/judge?token=${judge.accessToken}`, token: judge.accessToken });
});

// สร้าง token ใหม่ (เพิกถอนอันเก่า)
router.post('/judges/:id/revoke-token', async (req, res) => {
  const judge = await prisma.judge.update({
    where: { id: req.params.id },
    data: { accessToken: generateToken(), tokenRevoked: false },
  });
  res.json(judge);
});

// ลบกรรมการ (คะแนนของกรรมการคนนี้ถูกลบตาม onDelete: Cascade)
router.delete('/judges/:id', async (req, res) => {
  const j = await prisma.judge.findUnique({ where: { id: req.params.id } });
  await prisma.judge.delete({ where: { id: req.params.id } });
  if (j) {
    await logActivity({
      competitionId: j.competitionId,
      actorType: 'admin',
      actorLabel: 'Admin',
      action: 'judge.delete',
      detail: `ลบกรรมการ "${j.label}"`,
    });
  }
  res.status(204).end();
});

// logs ทั้งหมดของการแข่งขัน (admin เห็นทุกอย่าง)
router.get('/competitions/:id/logs', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const offset = Number(req.query.offset ?? 0);
  const action = typeof req.query.action === 'string' && req.query.action ? req.query.action : undefined;
  const where = { competitionId: req.params.id, ...(action ? { action } : {}) };
  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: { id: true, actorType: true, actorLabel: true, action: true, detail: true, createdAt: true },
    }),
    prisma.activityLog.count({ where }),
  ]);
  res.json({ logs, total });
});

// ---------- Results / Progress ----------

router.get('/competitions/:id/results', async (req, res) => {
  const competition = await prisma.competition.findUnique({
    where: { id: req.params.id },
    include: {
      criteria: { orderBy: { displayOrder: 'asc' } },
      competitors: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } },
      judges: true,
    },
  });
  if (!competition) return res.status(404).json({ error: 'not found' });

  const scores = await prisma.score.findMany({
    where: { competitor: { competitionId: req.params.id } },
  });

  const results = computeResults(
    competition.criteria.map((c) => ({ id: c.id, name: c.name, weightPercent: c.weightPercent })),
    competition.competitors.map((c) => ({ id: c.id, name: c.name })),
    competition.judges.map((j) => ({ id: j.id, label: j.label })),
    scores.map((s) => ({
      judgeId: s.judgeId,
      competitorId: s.competitorId,
      criterionId: s.criterionId,
      value: s.value,
    }))
  );

  res.json({
    competition: { id: competition.id, name: competition.name, status: competition.status },
    criteria: competition.criteria,
    judges: competition.judges.map((j) => ({ id: j.id, label: j.label })),
    results,
  });
});

// ==================== TEST TOOLS (ถอดออกได้เมื่อจบ phase test) ====================
// เครื่องมือช่วยเทสด่วน: สร้าง/ลบ กรรมการและทีมจำนวนมากเร็ว ๆ
// ลบทั้งบล็อกนี้ + ส่วน TEST TOOLS ใน frontend เพื่อถอดออก

const MAX_BULK = 100;

// สร้างกรรมการหลายคนรวดเดียว (ตั้งชื่อ "กรรมการ N" ต่อจากที่มีอยู่)
router.post('/competitions/:id/judges/bulk', async (req, res) => {
  const count = Math.floor(Number(req.body?.count));
  if (!Number.isFinite(count) || count < 1 || count > MAX_BULK) {
    return res.status(400).json({ error: `count ต้องเป็น 1 - ${MAX_BULK}` });
  }
  const existing = await prisma.judge.count({ where: { competitionId: req.params.id } });
  const data = Array.from({ length: count }, (_, i) => ({
    competitionId: req.params.id,
    label: `กรรมการ ${existing + i + 1}`,
    accessToken: generateToken(),
  }));
  await prisma.judge.createMany({ data });
  await logActivity({
    competitionId: req.params.id,
    actorType: 'admin',
    actorLabel: 'Admin',
    action: 'test.bulk_judges',
    detail: `[TEST] สร้างกรรมการ ${count} คน`,
  });
  res.status(201).json({ created: count });
});

// สร้างทีมหลายทีมรวดเดียว (ตั้งชื่อ "ทีม N" ต่อจากที่มีอยู่)
router.post('/competitions/:id/competitors/bulk', async (req, res) => {
  const count = Math.floor(Number(req.body?.count));
  if (!Number.isFinite(count) || count < 1 || count > MAX_BULK) {
    return res.status(400).json({ error: `count ต้องเป็น 1 - ${MAX_BULK}` });
  }
  const existing = await prisma.competitor.count({ where: { competitionId: req.params.id } });
  const data = Array.from({ length: count }, (_, i) => ({
    competitionId: req.params.id,
    name: `ทีม ${existing + i + 1}`,
    displayOrder: existing + i,
  }));
  await prisma.competitor.createMany({ data });
  await logActivity({
    competitionId: req.params.id,
    actorType: 'admin',
    actorLabel: 'Admin',
    action: 'test.bulk_competitors',
    detail: `[TEST] สร้างทีม ${count} ทีม`,
  });
  res.status(201).json({ created: count });
});

// ลบกรรมการทั้งหมดของการแข่งขัน (คะแนน/lock ลบตาม cascade)
router.delete('/competitions/:id/judges/all', async (req, res) => {
  const r = await prisma.judge.deleteMany({ where: { competitionId: req.params.id } });
  await logActivity({
    competitionId: req.params.id,
    actorType: 'admin',
    actorLabel: 'Admin',
    action: 'test.delete_all_judges',
    detail: `[TEST] ลบกรรมการทั้งหมด (${r.count} คน)`,
  });
  res.json({ deleted: r.count });
});

// ลบทีมทั้งหมดของการแข่งขัน (hard delete — เฉพาะเครื่องมือเทส)
router.delete('/competitions/:id/competitors/all', async (req, res) => {
  const r = await prisma.competitor.deleteMany({ where: { competitionId: req.params.id } });
  await logActivity({
    competitionId: req.params.id,
    actorType: 'admin',
    actorLabel: 'Admin',
    action: 'test.delete_all_competitors',
    detail: `[TEST] ลบทีมทั้งหมด (${r.count} ทีม)`,
  });
  res.json({ deleted: r.count });
});
// ==================== END TEST TOOLS ====================

export default router;
