# Tech Stack & Project Structure — โปรแกรมให้คะแนนการแข่งขัน (score-app)

> เอกสารฉบับร่าง v0.1 — 2026-09-29
> เป้าหมายหลัก: **ฟรี (open-source, ไม่มีค่า license)** และ **ย้ายง่าย (portable, ไม่ล็อก vendor)**

## 1. หลักการเลือกเทคโนโลยี

1. **ฟรีทั้งหมด** — ใช้ open-source ล้วน ไม่มีค่าใช้จ่ายด้าน license
2. **ย้ายง่าย** — แพ็กด้วย Docker → ยกไปรันบนเครื่อง/คลาวด์ไหนก็ได้ ไม่ต้องแก้โค้ด
3. **ไม่ผูก vendor** — หลีกเลี่ยง managed service เฉพาะเจ้า (เช่น DynamoDB, Firebase) ใช้มาตรฐานเปิด (PostgreSQL/SQLite)
4. **ภาษาเดียวทั้ง stack** — TypeScript ทั้ง frontend/backend ลดภาระการดูแล

## 2. เทคโนโลยีที่เลือก

| ส่วน | เทคโนโลยี | เหตุผล |
|------|-----------|--------|
| Frontend | **React + TypeScript + Vite** | นิยม, ฟรี, ชุมชนใหญ่, build เป็น static ไฟล์ ย้ายง่าย |
| UI | **Tailwind CSS** | เบา, responsive ง่าย (รองรับมือถือ/แท็บเล็ตของกรรมการ) |
| Backend | **Node.js + Express + TypeScript** | ฟรี, เบา, ภาษาเดียวกับ frontend |
| ORM | **Prisma** | สลับ PostgreSQL/SQLite ได้ด้วย config เดียว → ย้ายง่ายจริง |
| Database | **PostgreSQL** (prod) / **SQLite** (พกพา/เล็ก) | open-source, มาตรฐานเปิด, dump/restore ย้ายข้อมูลง่าย |
| Auth (Admin) | **JWT** (jsonwebtoken) | ไม่พึ่ง service ภายนอก |
| Auth (Judge) | **access token ในลิงก์** | ไม่ต้องมีระบบสมาชิก |
| Export | **exceljs** (xlsx/csv), **pdfmake** (pdf) | ฟรี ทำงานฝั่ง server |
| Container | **Docker + Docker Compose** | หัวใจของการย้ายง่าย — ยกทั้งชุดไปรันที่ไหนก็ได้ |

> ทางเลือกที่เบากว่านี้ถ้าต้องการเรียบง่ายสุด: ใช้ **SQLite** ไฟล์เดียว + backend เสิร์ฟ static frontend ในโปรเซสเดียว → ได้ไฟล์รันเดียวจบ ย้ายแค่ก๊อปโฟลเดอร์

## 3. ตัวเลือกการ Deploy แบบฟรี (portable)

เพราะแพ็กเป็น Docker แล้ว จะรันที่ไหนก็ได้ **ยึดฟรีเป็นหลัก**

**ตัวเลือกหลักที่เลือก: Fly.io**
- Free tier รัน Docker container ได้เต็ม (ไม่ใช่ serverless) → รองรับ **WebSocket** ค้างยาวสำหรับ Live Dashboard
- มี PostgreSQL ฟรีขนาดเล็ก
- รัน Docker Compose ที่เราแพ็กไว้ได้โดยแทบไม่ต้องแก้ → ตรงเป้า "ฟรี + ย้ายง่าย"

**ทางเลือกสำรอง (ฟรีเช่นกัน)**
- **Render** — free tier มี Postgres ฟรี (จำกัดเวลา); ข้อควรรู้: instance ฟรีจะ sleep เมื่อไม่มีทราฟฟิก (สะดุดตอน request แรก)
- **Railway** — ตั้งค่าง่าย มี Postgres ในตัว แต่ฟรีเป็นเครดิตรายเดือนจำกัด
- **Self-host / โน้ตบุ๊กในงาน** — ฟรีสุด รัน `docker compose up` ให้กรรมการต่อ WiFi วงเดียวกัน เหมาะกับ event วันเดียว

