# score-app (ชื่อชั่วคราว)

ระบบเว็บสำหรับ **ให้คะแนนการแข่งขัน** — กรรมการหลายคนให้คะแนนแยกกัน (มองไม่เห็นกัน) แล้วระบบรวมคะแนนถ่วงน้ำหนักและจัดอันดับ

> เวอร์ชันปัจจุบัน: **v0.1.0 (Demo01)** — เวอร์ชันเล่นได้เพื่อนำไปโชว์ ยังไม่มี live dashboard

## เอกสาร (Spec)

- [`docs/01-requirements.md`](docs/01-requirements.md) — ความต้องการ
- [`docs/02-design.md`](docs/02-design.md) — data model, สูตรคะแนน, API
- [`docs/03-tech-stack.md`](docs/03-tech-stack.md) — เทคโนโลยี + deploy
- [`docs/04-live-workflow.md`](docs/04-live-workflow.md) — workflow present สด (แผนอนาคต)

## Tech Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Node.js + Express + TypeScript
- ORM/DB: Prisma + SQLite (สลับไป PostgreSQL ได้)

## โครงสร้าง

```
score-app/
├─ backend/     # Express API + Prisma
├─ frontend/    # React app
└─ docs/        # เอกสาร spec
```

## การรัน (development)

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

## สูตรคะแนน

- แต่ละหัวข้อให้คะแนนเป็นจำนวนเต็ม 0–5
- น้ำหนักหัวข้อรวมกัน = 100%
- คะแนนกรรมการต่อทีม = Σ (คะแนนหัวข้อ × น้ำหนัก%) → เต็ม 5
- คะแนนสุดท้ายของทีม = เฉลี่ยคะแนนจากกรรมการทุกคน

## Versioning

ใช้ [Semantic Versioning](https://semver.org/) — ดูประวัติที่ [`CHANGELOG.md`](CHANGELOG.md)
