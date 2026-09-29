// Export / Import การแข่งขันเป็นไฟล์ Excel (.xlsx)
//
// โครงสร้างไฟล์:
//   "ข้อมูล"          ชื่อ/คำอธิบาย/สถานะ          (ใช้ตอน import)
//   "หัวข้อ"          ลำดับ | หัวข้อ | น้ำหนัก %      (ใช้ตอน import)
//   "ผู้เข้าแข่งขัน"   No. | หมายเลข | ชื่อ             (ใช้ตอน import)
//   "สรุปผล"          อันดับ + คะแนนรวมรายกรรมการ + คะแนนสุดท้าย (อ่านอย่างเดียว)
//   "คะแนน N"         ตารางคะแนนของกรรมการคนที่ N (A1:B1 = ชื่อกรรมการ) (ใช้ตอน import)
import ExcelJS from 'exceljs';
import { prisma } from './prisma';
import { generateToken } from './token';
import { computeResults } from './scoring';

const SHEET_INFO = 'ข้อมูล';
const SHEET_CRITERIA = 'หัวข้อ';
const SHEET_COMPETITORS = 'ผู้เข้าแข่งขัน';
const SHEET_SUMMARY = 'สรุปผล';
const JUDGE_SHEET_PREFIX = 'คะแนน ';

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.eachCell((c) => (c.fill = HEADER_FILL));
}

/** แปลงค่า cell (ที่อาจเป็น formula/rich text) เป็น string */
function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue);
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return String(v.text);
    if (v instanceof Date) return v.toISOString();
  }
  return String(v).trim();
}