**ไม่แนะนำสำหรับแอปนี้**
- **Vercel / Netlify** — เหมาะ frontend/serverless เท่านั้น รองรับ WebSocket ค้างยาวได้ไม่ดี → ไม่เหมาะกับ Live Dashboard

> ทั้งหมดเป็นมาตรฐานเปิด (Docker + Postgres/SQLite) — ไม่ผูกกับ cloud เจ้าใดเจ้าหนึ่ง เปลี่ยนที่ deploy ได้โดยไม่แก้โค้ด

## 4. โครงสร้างโปรเจกต์ (แนะนำ)

```
score-app/
├─ docs/                      # เอกสาร spec
│  ├─ 01-requirements.md
│  ├─ 02-design.md
│  └─ 03-tech-stack.md
├─ backend/
│  ├─ src/
│  │  ├─ index.ts             # entry, ตั้งค่า Express
│  │  ├─ config/              # env, db config (สลับ pg/sqlite)
│  │  ├─ routes/
│  │  │  ├─ admin.ts
│  │  │  └─ judge.ts
│  │  ├─ controllers/
│  │  ├─ services/
│  │  │  └─ scoring.ts        # สูตรคำนวณคะแนน/อันดับ
│  │  ├─ middleware/
│  │  │  ├─ adminAuth.ts      # JWT
│  │  │  └─ judgeAuth.ts      # ตรวจ access_token
│  │  └─ export/              # csv/xlsx/pdf
│  ├─ prisma/
│  │  └─ schema.prisma        # data model (Competition, Criterion, ...)
│  ├─ package.json
│  └─ Dockerfile
├─ frontend/
│  ├─ src/
│  │  ├─ main.tsx
│  │  ├─ pages/
│  │  │  ├─ admin/            # ตั้งค่า/ผล/อันดับ
│  │  │  └─ judge/            # หน้ากรอกคะแนน
│  │  ├─ components/
│  │  ├─ api/                 # เรียก backend
│  │  └─ lib/
│  ├─ package.json
│  ├─ vite.config.ts
│  └─ Dockerfile
├─ docker-compose.yml         # frontend + backend + postgres (หรือ sqlite mode)
├─ .env.example
└─ README.md
```

## 5. ตัวแปรสภาพแวดล้อม (.env.example)

```
# เลือกชนิดฐานข้อมูล: postgresql หรือ sqlite
DATABASE_URL="postgresql://user:pass@db:5432/scoreapp"
# หรือ SQLite (พกพา): DATABASE_URL="file:./data/scoreapp.db"

JWT_SECRET="change-me"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD_HASH="..."     # bcrypt hash

APP_BASE_URL="http://localhost:5173"   # ใช้ประกอบลิงก์กรรมการ
```

## 6. แผนการพัฒนา (เฟส)

1. **เฟส 1 — โครงหลัก:** data model + admin สร้างการแข่งขัน/หัวข้อ/ผู้เข้าแข่ง/กรรมการ + ลิงก์กรรมการ
2. **เฟส 2 — การให้คะแนน:** หน้ากรรมการ กรอก+auto-save, บังคับความเป็นส่วนตัว
3. **เฟส 3 — รวมผล:** คำนวณ, breakdown, อันดับ, หน้าผลฝั่ง admin
4. **เฟส 4 — export & polish:** CSV/Excel/PDF, responsive, validation ครบ
5. **เฟส 5 (ภายหลัง):** real-time progress, trimmed mean, หลายรอบ/สาย, แสดงผลจอใหญ่

## 7. เหตุผลสรุป (ตอบโจทย์ฟรี + ย้ายง่าย)

- ไม่มีค่า license ทุกส่วน → **ฟรี**
- แพ็ก Docker Compose ชุดเดียว + Prisma สลับ DB ได้ → **ย้ายเครื่อง/ย้ายคลาวด์โดยไม่แก้โค้ด**
- รองรับ SQLite mode → กรณีเล็ก ยกไฟล์เดียวก็ย้ายได้เลย
- ไม่พึ่ง managed service เฉพาะเจ้า → **ไม่ล็อก vendor**
