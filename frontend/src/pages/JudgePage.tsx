import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { judgeApi, type JudgeSession } from '../api';

/** แถวปุ่มคะแนน 0–5 ใช้ซ้ำทั้ง desktop และ mobile
 *  size='sm' สำหรับตาราง desktop, size='lg' สำหรับ card มือถือ (ปุ่มใหญ่กดง่าย) */
function ScoreButtons({
  current,
  onPick,
  size = 'sm',
}: {
  current: number | undefined;
  onPick: (n: number) => void;
  size?: 'sm' | 'lg';
}) {
  const btn =
    size === 'lg'
      ? 'flex-1 h-11 text-base'
      : 'w-7 h-8 text-sm';
  return (
    <div className={`inline-flex rounded-md overflow-hidden border border-gray-300 ${size === 'lg' ? 'w-full' : ''}`}>
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onPick(n)}
          className={`${btn} font-semibold border-r last:border-r-0 border-gray-300 transition ${
            current === n ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-blue-50 active:bg-blue-100'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function JudgePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [session, setSession] = useState<JudgeSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  // scores[competitorId][criterionId] = value
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [saveState, setSaveState] = useState<string>('');
  // locked = การแข่งขันถูกล็อกระหว่างที่กรรมการเปิดหน้าอยู่ (บันทึกโดน 403)
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('ไม่พบ token ในลิงก์');
      return;
    }
    (async () => {
      try {
        const s = await judgeApi.session(token);
        setSession(s);
        setLocked(s.competition.status === 'closed');
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
        const msg = String(e.message ?? '');
        // ตรวจเคสถูกล็อก/ปิดรับคะแนน — แจ้งเตือนให้ชัดและปิดการกรอก
        if (msg.includes('ปิดแล้ว') || msg.includes('เพิกถอน') || msg.includes('403')) {
          setLocked(true);
        }
        setSaveState('บันทึกไม่สำเร็จ: ' + msg);
      }
    },
    [token]
  );

  function setScoreValue(competitorId: string, criterionId: string, value: number) {
    if (locked) return;
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
    <div className="max-w-6xl mx-auto p-3 sm:p-4">
      <h1 className="text-lg font-bold text-gray-700 mb-3">ตารางให้คะแนนของคุณ</h1>

      {/* แบนเนอร์แจ้งเตือนเมื่อถูกล็อกระหว่างเปิดหน้าอยู่ */}
      {locked && (
        <div className="mb-3 bg-red-600 text-white px-4 py-3 rounded-lg shadow">
          <div className="font-bold text-base">🔒 การแข่งขันถูกล็อกแล้ว — กรอก/แก้คะแนนไม่ได้</div>
          <div className="text-sm mt-1 text-red-100">
            กรรมการกลาง (Admin) ได้ปิดรับคะแนนแล้ว คะแนนที่บันทึกไว้ก่อนหน้ายังอยู่ครบ
            หากต้องแก้ไขเพิ่มเติม โปรดติดต่อกรรมการกลางให้ปลดล็อกก่อน
          </div>
        </div>
      )}

      {/* แถบกรรมการ */}
      <div className="bg-gray-50 border rounded-t-lg px-4 py-3 flex items-center gap-3">
        <span className="text-sm text-gray-600">กรรมการ:</span>
        <span className="border rounded px-3 py-1 bg-white font-medium text-sm">
          {session.judge.label}
        </span>
        <span className={`text-sm ml-auto h-5 ${saveState.startsWith('บันทึกไม่สำเร็จ') ? 'text-red-600 font-semibold' : 'text-green-600'}`}>
          {saveState}
        </span>
      </div>

      {/* ตารางให้คะแนน (เดสก์ท็อป) */}
      <div className={`hidden md:block overflow-x-auto border border-t-0 rounded-b-lg bg-white ${locked ? 'opacity-60 pointer-events-none' : ''}`}>
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
                {session.criteria.map((cr) => (
                  <td key={cr.id} className="p-2 border-b border-r text-center">
                    <ScoreButtons
                      current={scores[c.id]?.[cr.id]}
                      onPick={(n) => setScoreValue(c.id, cr.id, n)}
                    />
                  </td>
                ))}
                <td className="p-2 border-b text-center font-bold text-blue-700 font-mono">
                  {total(c.id).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* การ์ดให้คะแนน (มือถือ) — ทีละทีม ปุ่มใหญ่กดง่าย */}
      <div className={`md:hidden border border-t-0 rounded-b-lg bg-white divide-y ${locked ? 'opacity-60 pointer-events-none' : ''}`}>
        {session.competitors.map((c, idx) => (
          <div key={c.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">
                <span className="text-gray-400 mr-1">{idx + 1}.</span>
                {c.bibNumber ? <span className="text-gray-400">#{c.bibNumber} </span> : ''}
                {c.name}
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Total</div>
                <div className="font-bold text-blue-700 font-mono text-lg leading-none">
                  {total(c.id).toFixed(2)}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {session.criteria.map((cr) => (
                <div key={cr.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{cr.name}</span>
                    <span className="text-xs text-blue-600">{cr.weightPercent}% · เต็ม 5</span>
                  </div>
                  <ScoreButtons
                    current={scores[c.id]?.[cr.id]}
                    onPick={(n) => setScoreValue(c.id, cr.id, n)}
                    size="lg"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        กรอกคะแนนแต่ละหัวข้อ 0 – 5 · Total คำนวณถ่วงน้ำหนักอัตโนมัติ · บันทึกทันทีที่แก้ไข
      </p>
    </div>
  );
}
