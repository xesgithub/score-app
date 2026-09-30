import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminApi,
  type Competition,
  type AdminLog,
} from '../api';

const ACTION_LABEL: Record<string, string> = {
  'score.set': 'ให้คะแนน',
  'score.lock': 'ยืนยันคะแนน',
  'score.unlock': 'ขอแก้ไขคะแนน',
  'team.lock': 'ล็อกทีม',
  'team.unlock': 'ปลดล็อกทีม',
  'competition.status': 'เปลี่ยนสถานะ',
  'criterion.delete': 'ลบหัวข้อ',
  'competitor.delete': 'ลบผู้เข้าแข่ง',
  'judge.delete': 'ลบกรรมการ',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'ร่าง',
  open: 'เปิดรับคะแนน',
  closed: '🔒 ล็อกแล้ว',
};
const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  open: 'bg-green-100 text-green-700',
  closed: 'bg-orange-100 text-orange-700',
};

export default function AdminPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selected, setSelected] = useState<Competition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const fileInput = useRef<HTMLInputElement>(null);

  // form states
  const [newName, setNewName] = useState('');
  const [critName, setCritName] = useState('');
  const [critWeight, setCritWeight] = useState<number>(0);
  const [compName, setCompName] = useState('');
  const [compBib, setCompBib] = useState('');
  const [judgeLabel, setJudgeLabel] = useState('');
  const [links, setLinks] = useState<Record<string, string>>({});

  // inline edit state — เก็บ id ที่กำลังแก้ + ค่าในฟอร์มแก้
  const [editCrit, setEditCrit] = useState<{ id: string; name: string; weight: number } | null>(null);
  const [editComp, setEditComp] = useState<{ id: string; name: string; bib: string } | null>(null);
  const [editJudge, setEditJudge] = useState<{ id: string; label: string } | null>(null);

  // activity log state
  const [showLog, setShowLog] = useState(false);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logAction, setLogAction] = useState('');
  const [logLoading, setLogLoading] = useState(false);

  // ===== TEST TOOLS state (ถอดออกได้เมื่อจบ phase test) =====
  const [bulkJudges, setBulkJudges] = useState(3);
  const [bulkTeams, setBulkTeams] = useState(5);
  // ===== END TEST TOOLS =====

  async function loadLogs(reset = true) {
    if (!selected) return;
    setLogLoading(true);
    try {
      const offset = reset ? 0 : logs.length;
      const r = await adminApi.getLogs(selected.id, {
        limit: 50,
        offset,
        action: logAction || undefined,
      });
      setLogs(reset ? r.logs : [...logs, ...r.logs]);
      setLogTotal(r.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLogLoading(false);
    }
  }

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

  // reset log view เมื่อสลับการแข่งขัน
  useEffect(() => {
    setShowLog(false);
    setLogs([]);
    setLogTotal(0);
    setLogAction('');
  }, [selected?.id]);

  // โหลด log ใหม่เมื่อเปิดส่วน log หรือเปลี่ยนตัวกรอง
  useEffect(() => {
    if (showLog) loadLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLog, logAction]);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setLoading(true);
    try {
      await fn();
      if (selected) await selectCompetition(selected.id);
      await refreshList();
      if (showLog) await loadLogs(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const totalWeight =
    selected?.criteria?.reduce((s, c) => s + c.weightPercent, 0) ?? 0;

  const filtered = competitions.filter(
    (c) =>
      (statusFilter === 'all' || c.status === statusFilter) &&
      c.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  async function handleImport(file: File | undefined) {
    if (!file) return;
    setNotice(null);
    await run(async () => {
      const r = await adminApi.importCompetition(file);
      setNotice(`นำเข้า "${r.name}" สำเร็จ (${r.scoreCount} คะแนน) — ลิงก์กรรมการถูกสร้างใหม่ ต้องแจกใหม่`);
      await selectCompetition(r.id);
    });
    if (fileInput.current) fileInput.current.value = '';
  }

  async function handleDelete(c: Competition) {
    if (!confirm(`ลบการแข่งขัน "${c.name}"?\nคะแนน ผู้เข้าแข่งขัน และกรรมการทั้งหมดจะถูกลบถาวร\n(แนะนำให้ Export Excel เก็บไว้ก่อน)`)) return;
    setNotice(null);
    setError(null);
    setLoading(true);
    try {
      await adminApi.deleteCompetition(c.id);
      if (selected?.id === c.id) setSelected(null);
      await refreshList();
      setNotice(`ลบ "${c.name}" แล้ว`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-slate-100">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="bg-indigo-600 text-white rounded-xl px-5 py-4 mb-6 shadow">
        <h1 className="text-2xl font-bold mb-0.5">🏆 ระบบให้คะแนนการแข่งขัน — Admin</h1>
        <p className="text-indigo-100 text-sm">ตั้งค่าการแข่งขัน หัวข้อ ผู้เข้าแข่งขัน และกรรมการ</p>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>
      )}
      {notice && (
        <div className="bg-green-100 text-green-700 px-4 py-2 rounded mb-4 text-sm">{notice}</div>
      )}

      {/* รายการการแข่งขัน */}
      <section className="border rounded-lg p-4 mb-6 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">การแข่งขันทั้งหมด ({competitions.length})</h2>
          <div>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => handleImport(e.target.files?.[0])}
            />
            <button
              className="border border-blue-600 text-blue-600 px-3 py-1.5 rounded text-sm disabled:opacity-50"
              disabled={loading}
              onClick={() => fileInput.current?.click()}
            >
              ⬆ Import Excel
            </button>
          </div>
        </div>

        {/* สร้างใหม่ */}
        <div className="flex gap-2 mb-3">
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

        {/* ค้นหา / กรอง */}
        <div className="flex gap-2 mb-3">
          <input
            className="border rounded px-3 py-1.5 flex-1 text-sm"
            placeholder="🔍 ค้นหาชื่อการแข่งขัน"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border rounded px-2 py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">ทุกสถานะ</option>
            <option value="draft">ร่าง</option>
            <option value="open">เปิดรับคะแนน</option>
            <option value="closed">ล็อกแล้ว</option>
          </select>
        </div>

        <div className="max-h-80 overflow-y-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-left text-gray-600">
                <th className="p-2">ชื่อ</th>
                <th className="p-2 w-32">สถานะ</th>
                <th className="p-2 w-40 text-center">ทีม / กรรมการ / หัวข้อ</th>
                <th className="p-2 w-28">สร้างเมื่อ</th>
                <th className="p-2 w-36 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-400">
                    ไม่พบการแข่งขัน
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => selectCompetition(c.id)}
                  className={`border-t cursor-pointer ${selected?.id === c.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="p-2 font-medium">{c.name}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_STYLE[c.status] ?? ''}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="p-2 text-center text-gray-600">
                    {c._count ? `${c._count.competitors} / ${c._count.judges} / ${c._count.criteria}` : '-'}
                  </td>
                  <td className="p-2 text-gray-500 text-xs">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString('th-TH') : '-'}
                  </td>
                  <td className="p-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={adminApi.exportUrl(c.id)}
                      className="text-green-700 hover:underline mr-3"
                      title="ดาวน์โหลดผลเป็น Excel"
                    >
                      Excel
                    </a>
                    <button
                      className="text-red-600 hover:underline disabled:text-gray-300 disabled:no-underline"
                      disabled={c.status !== 'closed' || loading}
                      title={c.status !== 'closed' ? 'ต้องล็อกการแข่งขันก่อนจึงจะลบได้' : 'ลบการแข่งขัน'}
                      onClick={() => handleDelete(c)}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <a
                href={adminApi.exportUrl(selected.id)}
                className="bg-green-700 text-white px-3 py-1 rounded text-sm"
              >
                ⬇ Export Excel
              </a>
              {selected.status === 'closed' && (
                <button
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                  disabled={loading}
                  onClick={() => handleDelete(selected)}
                >
                  ลบการแข่งขัน
                </button>
              )}
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
                <li key={c.id} className="flex justify-between items-center border-b py-1 text-sm gap-2">
                  {editCrit?.id === c.id ? (
                    <>
                      <input
                        className="border rounded px-2 py-1 flex-1"
                        value={editCrit.name}
                        onChange={(e) => setEditCrit({ ...editCrit, name: e.target.value })}
                      />
                      <input
                        type="number"
                        className="border rounded px-2 py-1 w-20"
                        value={editCrit.weight || ''}
                        onChange={(e) => setEditCrit({ ...editCrit, weight: Number(e.target.value) })}
                      />
                      <button
                        className="text-green-700 disabled:text-gray-300"
                        disabled={!editCrit.name.trim() || loading}
                        onClick={() =>
                          run(async () => {
                            await adminApi.updateCriterion(c.id, {
                              name: editCrit.name.trim(),
                              weightPercent: editCrit.weight,
                            });
                            setEditCrit(null);
                          })
                        }
                      >
                        บันทึก
                      </button>
                      <button className="text-gray-500" onClick={() => setEditCrit(null)}>
                        ยกเลิก
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1">{c.name} — {c.weightPercent}%</span>
                      <button
                        className="text-blue-600"
                        onClick={() => setEditCrit({ id: c.id, name: c.name, weight: c.weightPercent })}
                      >
                        แก้ไข
                      </button>
                      <button className="text-red-600" onClick={() => run(() => adminApi.deleteCriterion(c.id))}>
                        ลบ
                      </button>
                    </>
                  )}
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
                <li key={c.id} className="flex justify-between items-center border-b py-1 text-sm gap-2">
                  {editComp?.id === c.id ? (
                    <>
                      <input
                        className="border rounded px-2 py-1 w-20"
                        placeholder="หมายเลข"
                        value={editComp.bib}
                        onChange={(e) => setEditComp({ ...editComp, bib: e.target.value })}
                      />
                      <input
                        className="border rounded px-2 py-1 flex-1"
                        value={editComp.name}
                        onChange={(e) => setEditComp({ ...editComp, name: e.target.value })}
                      />
                      <button
                        className="text-green-700 disabled:text-gray-300"
                        disabled={!editComp.name.trim() || loading}
                        onClick={() =>
                          run(async () => {
                            await adminApi.updateCompetitor(c.id, {
                              name: editComp.name.trim(),
                              bibNumber: editComp.bib.trim() || null,
                            });
                            setEditComp(null);
                          })
                        }
                      >
                        บันทึก
                      </button>
                      <button className="text-gray-500" onClick={() => setEditComp(null)}>
                        ยกเลิก
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1">{c.bibNumber ? `#${c.bibNumber} ` : ''}{c.name}</span>
                      <button
                        className="text-blue-600"
                        onClick={() => setEditComp({ id: c.id, name: c.name, bib: c.bibNumber ?? '' })}
                      >
                        แก้ไข
                      </button>
                      <button className="text-red-600" onClick={() => run(() => adminApi.deleteCompetitor(c.id))}>
                        ลบ
                      </button>
                    </>
                  )}
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
                  <div className="flex justify-between items-center gap-2">
                    {editJudge?.id === j.id ? (
                      <>
                        <input
                          className="border rounded px-2 py-1 flex-1"
                          value={editJudge.label}
                          onChange={(e) => setEditJudge({ ...editJudge, label: e.target.value })}
                        />
                        <button
                          className="text-green-700 disabled:text-gray-300"
                          disabled={!editJudge.label.trim() || loading}
                          onClick={() =>
                            run(async () => {
                              await adminApi.updateJudge(j.id, { label: editJudge.label.trim() });
                              setEditJudge(null);
                            })
                          }
                        >
                          บันทึก
                        </button>
                        <button className="text-gray-500" onClick={() => setEditJudge(null)}>
                          ยกเลิก
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1">{j.label}</span>
                        <div className="flex gap-3 items-center">
                          <button
                            className="text-blue-600"
                            onClick={() => setEditJudge({ id: j.id, label: j.label })}
                          >
                            แก้ไข
                          </button>
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
                      </>
                    )}
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

          {/* ===== TEST TOOLS (ถอดออกได้เมื่อจบ phase test) ===== */}
          <section className="border-2 border-dashed border-amber-400 rounded-lg p-4 mb-4 bg-amber-50">
            <h3 className="font-semibold mb-1 text-amber-800">🧪 เครื่องมือทดสอบ (Test Tools)</h3>
            <p className="text-xs text-amber-700 mb-3">
              สร้าง/ลบ กรรมการและทีมจำนวนมากเร็ว ๆ สำหรับเทส · ⚠️ "ลบทั้งหมด" ลบข้อมูลถาวร (รวมคะแนน)
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {/* กรรมการ */}
              <div className="bg-white rounded p-3 border">
                <div className="text-sm font-medium mb-2">กรรมการ</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="border rounded px-2 py-1 w-20"
                    value={bulkJudges || ''}
                    onChange={(e) => setBulkJudges(Number(e.target.value))}
                  />
                  <button
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                    disabled={loading || bulkJudges < 1}
                    onClick={() =>
                      run(async () => {
                        const r = await adminApi.bulkAddJudges(selected.id, bulkJudges);
                        setNotice(`สร้างกรรมการ ${r.created} คนแล้ว`);
                      })
                    }
                  >
                    + สร้าง
                  </button>
                  <button
                    className="border border-red-500 text-red-600 px-3 py-1 rounded text-sm disabled:opacity-50"
                    disabled={loading}
                    onClick={() => {
                      if (confirm('ลบกรรมการทั้งหมดของการแข่งขันนี้? (คะแนนที่ให้ไว้จะถูกลบด้วย)')) {
                        run(async () => {
                          const r = await adminApi.deleteAllJudges(selected.id);
                          setNotice(`ลบกรรมการ ${r.deleted} คนแล้ว`);
                        });
                      }
                    }}
                  >
                    ลบทั้งหมด
                  </button>
                </div>
              </div>
              {/* ทีม */}
              <div className="bg-white rounded p-3 border">
                <div className="text-sm font-medium mb-2">ทีม / ผู้เข้าแข่ง</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="border rounded px-2 py-1 w-20"
                    value={bulkTeams || ''}
                    onChange={(e) => setBulkTeams(Number(e.target.value))}
                  />
                  <button
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                    disabled={loading || bulkTeams < 1}
                    onClick={() =>
                      run(async () => {
                        const r = await adminApi.bulkAddCompetitors(selected.id, bulkTeams);
                        setNotice(`สร้างทีม ${r.created} ทีมแล้ว`);
                      })
                    }
                  >
                    + สร้าง
                  </button>
                  <button
                    className="border border-red-500 text-red-600 px-3 py-1 rounded text-sm disabled:opacity-50"
                    disabled={loading}
                    onClick={() => {
                      if (confirm('ลบทีมทั้งหมดของการแข่งขันนี้? (คะแนนที่ให้ไว้จะถูกลบด้วย)')) {
                        run(async () => {
                          const r = await adminApi.deleteAllCompetitors(selected.id);
                          setNotice(`ลบทีม ${r.deleted} ทีมแล้ว`);
                        });
                      }
                    }}
                  >
                    ลบทั้งหมด
                  </button>
                </div>
              </div>
            </div>
          </section>
          {/* ===== END TEST TOOLS ===== */}

          {/* Activity Log */}
          <section className="border rounded-lg p-4 mb-4 bg-white">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">📜 ประวัติการใช้งาน (Log)</h3>
              <button
                className="text-sm text-blue-600"
                onClick={() => setShowLog((v) => !v)}
              >
                {showLog ? 'ซ่อน' : 'แสดง'}
              </button>
            </div>

            {showLog && (
              <div className="mt-3">
                <div className="flex gap-2 mb-3 items-center">
                  <select
                    className="border rounded px-2 py-1.5 text-sm"
                    value={logAction}
                    onChange={(e) => setLogAction(e.target.value)}
                  >
                    <option value="">ทุกประเภท</option>
                    <option value="score.set">ให้คะแนน</option>
                    <option value="score.lock">ยืนยันคะแนน</option>
                    <option value="score.unlock">ขอแก้ไขคะแนน</option>
                    <option value="team.lock">ล็อกทีม</option>
                    <option value="team.unlock">ปลดล็อกทีม</option>
                    <option value="competition.status">เปลี่ยนสถานะ</option>
                    <option value="judge.delete">ลบกรรมการ</option>
                    <option value="criterion.delete">ลบหัวข้อ</option>
                    <option value="competitor.delete">ลบผู้เข้าแข่ง</option>
                  </select>
                  <button className="text-sm border rounded px-3 py-1.5" onClick={() => loadLogs(true)}>
                    รีเฟรช
                  </button>
                  <span className="text-xs text-gray-400 ml-auto">ทั้งหมด {logTotal} รายการ</span>
                </div>

                <div className="max-h-96 overflow-y-auto border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-left text-gray-600">
                        <th className="p-2 w-40">เวลา</th>
                        <th className="p-2 w-28">ผู้ทำ</th>
                        <th className="p-2 w-32">การกระทำ</th>
                        <th className="p-2">รายละเอียด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.length === 0 && !logLoading && (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-gray-400">ยังไม่มีประวัติ</td>
                        </tr>
                      )}
                      {logs.map((l) => (
                        <tr key={l.id} className="border-t align-top">
                          <td className="p-2 text-gray-500 text-xs whitespace-nowrap">
                            {new Date(l.createdAt).toLocaleString('th-TH')}
                          </td>
                          <td className="p-2">{l.actorLabel}</td>
                          <td className="p-2">{ACTION_LABEL[l.action] ?? l.action}</td>
                          <td className="p-2 text-gray-700">{l.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {logs.length < logTotal && (
                  <button
                    className="mt-2 text-sm text-blue-600 disabled:text-gray-300"
                    disabled={logLoading}
                    onClick={() => loadLogs(false)}
                  >
                    {logLoading ? 'กำลังโหลด...' : 'โหลดเพิ่ม'}
                  </button>
                )}
              </div>
            )}
          </section>
        </>
      )}
      </div>
    </div>
  );
}
