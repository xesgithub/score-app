import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { judgeApi, type JudgeSession, type JudgeLog } from '../api';

/** แถวปุ่มคะแนน 0–5 ใช้ซ้ำทั้ง desktop และ mobile
 *  size='sm' สำหรับตาราง desktop, size='lg' สำหรับ card มือถือ (ปุ่มใหญ่กดง่าย) */
function ScoreButtons({
  current,
  onPick,
  size = 'sm',
  disabled = false,
}: {
  current: number | undefined;
  onPick: (n: number) => void;
  size?: 'sm' | 'lg';
  disabled?: boolean;
}) {
  const btn = size === 'lg' ? 'flex-1 h-11 text-base' : 'w-7 h-8 text-sm';
  return (
    <div className={`inline-flex rounded-md overflow-hidden border border-slate-300 shadow-sm ${size === 'lg' ? 'w-full' : ''}`}>
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          disabled={disabled}
          onClick={() => onPick(n)}
          className={`${btn} font-semibold border-r last:border-r-0 border-slate-300 transition ${
            current === n
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-slate-600 hover:bg-indigo-50 active:bg-indigo-100'
          } disabled:opacity-50`}
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
  // locked = การแข่งขันถูกล็อกทั้งงาน (admin ปิด)
  const [locked, setLocked] = useState(false);
  // confirmed = กรรมการยืนยันคะแนนทั้งชุดแล้ว (ขั้นสุดท้าย)
  const [confirmed, setConfirmed] = useState(false);
  // lockedTeams = เซ็ตของ competitorId ที่กรรมการล็อกไว้รายทีม
  const [lockedTeams, setLockedTeams] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  // ประวัติการให้คะแนนของฉัน
  const [showMyLog, setShowMyLog] = useState(false);
  const [myLogs, setMyLogs] = useState<JudgeLog[]>([]);
  const showMyLogRef = useRef(false);

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
        setConfirmed(!!s.judge.scoresLockedAt);
        setLockedTeams(new Set(s.lockedCompetitorIds ?? []));
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

  const refreshMyLogs = useCallback(async () => {
    try {
      const r = await judgeApi.getLogs(token, { limit: 100 });
      setMyLogs(r.logs);
    } catch {
      /* เงียบไว้ ไม่ให้กระทบการให้คะแนน */
    }
  }, [token]);

  const save = useCallback(
    async (competitorId: string, criterionId: string, value: number) => {
      setSaveState('กำลังบันทึก...');
      try {
        await judgeApi.saveScore(token, { competitorId, criterionId, value });
        setSaveState('บันทึกแล้ว ✓');
        setTimeout(() => setSaveState(''), 1200);
        // auto-refresh ประวัติถ้ากำลังเปิดดูอยู่ (แก้บั๊กประวัติไม่ขึ้นทันที)
        if (showMyLogRef.current) refreshMyLogs();
      } catch (e: any) {
        const msg = String(e.message ?? '');
        if (msg.includes('ปิดแล้ว') || msg.includes('เพิกถอน') || msg.includes('403')) {
          setLocked(true);
        }
        if (msg.includes('ยืนยันคะแนนแล้ว')) setConfirmed(true);
        if (msg.includes('ทีมนี้ถูกล็อก')) {
          setLockedTeams((prev) => new Set(prev).add(competitorId));
        }
        setSaveState('บันทึกไม่สำเร็จ: ' + msg);
      }
    },
    [token, refreshMyLogs]
  );

  function setScoreValue(competitorId: string, criterionId: string, value: number) {
    if (locked || confirmed || lockedTeams.has(competitorId)) return;
    const v = Math.min(5, Math.max(0, Math.round(value)));
    setScores((prev) => ({
      ...prev,
      [competitorId]: { ...(prev[competitorId] ?? {}), [criterionId]: v },
    }));
    save(competitorId, criterionId, v);
  }

  async function toggleTeamLock(competitorId: string) {
    const isLocked = lockedTeams.has(competitorId);
    setBusy(true);
    try {
      if (isLocked) {
        await judgeApi.unlockTeam(token, competitorId);
        setLockedTeams((prev) => {
          const next = new Set(prev);
          next.delete(competitorId);
          return next;
        });
      } else {
        await judgeApi.lockTeam(token, competitorId);
        setLockedTeams((prev) => new Set(prev).add(competitorId));
      }
      if (showMyLogRef.current) refreshMyLogs();
    } catch (e: any) {
      setSaveState('ดำเนินการไม่สำเร็จ: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLock() {
    if (!confirm('ยืนยันคะแนนทั้งหมด? หลังยืนยันจะแก้ไขไม่ได้จนกว่าจะกด "ขอแก้ไข"')) return;
    setBusy(true);
    try {
      await judgeApi.lockScores(token);
      setConfirmed(true);
      setSaveState('ยืนยันคะแนนแล้ว ✓');
      if (showMyLogRef.current) refreshMyLogs();
    } catch (e: any) {
      setSaveState('ยืนยันไม่สำเร็จ: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock() {
    setBusy(true);
    try {
      await judgeApi.unlockScores(token);
      setConfirmed(false);
      setSaveState('ปลดล็อกแล้ว — แก้ไขคะแนนต่อได้');
      if (showMyLogRef.current) refreshMyLogs();
    } catch (e: any) {
      setSaveState('ขอแก้ไขไม่สำเร็จ: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleMyLog() {
    const next = !showMyLog;
    setShowMyLog(next);
    showMyLogRef.current = next;
    if (next) refreshMyLogs();
  }

  if (error) return <div className="p-6 text-red-600 max-w-lg mx-auto">{error}</div>;
  if (!session)
    return <div className="p-6 text-slate-500">กำลังโหลด...</div>;

  if (session.competition.status === 'closed') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg mx-auto text-center bg-white rounded-xl shadow p-8 border-t-4 border-orange-500">
          <div className="text-4xl mb-2">🔒</div>
          <h1 className="text-xl font-bold mb-2 text-slate-800">{session.competition.name}</h1>
          <p className="text-slate-600">การแข่งขันปิดแล้ว ไม่สามารถให้คะแนนได้</p>
        </div>
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

  const disabledAll = locked || confirmed;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-slate-100">
      <div className="max-w-6xl mx-auto p-3 sm:p-4">
        <h1 className="text-lg font-bold text-slate-800 mb-3">ตารางให้คะแนนของคุณ</h1>

        {/* แบนเนอร์แจ้งเตือนเมื่อถูกล็อกทั้งงาน */}
        {locked && (
          <div className="mb-3 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg">
            <div className="font-bold text-base">🔒 การแข่งขันถูกล็อกแล้ว — กรอก/แก้คะแนนไม่ได้</div>
            <div className="text-sm mt-1 text-red-100">
              กรรมการกลาง (Admin) ได้ปิดรับคะแนนแล้ว คะแนนที่บันทึกไว้ก่อนหน้ายังอยู่ครบ
            </div>
          </div>
        )}

        {/* แถบกรรมการ */}
        <div className="bg-indigo-600 text-white rounded-t-lg px-4 py-3 flex flex-wrap items-center gap-3 shadow">
          <span className="text-sm text-indigo-100">กรรมการ:</span>
          <span className="rounded px-3 py-1 bg-white/15 font-medium text-sm">{session.judge.label}</span>
          {confirmed && !locked && (
            <span className="text-xs bg-emerald-400 text-emerald-950 px-2 py-1 rounded-full font-semibold">
              ✅ ยืนยันคะแนนแล้ว
            </span>
          )}
          <span
            className={`text-sm ml-auto h-5 ${
              saveState.includes('ไม่สำเร็จ') ? 'text-red-200 font-semibold' : 'text-emerald-200'
            }`}
          >
            {saveState}
          </span>
          {!locked &&
            (confirmed ? (
              <button
                className="text-sm bg-white text-indigo-700 px-3 py-1.5 rounded font-medium disabled:opacity-50"
                disabled={busy}
                onClick={handleUnlock}
              >
                ✏️ ขอแก้ไข
              </button>
            ) : (
              <button
                className="text-sm bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded font-medium disabled:opacity-50"
                disabled={busy}
                onClick={handleLock}
              >
                ✅ ยืนยันคะแนนของฉัน
              </button>
            ))}
        </div>

        {/* แจ้งเตือนความโปร่งใส */}
        <div className="text-xs text-slate-600 bg-amber-50 border-x border-amber-200 px-4 py-2">
          ℹ️ ระบบบันทึกการให้คะแนนเพื่อการตรวจสอบความถูกต้อง (เวลาและการแก้ไข) ·
          💡 กด “ล็อกทีม” หลังกรอกแต่ละทีมเสร็จเพื่อกันกดผิด
        </div>

        {/* ตารางให้คะแนน (เดสก์ท็อป) */}
        <div className={`hidden md:block overflow-x-auto border border-t-0 border-slate-200 rounded-b-lg bg-white shadow-sm ${disabledAll ? 'opacity-60 pointer-events-none' : ''}`}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-700 text-white">
                <th className="p-2 border-r border-slate-600 w-12 text-center">No.</th>
                <th className="p-2 border-r border-slate-600 text-left min-w-[120px]">Name</th>
                {session.criteria.map((cr) => (
                  <th key={cr.id} className="p-2 border-r border-slate-600 text-center min-w-[130px]">
                    <div className="font-semibold">{cr.name}</div>
                    <div className="text-xs text-indigo-200 font-normal mt-1">{cr.weightPercent}% · เต็ม 5</div>
                  </th>
                ))}
                <th className="p-2 border-r border-slate-600 text-center min-w-[80px]">
                  <div className="font-bold">Total</div>
                  <div className="text-xs text-slate-300 font-normal">(เต็ม 5)</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {session.competitors.map((c, idx) => {
                const teamLocked = lockedTeams.has(c.id);
                return (
                  <tr key={c.id} className={teamLocked ? 'bg-amber-50' : idx % 2 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="p-2 border-b border-r border-slate-200 text-center text-slate-500">{idx + 1}</td>
                    <td className="p-2 border-b border-r border-slate-200 font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        <span>
                          {c.bibNumber ? <span className="text-slate-400">#{c.bibNumber} </span> : ''}
                          {c.name}
                        </span>
                        <button
                          disabled={busy || disabledAll}
                          onClick={() => toggleTeamLock(c.id)}
                          className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap disabled:opacity-40 ${
                            teamLocked
                              ? 'bg-amber-500 text-white hover:bg-amber-600'
                              : 'border border-slate-300 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {teamLocked ? '🔒 ปลดล็อก' : '🔓 ล็อก'}
                        </button>
                      </div>
                    </td>
                    {session.criteria.map((cr) => (
                      <td key={cr.id} className="p-2 border-b border-r border-slate-200 text-center">
                        <ScoreButtons
                          current={scores[c.id]?.[cr.id]}
                          onPick={(n) => setScoreValue(c.id, cr.id, n)}
                          disabled={teamLocked}
                        />
                      </td>
                    ))}
                    <td className="p-2 border-b border-slate-200 text-center font-bold text-indigo-700 font-mono">
                      {total(c.id).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* การ์ดให้คะแนน (มือถือ) — ทีละทีม ปุ่มใหญ่กดง่าย */}
        <div className={`md:hidden border border-t-0 border-slate-200 rounded-b-lg bg-white divide-y divide-slate-200 shadow-sm ${disabledAll ? 'opacity-60 pointer-events-none' : ''}`}>
          {session.competitors.map((c, idx) => {
            const teamLocked = lockedTeams.has(c.id);
            return (
              <div key={c.id} className={`p-4 ${teamLocked ? 'bg-amber-50' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-slate-800 flex items-center gap-2">
                    <span>
                      <span className="text-slate-400 mr-1">{idx + 1}.</span>
                      {c.bibNumber ? <span className="text-slate-400">#{c.bibNumber} </span> : ''}
                      {c.name}
                    </span>
                    <button
                      disabled={busy || disabledAll}
                      onClick={() => toggleTeamLock(c.id)}
                      className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap disabled:opacity-40 ${
                        teamLocked ? 'bg-amber-500 text-white' : 'border border-slate-300 text-slate-500'
                      }`}
                    >
                      {teamLocked ? '🔒 ปลดล็อก' : '🔓 ล็อก'}
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Total</div>
                    <div className="font-bold text-indigo-700 font-mono text-lg leading-none">{total(c.id).toFixed(2)}</div>
                  </div>
                </div>
                <div className="space-y-3">
                  {session.criteria.map((cr) => (
                    <div key={cr.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-slate-700">{cr.name}</span>
                        <span className="text-xs text-indigo-600">{cr.weightPercent}% · เต็ม 5</span>
                      </div>
                      <ScoreButtons
                        current={scores[c.id]?.[cr.id]}
                        onPick={(n) => setScoreValue(c.id, cr.id, n)}
                        size="lg"
                        disabled={teamLocked}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-slate-500 mt-3">
          กรอกคะแนนแต่ละหัวข้อ 0 – 5 · Total คำนวณถ่วงน้ำหนักอัตโนมัติ · บันทึกทันทีที่แก้ไข ·
          ล็อกทีมเพื่อกันกดผิด · “ยืนยันคะแนนของฉัน” เมื่อกรอกครบทุกทีม
        </p>

        {/* ประวัติการให้คะแนนของฉัน */}
        <div className="mt-4">
          <button className="text-sm text-indigo-600 font-medium" onClick={toggleMyLog}>
            {showMyLog ? 'ซ่อนประวัติของฉัน' : '📜 ดูประวัติการให้คะแนนของฉัน'}
          </button>
          {showMyLog && (
            <div className="mt-2 border border-slate-200 rounded-lg bg-white max-h-72 overflow-y-auto shadow-sm">
              {myLogs.length === 0 ? (
                <p className="p-3 text-sm text-slate-400">ยังไม่มีประวัติ</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {myLogs.map((l) => (
                    <li key={l.id} className="p-2 flex gap-3">
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleString('th-TH')}
                      </span>
                      <span className="text-slate-700">{l.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
