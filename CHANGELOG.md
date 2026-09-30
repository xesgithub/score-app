# Changelog

รูปแบบตาม [Keep a Changelog](https://keepachangelog.com/) และใช้ [Semantic Versioning](https://semver.org/)

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
