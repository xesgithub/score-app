import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminApi, type ResultsResponse } from '../api';

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    try {
      setData(await adminApi.getResults(id));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return <div className="p-6">กำลังโหลด...</div>;

  // เรียงผลตามอันดับ (ทีมที่ยังไม่มีคะแนนไว้ท้าย)
  const sorted = [...data.results].sort((a, b) => {
    if (a.finalScore === null) return 1;
    if (b.finalScore === null) return -1;
    return b.finalScore - a.finalScore;
  });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">ผลการแข่งขัน — {data.competition.name}</h1>
          <p className="text-sm text-gray-500">สถานะ: {data.competition.status}</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-gray-200 px-3 py-1 rounded text-sm" onClick={load}>
            รีเฟรช
          </button>
          <Link to="/admin" className="bg-blue-600 text-white px-3 py-1 rounded text-sm">
            กลับ Admin
          </Link>
        </div>
      </div>

      {/* ตารางอันดับสรุป */}
      <section className="border rounded-lg p-4 mb-6 bg-white">
        <h2 className="font-semibold mb-3">อันดับ</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 w-16">อันดับ</th>
              <th>ผู้เข้าแข่งขัน</th>
              <th className="text-right">คะแนนสุดท้าย (เต็ม 5)</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.competitorId} className="border-b">
                <td className="py-2 font-bold">{r.rank ?? '-'}</td>
                <td>{r.competitorName}</td>
                <td className="text-right font-mono">
                  {r.finalScore !== null ? r.finalScore.toFixed(2) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* breakdown ต่อกรรมการ/หัวข้อ */}
      <section className="border rounded-lg p-4 bg-white overflow-x-auto">
        <h2 className="font-semibold mb-3">รายละเอียดคะแนน (กรรมการ × หัวข้อ)</h2>
        {sorted.map((r) => (
          <div key={r.competitorId} className="mb-5">
            <h3 className="font-medium mb-1">
              {r.competitorName}{' '}
              {r.finalScore !== null && (
                <span className="text-gray-500 text-sm">
                  — สุดท้าย {r.finalScore.toFixed(2)} (อันดับ {r.rank})
                </span>
              )}
            </h3>
            <table className="w-full text-xs border">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-1 border">กรรมการ</th>
                  {data.criteria.map((c) => (
                    <th key={c.id} className="p-1 border">
                      {c.name} ({c.weightPercent}%)
                    </th>
                  ))}
                  <th className="p-1 border">รวม (ถ่วงน้ำหนัก)</th>
                </tr>
              </thead>
              <tbody>
                {r.judges.map((jb) => (
                  <tr key={jb.judgeId}>
                    <td className="p-1 border">{jb.judgeLabel}</td>
                    {data.criteria.map((c) => (
                      <td key={c.id} className="p-1 border text-center font-mono">
                        {jb.perCriterion[c.id] !== undefined
                          ? jb.perCriterion[c.id].toFixed(2)
                          : '—'}
                      </td>
                    ))}
                    <td className="p-1 border text-center font-mono font-bold">
                      {jb.weightedTotal !== null ? jb.weightedTotal.toFixed(2) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </div>
  );
}
