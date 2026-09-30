# Changelog

รูปแบบตาม [Keep a Changelog](https://keepachangelog.com/) และใช้ [Semantic Versioning](https://semver.org/)

## [0.6.0] - 2026-09-30

### Added
- **เครื่องมือทดสอบ (Test Tools)** ในหน้า Admin — สร้าง/ลบ กรรมการและทีมจำนวนมากเร็ว ๆ สำหรับเทส
  - Backend: `POST /judges/bulk`, `POST /competitors/bulk`, `DELETE /judges/all`, `DELETE /competitors/all` (ครอบด้วย marker `TEST TOOLS` ถอดออกง่าย)
  - บันทึกใน log: `test.bulk_judges` / `test.bulk_competitors` / `test.delete_all_*`

> 📌 ส่วนนี้เป็น test function — ออกแบบให้ถอดออกได้เมื่อจบ phase test (มี comment marker ทั้ง backend/frontend)

## [0.5.0] - 2026-09-30

### Added
- **ล็อกคะแนนรายทีม:** กรรมการกด "ล็อกทีม" หลังกรอกแต่ละทีมเสร็จ → ปุ่มคะแนนทีมนั้นกดไม่ได้ (กันกดผิด) ปลดล็อกเองได้
  - บันทึกใน log: `team.lock` / `team.unlock`

### Fixed
- ประวัติการให้คะแนน (judge) และ log (admin) รีเฟรชอัตโนมัติทันทีหลังมีการเปลี่ยนแปลง (เดิมต้องปิด-เปิดใหม่)

### Changed
- ปรับสีสัน UI ทั้งหน้า Admin และหน้ากรรมการ (พื้นหลังไล่เฉด, header สี, badge สถานะ, แถวสลับสี) ลดความ "ขาวโพลน"

### Data
- เพิ่มตาราง `TeamLock` (migration: `add_team_lock`)

## [0.4.0] - 2026-09-30

### Added
- **Activity Log:** บันทึกการใช้งาน (ให้คะแนน, เปลี่ยนสถานะ, ลบ, ยืนยัน/ปลดล็อกคะแนน)
  - Admin เห็นประวัติทั้งหมดของการแข่งขัน + ตัวกรองประเภท + โหลดเพิ่ม
  - กรรมการเห็นเฉพาะประวัติการให้คะแนนของตัวเอง (privacy)
  - เก็บ `score.set` เฉพาะเมื่อค่าเปลี่ยนจริง (กัน log ท่วมจาก auto-save)
- **ระบบล็อกคะแนนกรรมการ (กันกดผิด):** ปุ่ม "ยืนยันคะแนนของฉัน" → ล็อกทั้งชุด แก้ไม่ได้จนกด "ขอแก้ไข"
- แจ้งกรรมการว่ามีการบันทึกการให้คะแนนเพื่อความโปร่งใส (ℹ️ notice)

### Data
- เพิ่มตาราง `ActivityLog` และคอลัมน์ `Judge.scoresLockedAt` (migration: `add_activity_log_and_score_lock`)

## [0.3.0] - 2026-09-30

### Added
- แก้ไขชื่อได้ในหน้า Admin (inline edit): หัวข้อ+น้ำหนัก, ชื่อ/หมายเลขผู้เข้าแข่ง, ชื่อกรรมการ
- Backend: `PATCH /admin/judges/:id` สำหรับแก้ชื่อกรรมการ
- หน้ากรรมการรองรับมือถือ (responsive): เดสก์ท็อปเป็นตาราง, มือถือเป็นการ์ดต่อทีมพร้อมปุ่มคะแนนขนาดใหญ่กดง่าย
- แจ้งเตือนเมื่อการแข่งขันถูกล็อกระหว่างกรรมการกรอกคะแนน: แบนเนอร์แดงชัดเจน + ปิดการกรอก

### Changed
- ลิงก์กรรมการอิง origin จาก request (รองรับโดเมน production จริง) แทน fallback `localhost`
- เปิด `trust proxy` ให้ `req.protocol` เป็น `https` ถูกต้องหลัง ingress ของ Azure Container Apps

### Fixed
- ลิงก์กรรมการที่คัดลอกจากหน้า Admin บน production ไม่ขึ้นเป็น `localhost` อีกต่อไป

## [0.2.0] - 2026-09-29

### Added
- หน้า Admin: ตารางการแข่งขันทั้งหมด พร้อมค้นหาชื่อ + กรองสถานะ (รองรับการแข่งขันจำนวนมาก)
- Export ผลเป็น Excel (.xlsx): ชีต สรุปผล, คะแนนรายกรรมการ (Total เป็นสูตร), หัวข้อ, ผู้เข้าแข่งขัน, ข้อมูล
- Import Excel ที่ export จากระบบ → สร้างเป็นการแข่งขันใหม่ (ลิงก์กรรมการสร้างใหม่)
- ลบการแข่งขันได้เมื่อ Lock แล้วเท่านั้น (ลบคะแนน/ทีม/กรรมการตามไปด้วย)
- Lock/Unlock การแข่งขัน, เพิ่ม/ลบกรรมการ, ซ่อน/แสดงลิงก์กรรมการ
- หน้ากรรมการเป็นตาราง (แถว=ทีม, คอลัมน์=หัวข้อ) ปุ่มคะแนน 0–5 + Total
- Deploy บน Azure Container Apps; SQLite บน Azure Files (mount `nobrl`) ข้อมูลถาวรแม้ scale-to-zero

### Changed
- คะแนนกรรมการเป็นจำนวนเต็ม 0–5

## [0.1.0] - 2026-09-29

Demo01 — เวอร์ชันเล่นได้ (playable demo) ยังไม่มี live dashboard

### Added
- โครงสร้างโปรเจกต์ (backend + frontend) และเอกสาร spec ใน `docs/`
- Backend (Node + Express + TypeScript + Prisma + SQLite)
  - Data model: Competition, Criterion, Competitor, Judge, Score
  - Admin API: สร้าง/แก้การแข่งขัน หัวข้อ+น้ำหนัก ผู้เข้าแข่งขัน กรรมการ + สร้างลิงก์กรรมการ
  - Judge API: เข้าผ่าน access token, ดึงข้อมูลการแข่งขัน, บันทึกคะแนน (auto-save)
  - Results API: คำนวณคะแนนถ่วงน้ำหนัก + เฉลี่ยข้ามกรรมการ + จัดอันดับ
  - Seed ข้อมูลตัวอย่าง
- Frontend (React + TypeScript + Vite + Tailwind)
  - หน้า Admin: ตั้งค่าการแข่งขัน และดูผล/อันดับ
  - หน้า Judge: กรอกคะแนนผ่านลิงก์เฉพาะ

### Scope / ข้อจำกัดของ Demo01
- ยังไม่มี Live Dashboard / WebSocket (admin ดูผลหลังกรรมการกรอกเสร็จ)
- ยังไม่มีระบบล็อก/ปลดล็อกคะแนนทีละทีม (กรรมการแก้ได้จนกว่าจะปิดการแข่งขัน)
- ยังไม่มี export ไฟล์
