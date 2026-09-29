import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { judgeApi, type JudgeSession } from '../api';

export default function JudgePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [session, setSession] = useState<JudgeSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  // scores[competitorId][criterionId] = value
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [saveState, setSaveState] = useState<string>('');
  const [activeCompetitor, setActiveCompetitor] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('ไม่พบ token ในลิงก์');
      return;
    }
    (async () => {
      try {
        const s = await judgeApi.session(token);
        setSession(s);
        setActiveCompetitor(s.competitors[0]?.id ?? null);
        const existing = await judgeApi.getScores(token);
        const map: Record<string, Record<string, number>> = {};
        for (const sc of existing.scores) {
          if (!map[sc.competitorId]) map[sc.competitorId] = {};
          map[sc.competitorId][sc.criterionId] = sc.value;
        }
        setScores(map);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [token]);

  const save = useCallback(
    async (competitorId: string, criterionId: string, value: number) => {
      setSaveState('กำลังบันทึก...');
      try {
        await judgeApi.saveScore(token, { competitorId, criterionId, value });
        setSaveState('บันทึกแล้ว ✓');
        setTimeout(() => setSaveState(''), 1500);
      } catch (e: any) {
        setSaveState('บันทึกไม่สำเร็จ: ' + e.message);
      }
    },
    [token]
  );

  function setScore(competitorId: string, criterionId: string, raw: string) {
    let v = parseFloat(raw);
    if (isNaN(v)) return;
    v = Math.min(5, Math.max(0, Math.round(v * 100) / 100));
    setScores((prev) => ({
      ...prev,
      [competitorId]: { ...(prev[competitorId] ?? {}), [criterionId]: v },
    }));
    save(competitorId, criterionId, v);
  }

  if (error) return <div className="p-6 text-red-600 max-w-lg mx-auto">{error}</div>;
  if (!session) return <div className="p-6">กำลังโหลด...</div>;

  if (session.competition.status === 'closed') {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <h1 className="text-xl font-bold mb-2">{session.competition.name}</h1>
        <p className="text-gray-600">การแข่งขันปิดแล้ว ไม่สามารถให้คะแนนได้</p>
      </div>
    );
  }

  const active = session.competitors.find((c) => c.id === activeCompetitor);

  // นับความครบของแต่ละทีม (ของกรรมการคนนี้)
  function isComplete(competitorId: string) {
    const s = scores[competitorId] ?? {};
    return session!.criteria.every((c) => s[c.id] !== undefined);
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold">{session.competition.name}</h1>
        <p className="text-sm text-gray-500">
          กรรมการ: <span className="font-medium">{session.judge.label}</span>
        </p>
      </div>

      {/* เลือกทีม */}
      <div className="flex flex-wrap gap-2 mb-4">
        {session.competitors.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCompetitor(c.id)}
            className={`px-3 py-1 rounded border text-sm ${
              activeCompetitor === c.id ? 'bg-blue-600 text-white' : 'bg-white'
            }`}
          >
            {isComplete(c.id) ? '✓ ' : ''}
            {c.bibNumber ? `#${c.bibNumber} ` : ''}
            {c.name}
          </button>
        ))}
      </div>

      {active && (
        <div className="border rounded-lg p-4 bg-white">
          <h2 className="font-semibold mb-3">
            ให้คะแนน: {active.bibNumber ? `#${active.bibNumber} ` : ''}
            {active.name}
          </h2>
          <div className="space-y-3">
            {session.criteria.map((cr) => (
              <div key={cr.id} className="flex items-center justify-between gap-3">
                <label className="text-sm flex-1">
                  {cr.name} <span className="text-gray-400">({cr.weightPercent}%)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.01}
                  className="border rounded px-3 py-2 w-24 text-right"
                  value={scores[active.id]?.[cr.id] ?? ''}
                  onChange={(e) => setScore(active.id, cr.id, e.target.value)}
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">คะแนนแต่ละหัวข้อ 0.00 – 5.00 · บันทึกอัตโนมัติ</p>
          <p className="text-sm text-green-600 h-5 mt-1">{saveState}</p>
        </div>
      )}
    </div>
  );
}
