# 🏆 score-app (ชื่อชั่วคราว)

![version](https://img.shields.io/badge/version-0.2.0-blue)
![frontend](https://img.shields.io/badge/frontend-React%20%2B%20TS%20%2B%20Vite-61DAFB)
![backend](https://img.shields.io/badge/backend-Node%20%2B%20Express%20%2B%20Prisma-3178C6)
![db](https://img.shields.io/badge/db-SQLite-003B57)
![deploy](https://img.shields.io/badge/deploy-Azure%20Container%20Apps-0078D4)

ระบบเว็บสำหรับ **ให้คะแนนการแข่งขัน** — กรรมการหลายคนให้คะแนนแยกกัน (มองไม่เห็นกัน) แล้วระบบรวมคะแนนถ่วงน้ำหนักและจัดอันดับ

> เวอร์ชันปัจจุบัน: **v0.2.0** — รองรับหลายการแข่งขัน, Export/Import Excel, deploy บน Azure Container Apps

## 📑 สารบัญ

- [เอกสาร (Spec)](#-เอกสาร-spec)
- [Tech Stack](#-tech-stack)
- [โครงสร้าง](#-โครงสร้าง)
- [การรัน (development)](#-การรัน-development)
- [สูตรคะแนน](#-สูตรคะแนน)
- [Versioning](#-versioning)

## 📚 เอกสาร (Spec)

- [`docs/01-requirements.md`](docs/01-requirements.md) — 📋 ความต้องการ
- [`docs/02-design.md`](docs/02-design.md) — 🗂️ data model, สูตรคะแนน, API
- [`docs/03-tech-stack.md`](docs/03-tech-stack.md) — 🧰 เทคโนโลยี + deploy
- [`docs/04-live-workflow.md`](docs/04-live-workflow.md) — 🗺️ workflow present สด (แผนอนาคต)
- [`docs/05-deployment.md`](docs/05-deployment.md) — 🚀 deploy บน Azure Container Apps (resource, redeploy, ข้อจำกัด)

## 🧰 Tech Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Node.js + Express + TypeScript
- ORM/DB: Prisma + SQLite (สลับไป PostgreSQL ได้)

## 📁 โครงสร้าง

```
score-app/
├─ backend/     # Express API + Prisma
├─ frontend/    # React app
└─ docs/        # เอกสาร spec
```

## ▶️ การรัน (development)

### วิธีง่ายสุด (Windows) — ใช้ไฟล์ .bat
```
1) ดับเบิลคลิก  setup.bat   (ครั้งแรกครั้งเดียว: ติดตั้ง deps + สร้าง DB + seed)
2) ดับเบิลคลิก  dev.bat     (เปิด backend + frontend ในหน้าต่างแยก)
```
- Backend: http://localhost:4000
- Frontend: http://localhost:5173/admin

### หรือรันเองด้วยคำสั่ง
```bash
# 1) Backend
cd backend
npm install
npx prisma migrate dev
npm run seed        # ใส่ข้อมูลตัวอย่าง
npm run dev         # http://localhost:4000

# 2) Frontend (อีก terminal)
cd frontend
npm install
npm run dev         # http://localhost:5173
```

## 🧮 สูตรคะแนน

- แต่ละหัวข้อให้คะแนนเป็นจำนวนเต็ม 0–5
- น้ำหนักหัวข้อรวมกัน = 100%
- คะแนนกรรมการต่อทีม = Σ (คะแนนหัวข้อ × น้ำหนัก%) → เต็ม 5
- คะแนนสุดท้ายของทีม = เฉลี่ยคะแนนจากกรรมการทุกคน

## 🏷️ Versioning

ใช้ [Semantic Versioning](https://semver.org/) — ดูประวัติที่ [`CHANGELOG.md`](CHANGELOG.md)