function cellNumber(v: ExcelJS.CellValue): number | null {
  const s = cellText(v);
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** column letter จาก index (1 = A) */
function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ---------------------------------------------------------------- Export

export async function exportCompetition(competitionId: string): Promise<{ buffer: Buffer; name: string } | null> {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      criteria: { orderBy: { displayOrder: 'asc' } },
      competitors: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } },
      judges: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!competition) return null;

  const scores = await prisma.score.findMany({
    where: { competitor: { competitionId } },
  });
  const { criteria, competitors, judges } = competition;

  const results = computeResults(
    criteria.map((c) => ({ id: c.id, name: c.name, weightPercent: c.weightPercent })),
    competitors.map((c) => ({ id: c.id, name: c.name })),
    judges.map((j) => ({ id: j.id, label: j.label })),
    scores
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = 'score-app';
  wb.created = new Date();
  // บังคับให้ Excel คำนวณสูตรใหม่ทั้งหมดตอนเปิด
  wb.calcProperties = { fullCalcOnLoad: true };

  // --- ข้อมูล
  const info = wb.addWorksheet(SHEET_INFO);
  info.columns = [{ width: 20 }, { width: 50 }];
  info.addRow(['ชื่อการแข่งขัน', competition.name]);
  info.addRow(['คำอธิบาย', competition.description ?? '']);
  info.addRow(['สถานะ', competition.status]);
  info.addRow(['ส่งออกเมื่อ', new Date().toISOString()]);
  info.getColumn(1).font = { bold: true };

  // --- หัวข้อ
  const critSheet = wb.addWorksheet(SHEET_CRITERIA);
  critSheet.columns = [{ width: 8 }, { width: 50 }, { width: 12 }];
  styleHeader(critSheet.addRow(['ลำดับ', 'หัวข้อ', 'น้ำหนัก %']));
  criteria.forEach((c, i) => critSheet.addRow([i + 1, c.name, c.weightPercent]));

  // --- ผู้เข้าแข่งขัน
  const compSheet = wb.addWorksheet(SHEET_COMPETITORS);
  compSheet.columns = [{ width: 8 }, { width: 12 }, { width: 40 }];
  styleHeader(compSheet.addRow(['No.', 'หมายเลข', 'ชื่อ']));
  competitors.forEach((c, i) => compSheet.addRow([i + 1, c.bibNumber ?? '', c.name]));

  // --- สรุปผล (เรียงตามอันดับ)
  const summary = wb.addWorksheet(SHEET_SUMMARY);
  styleHeader(summary.addRow(['อันดับ', 'หมายเลข', 'ชื่อ', ...judges.map((j) => j.label), 'คะแนนสุดท้าย (เต็ม 5)']));
  summary.columns = [
    { width: 8 },
    { width: 10 },
    { width: 32 },
    ...judges.map(() => ({ width: 14 })),
    { width: 18 },
  ];
  const bibById = new Map(competitors.map((c) => [c.id, c.bibNumber ?? '']));
  const sorted = [...results].sort((a, b) => {
    if (a.finalScore === null) return 1;
    if (b.finalScore === null) return -1;
    return b.finalScore - a.finalScore;
  });
  for (const r of sorted) {
    summary.addRow([
      r.rank ?? '-',
      bibById.get(r.competitorId) ?? '',
      r.competitorName,
      ...r.judges.map((jb) => jb.weightedTotal ?? '-'),
      r.finalScore ?? '-',
    ]);
  }

  // --- คะแนนรายกรรมการ (layout เหมือนตารางกรอกคะแนน)
  const scoreMap = new Map<string, number>(); // judge|competitor|criterion -> value
  for (const s of scores) scoreMap.set(`${s.judgeId}|${s.competitorId}|${s.criterionId}`, s.value);

  judges.forEach((j, ji) => {
    const ws = wb.addWorksheet(`${JUDGE_SHEET_PREFIX}${ji + 1}`);
    ws.addRow(['กรรมการ:', j.label]).font = { bold: true };
    styleHeader(
      ws.addRow([
        'No.',
        'หมายเลข',
        'Name',
        ...criteria.map((c) => `${c.name}\n${c.weightPercent}% · เต็ม 5`),
        'Total (เต็ม 5)',
      ])
    );
    ws.getRow(2).height = 45;
    ws.columns = [{ width: 6 }, { width: 10 }, { width: 28 }, ...criteria.map(() => ({ width: 18 })), { width: 14 }];

    competitors.forEach((c, ci) => {
      const values = criteria.map((cr) => scoreMap.get(`${j.id}|${c.id}|${cr.id}`) ?? null);
      const rowNum = ci + 3;
      // Total เป็นสูตร เพื่อให้คำนวณใหม่ได้เมื่อแก้ใน Excel
      const formula =
        'ROUND(' +
        criteria.map((cr, k) => `N(${colLetter(4 + k)}${rowNum})*${cr.weightPercent / 100}`).join('+') +
        ',2)';
      const result = Math.round(values.reduce<number>((s, v, k) => s + (v ?? 0) * (criteria[k].weightPercent / 100), 0) * 100) / 100;
      ws.addRow([ci + 1, c.bibNumber ?? '', c.name, ...values, { formula, result: result as number, date1904: false } as ExcelJS.CellFormulaValue]);
    });
  });

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, name: competition.name };
}

// ---------------------------------------------------------------- Import

export class ImportError extends Error {}

