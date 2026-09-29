// สูตรคำนวณคะแนนและจัดอันดับ — score-app
// - แต่ละหัวข้อให้คะแนน 0..5, น้ำหนัก % รวม = 100
// - คะแนนกรรมการต่อทีม = Σ (คะแนนหัวข้อ × น้ำหนัก/100) → เต็ม 5
// - คะแนนสุดท้ายของทีม = เฉลี่ยคะแนนจากกรรมการทุกคนที่ให้ครบ

export interface CriterionInput {
  id: string;
  name: string;
  weightPercent: number;
}

export interface ScoreInput {
  judgeId: string;
  competitorId: string;
  criterionId: string;
  value: number;
}

export interface JudgeBreakdown {
  judgeId: string;
  judgeLabel: string;
  perCriterion: Record<string, number>; // criterionId -> value
  weightedTotal: number | null; // null ถ้ายังให้ไม่ครบทุกหัวข้อ
  complete: boolean;
}

export interface CompetitorResult {
  competitorId: string;
  competitorName: string;
  judges: JudgeBreakdown[];
  finalScore: number | null; // เฉลี่ยจากกรรมการที่ให้ครบ
  rank: number | null;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** คะแนนถ่วงน้ำหนักของกรรมการ 1 คนต่อทีม 1 ทีม (ต้องให้ครบทุกหัวข้อ) */
export function weightedJudgeScore(
  criteria: CriterionInput[],
  values: Record<string, number>
): number | null {
  let total = 0;
  for (const c of criteria) {
    const v = values[c.id];
    if (v === undefined || v === null) return null; // ยังให้ไม่ครบ
    total += v * (c.weightPercent / 100);
  }
  return round2(total);
}

/**
 * คำนวณผลรวมของการแข่งขัน: breakdown ต่อกรรมการ/หัวข้อ + คะแนนสุดท้าย + อันดับ
 */
export function computeResults(
  criteria: CriterionInput[],
  competitors: { id: string; name: string }[],
  judges: { id: string; label: string }[],
  scores: ScoreInput[]
): CompetitorResult[] {
  // index: competitorId -> judgeId -> criterionId -> value
  const map = new Map<string, Map<string, Record<string, number>>>();
  for (const s of scores) {
    if (!map.has(s.competitorId)) map.set(s.competitorId, new Map());
    const byJudge = map.get(s.competitorId)!;
    if (!byJudge.has(s.judgeId)) byJudge.set(s.judgeId, {});
    byJudge.get(s.judgeId)![s.criterionId] = s.value;
  }

  const results: CompetitorResult[] = competitors.map((comp) => {
    const byJudge = map.get(comp.id) ?? new Map();
    const judgeBreakdowns: JudgeBreakdown[] = judges.map((j) => {
      const values: Record<string, number> = byJudge.get(j.id) ?? {};
      const weightedTotal = weightedJudgeScore(criteria, values);
      return {
        judgeId: j.id,
        judgeLabel: j.label,
        perCriterion: values,
        weightedTotal,
        complete: weightedTotal !== null,
      };
    });

    const completed = judgeBreakdowns.filter((jb) => jb.complete);
    const finalScore =
      completed.length > 0
        ? round2(
            completed.reduce((sum, jb) => sum + (jb.weightedTotal as number), 0) /
              completed.length
          )
        : null;

    return {
      competitorId: comp.id,
      competitorName: comp.name,
      judges: judgeBreakdowns,
      finalScore,
      rank: null,
    };
  });

  // จัดอันดับ (มากไปน้อย); ทีมที่ยังไม่มีคะแนน (null) อยู่ท้ายสุด ไม่ได้อันดับ
  const ranked = [...results]
    .filter((r) => r.finalScore !== null)
    .sort((a, b) => (b.finalScore as number) - (a.finalScore as number));

  let lastScore: number | null = null;
  let lastRank = 0;
  ranked.forEach((r, idx) => {
    if (lastScore !== null && r.finalScore === lastScore) {
      r.rank = lastRank; // เสมอ = อันดับร่วม
    } else {
      r.rank = idx + 1;
      lastRank = idx + 1;
      lastScore = r.finalScore;
    }
  });

  return results;
}
