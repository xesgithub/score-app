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

  useEffect(() => {
    if (!token) {
      setError('ไม่พบ token ในลิงก์');
      return;
    }
    (async () => {
      try {
        const s = await judgeApi.session(token);
        setSession(s);
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
        setTimeout(() => setSaveState(''), 1200);
      } catch (e: any) {
        setSaveState('บันทึกไม่สำเร็จ: ' + e.message);
      }
    },
    [token]
  );

  function setScoreValue(competitorId: string, criterionId: string, value: number) {
    const v = Math.min(5, Math.max(0, Math.round(value)));
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

  // คะแนนถ่วงน้ำหนักของทีม (Total) — Σ (คะแนนหัวข้อ × น้ำหนัก/100), เต็ม 5
  function total(competitorId: string): number {
    const s = scores[competitorId] ?? {};
    let sum = 0;
    for (const cr of session!.criteria) {
      const v = s[cr.id] ?? 0;
      sum += v * (cr.weightPercent / 100);
    }
    return Math.round(sum * 100) / 100;
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-lg font-bold text-gray-700 mb-3">ตารางให้คะแนนของคุณ</h1>

      {/* แถบกรรมการ */}
      <div className="bg-gray-50 border rounded-t-lg px-4 py-3 flex items-center gap-3">
        <span className="text-sm text-gray-600">กรรมการ:</span>
        <span className="border rounded px-3 py-1 bg-white font-medium text-sm">
          {session.judge.label}
        </span>
        <span className="text-sm text-green-600 ml-auto h-5">{saveState}</span>
      </div>

      {/* ตารางให้คะแนน */}
      <div className="overflow-x-auto border border-t-0 rounded-b-lg bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="p-2 border-b border-r w-14 text-center">No.</th>
              <th className="p-2 border-b border-r text-left min-w-[120px]">Name</th>
              {session.criteria.map((cr) => (
                <th key={cr.id} className="p-2 border-b border-r text-center min-w-[130px]">
                  <div className="font-semibold">{cr.name}</div>
                  <div className="text-xs text-blue-600 font-normal mt-1">
                    {cr.weightPercent}% · เต็ม 5
                  </div>
                </th>
              ))}
              <th className="p-2 border-b text-center min-w-[90px]">
                <div className="font-bold">Total</div>
                <div className="text-xs text-gray-400 font-normal">(เต็ม 5)</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {session.competitors.map((c, idx) => (
              <tr key={c.id} className="hover:bg-blue-50/40">
                <td className="p-2 border-b border-r text-center text-gray-600">{idx + 1}</td>
                <td className="p-2 border-b border-r font-medium">
                  {c.bibNumber ? <span className="text-gray-400">#{c.bibNumber} </span> : ''}
                  {c.name}
                </td>
                {session.criteria.map((cr) => {
                  const current = scores[c.id]?.[cr.id];
                  return (
                    <td key={cr.id} className="p-2 border-b border-r text-center">
                      <div className="inline-flex rounded-md overflow-hidden border border-gray-300">
                        {[0, 1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            onClick={() => setScoreValue(c.id, cr.id, n)}
                            className={`w-7 h-8 text-sm font-semibold border-r last:border-r-0 border-gray-300 transition ${
                              current === n
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-600 hover:bg-blue-50'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </td>
                  );
                })}
                <td className="p-2 border-b text-center font-bold text-blue-700 font-mono">
                  {total(c.id).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        กรอกคะแนนแต่ละหัวข้อ 0 – 5 · Total คำนวณถ่วงน้ำหนักอัตโนมัติ · บันทึกทันทีที่แก้ไข
      </p>
    </div>
  );
}