/** นำเข้าไฟล์ Excel ที่ export จากระบบ → สร้างเป็นการแข่งขันใหม่ (ไม่เขียนทับของเดิม) */
export async function importCompetition(fileBuffer: Buffer): Promise<{ id: string; name: string; scoreCount: number }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(fileBuffer as unknown as ArrayBuffer);
  } catch {
    throw new ImportError('ไฟล์ไม่ใช่ Excel (.xlsx) ที่อ่านได้');
  }

  const info = wb.getWorksheet(SHEET_INFO);
  const critSheet = wb.getWorksheet(SHEET_CRITERIA);
  const compSheet = wb.getWorksheet(SHEET_COMPETITORS);
  if (!info || !critSheet || !compSheet) {
    throw new ImportError(`ไม่พบชีต "${SHEET_INFO}", "${SHEET_CRITERIA}" หรือ "${SHEET_COMPETITORS}" — ต้องใช้ไฟล์ที่ export จากระบบ`);
  }

  // ข้อมูล
  const name = cellText(info.getCell('B1').value);
  if (!name) throw new ImportError('ชีต "ข้อมูล": ไม่มีชื่อการแข่งขัน (B1)');
  const description = cellText(info.getCell('B2').value) || null;
  const statusRaw = cellText(info.getCell('B3').value);
  const status = ['draft', 'open', 'closed'].includes(statusRaw) ? statusRaw : 'closed';

  // หัวข้อ (ตามลำดับแถว)
  const criteria: { name: string; weightPercent: number }[] = [];
  critSheet.eachRow((row, i) => {
    if (i === 1) return;
    const cName = cellText(row.getCell(2).value);
    if (!cName) return;
    const w = cellNumber(row.getCell(3).value);
    if (w === null || w < 0) throw new ImportError(`ชีต "หัวข้อ" แถว ${i}: น้ำหนักไม่ถูกต้อง`);
    criteria.push({ name: cName, weightPercent: w });
  });
  if (criteria.length === 0) throw new ImportError('ชีต "หัวข้อ": ไม่มีหัวข้อ');

  // ผู้เข้าแข่งขัน: No. -> ข้อมูล
  const competitors: { no: number; bib: string | null; name: string }[] = [];
  compSheet.eachRow((row, i) => {
    if (i === 1) return;
    const cName = cellText(row.getCell(3).value);
    if (!cName) return;
    const no = cellNumber(row.getCell(1).value) ?? competitors.length + 1;
    competitors.push({ no, bib: cellText(row.getCell(2).value) || null, name: cName });
  });

  // คะแนนรายกรรมการ
  const judgeSheets = wb.worksheets.filter((ws) => ws.name.startsWith(JUDGE_SHEET_PREFIX));
  const judges: { label: string; scores: { competitorNo: number; criterionIdx: number; value: number }[] }[] = [];
  for (const ws of judgeSheets) {
    const label = cellText(ws.getCell('B1').value) || ws.name;
    const judgeScores: { competitorNo: number; criterionIdx: number; value: number }[] = [];
    ws.eachRow((row, i) => {
      if (i <= 2) return; // แถว 1 = ชื่อกรรมการ, แถว 2 = header
      const no = cellNumber(row.getCell(1).value);
      if (no === null) return;
      criteria.forEach((_c, k) => {
        const v = cellNumber(row.getCell(4 + k).value);
        if (v === null) return;
        if (!Number.isInteger(v) || v < 0 || v > 5) {
          throw new ImportError(`ชีต "${ws.name}" แถว ${i}: คะแนน "${v}" ต้องเป็นจำนวนเต็ม 0-5`);
        }
        judgeScores.push({ competitorNo: no, criterionIdx: k, value: v });
      });
    });
    judges.push({ label, scores: judgeScores });
  }

  // บันทึกทั้งหมดใน transaction เดียว (ถ้าพังกลางทาง ไม่เหลือข้อมูลครึ่งๆ)
  return prisma.$transaction(async (tx) => {
    const comp = await tx.competition.create({
      data: { name, description, status },
    });
    const createdCriteria = [];
    for (const [i, c] of criteria.entries()) {
      createdCriteria.push(
        await tx.criterion.create({
          data: { competitionId: comp.id, name: c.name, weightPercent: c.weightPercent, displayOrder: i + 1 },
        })
      );
    }
    const competitorByNo = new Map<number, string>();
    for (const [i, c] of competitors.entries()) {
      const created = await tx.competitor.create({
        data: { competitionId: comp.id, name: c.name, bibNumber: c.bib, displayOrder: i + 1 },
      });
      competitorByNo.set(c.no, created.id);
    }
    let scoreCount = 0;
    for (const j of judges) {
      const judge = await tx.judge.create({
        data: { competitionId: comp.id, label: j.label, accessToken: generateToken() },
      });
      for (const s of j.scores) {
        const competitorId = competitorByNo.get(s.competitorNo);
        if (!competitorId) continue; // แถวที่ไม่มีในชีตผู้เข้าแข่งขัน
        await tx.score.create({
          data: {
            judgeId: judge.id,
            competitorId,
            criterionId: createdCriteria[s.criterionIdx].id,
            value: s.value,
          },
        });
        scoreCount++;
      }
    }
    return { id: comp.id, name: comp.name, scoreCount };
  }, { timeout: 30000 });
}
