# Changelog

รูปแบบตาม [Keep a Changelog](https://keepachangelog.com/) และใช้ [Semantic Versioning](https://semver.org/)

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
