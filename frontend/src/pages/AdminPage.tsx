import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminApi,
  type Competition,
} from '../api';

export default function AdminPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selected, setSelected] = useState<Competition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // form states
  const [newName, setNewName] = useState('');
  const [critName, setCritName] = useState('');
  const [critWeight, setCritWeight] = useState<number>(0);
  const [compName, setCompName] = useState('');
  const [compBib, setCompBib] = useState('');
  const [judgeLabel, setJudgeLabel] = useState('');
  const [links, setLinks] = useState<Record<string, string>>({});

  async function refreshList() {
    setCompetitions(await adminApi.listCompetitions());
  }
  async function selectCompetition(id: string) {
    setError(null);
    setSelected(await adminApi.getCompetition(id));
  }

  useEffect(() => {
    refreshList().catch((e) => setError(String(e.message)));
  }, []);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setLoading(true);
    try {
      await fn();
      if (selected) await selectCompetition(selected.id);
      await refreshList();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const totalWeight =
    selected?.criteria?.reduce((s, c) => s + c.weightPercent, 0) ?? 0;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">ระบบให้คะแนนการแข่งขัน — Admin</h1>
      <p className="text-gray-500 mb-6 text-sm">ตั้งค่าการแข่งขัน หัวข้อ ผู้เข้าแข่งขัน และกรรมการ</p>

      {error && (
        <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>
      )}

      {/* สร้างการแข่งขันใหม่ */}
      <section className="border rounded-lg p-4 mb-6 bg-white">
        <h2 className="font-semibold mb-3">การแข่งขัน</h2>
        <div className="flex gap-2 mb-4">
          <input
            className="border rounded px-3 py-2 flex-1"
            placeholder="ชื่อการแข่งขันใหม่"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={!newName || loading}
            onClick={() =>
              run(async () => {
                const c = await adminApi.createCompetition({ name: newName });
                setNewName('');
                await selectCompetition(c.id);
              })
            }
          >
            สร้าง
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {competitions.map((c) => (
            <button
              key={c.id}
              onClick={() => selectCompetition(c.id)}
              className={`px-3 py-1 rounded border text-sm ${
                selected?.id === c.id ? 'bg-blue-600 text-white' : 'bg-gray-50'
              }`}
            >
              {c.name} <span className="opacity-70">({c.status})</span>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">{selected.name}</h2>
            <div className="flex gap-2 items-center">
              <span className="text-sm px-2 py-1 bg-gray-100 rounded">
                สถานะ: {selected.status === 'closed' ? '🔒 ล็อกแล้ว' : selected.status}
              </span>
              {selected.status === 'draft' && (
                <button
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                  onClick={() => run(() => adminApi.updateCompetition(selected.id, { status: 'open' }))}
                >
                  เปิดแข่ง
                </button>
              )}
              {selected.status === 'open' && (
                <button
                  className="bg-orange-600 text-white px-3 py-1 rounded text-sm"
                  onClick={() => run(() => adminApi.updateCompetition(selected.id, { status: 'closed' }))}
                >
                  🔒 ล็อก (ปิดรับคะแนน)
                </button>
              )}
              {selected.status === 'closed' && (
                <button
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  onClick={() => run(() => adminApi.updateCompetition(selected.id, { status: 'open' }))}
                >
                  🔓 ปลดล็อก (แก้ไขต่อ)
                </button>
              )}
              <Link
                to={`/admin/results/${selected.id}`}
                className="bg-purple-600 text-white px-3 py-1 rounded text-sm"
              >
                ดูผล/อันดับ
              </Link>
            </div>
          </div>

          {/* Criteria */}
          <section className="border rounded-lg p-4 mb-4 bg-white">
            <h3 className="font-semibold mb-2">
              หัวข้อการให้คะแนน — รวมน้ำหนัก {totalWeight}%{' '}
              {totalWeight !== 100 && <span className="text-red-600">(ต้องเป็น 100% ก่อนเปิดแข่ง)</span>}
            </h3>
            <ul className="mb-3">
              {selected.criteria?.map((c) => (
                <li key={c.id} className="flex justify-between border-b py-1 text-sm">
                  <span>{c.name} — {c.weightPercent}%</span>
                  <button className="text-red-600" onClick={() => run(() => adminApi.deleteCriterion(c.id))}>
                    ลบ
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                className="border rounded px-3 py-2 flex-1"
                placeholder="ชื่อหัวข้อ"
                value={critName}
                onChange={(e) => setCritName(e.target.value)}
              />
              <input
                type="number"
                className="border rounded px-3 py-2 w-24"
                placeholder="น้ำหนัก %"
                value={critWeight || ''}
                onChange={(e) => setCritWeight(Number(e.target.value))}
              />
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                disabled={!critName || !critWeight || loading}
                onClick={() =>
                  run(async () => {
                    await adminApi.addCriterion(selected.id, { name: critName, weightPercent: critWeight });
                    setCritName('');
                    setCritWeight(0);
                  })
                }
              >
                เพิ่มหัวข้อ
              </button>
            </div>
          </section>

          {/* Competitors */}
          <section className="border rounded-lg p-4 mb-4 bg-white">
            <h3 className="font-semibold mb-2">ผู้เข้าแข่งขัน / ทีม</h3>
            <ul className="mb-3">
              {selected.competitors?.map((c) => (
                <li key={c.id} className="flex justify-between border-b py-1 text-sm">
                  <span>{c.bibNumber ? `#${c.bibNumber} ` : ''}{c.name}</span>
                  <button className="text-red-600" onClick={() => run(() => adminApi.deleteCompetitor(c.id))}>
                    ลบ
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                className="border rounded px-3 py-2 w-24"
                placeholder="หมายเลข"
                value={compBib}
                onChange={(e) => setCompBib(e.target.value)}
              />
              <input
                className="border rounded px-3 py-2 flex-1"
                placeholder="ชื่อทีม/ผู้เข้าแข่ง"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
              />
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                disabled={!compName || loading}
                onClick={() =>
                  run(async () => {
                    await adminApi.addCompetitor(selected.id, { name: compName, bibNumber: compBib || undefined });
                    setCompName('');
                    setCompBib('');
                  })
                }
              >
                เพิ่ม
              </button>
            </div>
          </section>

          {/* Judges */}
          <section className="border rounded-lg p-4 mb-4 bg-white">
            <h3 className="font-semibold mb-2">กรรมการ (แจกลิงก์ให้แต่ละคน)</h3>
            <ul className="mb-3">
              {selected.judges?.map((j) => (
                <li key={j.id} className="border-b py-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span>{j.label}</span>
                    <div className="flex gap-3 items-center">
                      <button
                        className="text-blue-600"
                        onClick={() =>
                          run(async () => {
                            // toggle: ถ้าแสดงอยู่แล้วให้ซ่อน
                            if (links[j.id]) {
                              setLinks((prev) => {
                                const next = { ...prev };
                                delete next[j.id];
                                return next;
                              });
                              return;
                            }
                            const link = await adminApi.getJudgeLink(j.id);
                            setLinks((prev) => ({ ...prev, [j.id]: link.url }));
                          })
                        }
                      >
                        {links[j.id] ? 'ซ่อนลิงก์' : 'แสดงลิงก์'}
                      </button>
                      <button
                        className="text-red-600"
                        onClick={() => {
                          if (confirm(`ลบ "${j.label}"? คะแนนที่กรรมการคนนี้ให้ไว้จะถูกลบด้วย`)) {
                            run(() => adminApi.deleteJudge(j.id));
                          }
                        }}
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                  {links[j.id] && (
                    <div className="mt-1 bg-gray-50 p-2 rounded flex gap-2 items-center">
                      <code className="text-xs break-all flex-1">{links[j.id]}</code>
                      <button
                        className="text-xs bg-gray-200 px-2 py-1 rounded"
                        onClick={() => navigator.clipboard.writeText(links[j.id])}
                      >
                        คัดลอก
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                className="border rounded px-3 py-2 flex-1"
                placeholder='เช่น "กรรมการ 1"'
                value={judgeLabel}
                onChange={(e) => setJudgeLabel(e.target.value)}
              />
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                disabled={!judgeLabel || loading}
                onClick={() =>
                  run(async () => {
                    await adminApi.addJudge(selected.id, { label: judgeLabel });
                    setJudgeLabel('');
                  })
                }
              >
                เพิ่มกรรมการ
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
