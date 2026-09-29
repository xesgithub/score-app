# Design — โปรแกรมให้คะแนนการแข่งขัน (score-app)

> เอกสารฉบับร่าง v0.1 — 2026-09-29
> อ้างอิง: `01-requirements.md`

## 1. สถาปัตยกรรมภาพรวม

```
┌─────────────────┐        ┌─────────────────┐
│  Admin (Web UI) │        │ Judge (Web UI)  │
│  ตั้งค่า/ดูผล    │        │ กรอกคะแนน (ลิงก์) │
└────────┬────────┘        └────────┬────────┘
         │  HTTPS / REST            │  HTTPS / REST
         └───────────┬──────────────┘
                     ▼
          ┌─────────────────────┐
          │   Backend API       │
          │ (REST + Auth)       │
          │ - Admin auth        │
          │ - Judge token auth  │
          │ - คำนวณคะแนน/อันดับ  │
          └──────────┬──────────┘
                     ▼
          ┌─────────────────────┐
          │   Database          │
          │ PostgreSQL / SQLite │
          └─────────────────────┘
```

หลักการออกแบบ (เน้นฟรี + ย้ายง่าย):
- ทั้งระบบแพ็กเป็น **Docker Compose** ชุดเดียว → ยกไปรันบนเครื่อง/คลาวด์ไหนก็ได้
- ฐานข้อมูลใช้ **PostgreSQL** (โปรดักชัน) หรือ **SQLite** (เล็ก/พกพาง่าย) — เลือกได้ด้วย config เดียว ไม่ผูก vendor
- ไม่พึ่ง managed service เฉพาะเจ้า → ย้ายค่าย/ย้ายเครื่องไม่ต้องแก้โค้ด

## 2. Data Model (ER)

```
Competition (การแข่งขัน)
  id (PK)
  name
  description
  event_date
  status            -- draft | open | closed
  score_step        -- = 1 (คะแนนกรรมการเป็นจำนวนเต็ม 0–5)
  created_at, updated_at

Criterion (หัวข้อการให้คะแนน)  -- N ต่อ 1 Competition
  id (PK)
  competition_id (FK)
  name
  weight_percent    -- น้ำหนัก % (รวมทุก criterion ในการแข่งขัน = 100)
  max_score         -- คงที่ = 5
  display_order

Competitor (ผู้เข้าแข่งขัน / ทีม)  -- N ต่อ 1 Competition
  id (PK)
  competition_id (FK)
  name              -- ชื่อบุคคลหรือชื่อทีม (นับเป็น 1 entry)
  bib_number        -- หมายเลข/ลำดับ (optional)
  note              -- หมายเหตุ (optional)
  is_active         -- รองรับการเพิ่ม/ลด (soft delete)
  display_order

Judge (กรรมการ)  -- N ต่อ 1 Competition
  id (PK)
  competition_id (FK)
  label             -- เช่น "กรรมการ 1"
  access_token      -- token สุ่ม สำหรับลิงก์เฉพาะ (unique, index)
  token_revoked     -- boolean เพิกถอนลิงก์
  created_at

Score (คะแนน)  -- 1 ค่า ต่อ (Judge × Competitor × Criterion)
  id (PK)
  judge_id (FK)
  competitor_id (FK)
  criterion_id (FK)
  value             -- 0..5 (ตาม score_step)
  submitted_at
  updated_at
  UNIQUE(judge_id, competitor_id, criterion_id)

AdminUser (ผู้ดูแล)
  id (PK)
  username
  password_hash
  created_at
```

ความสัมพันธ์:
- Competition 1—N Criterion, Competitor, Judge
- Score เป็นตารางเชื่อม (junction) ระหว่าง Judge × Competitor × Criterion โดยมี unique constraint กันซ้ำ

## 3. สูตรการคำนวณคะแนน

กำหนดให้ในการแข่งขันหนึ่ง:
- หัวข้อ (criteria) มี `k` หัวข้อ แต่ละหัวข้อ `c` มีน้ำหนัก `w_c` (%) โดย Σ w_c = 100
- คะแนนเต็มต่อหัวข้อ = 5

### 3.1 คะแนนของกรรมการ j ต่อผู้เข้าแข่งขัน i (เต็ม 5)

```
judgeScore(i, j) = Σ_c [ score(i, j, c) × (w_c / 100) ]
```

เนื่องจากคะแนนแต่ละหัวข้อเต็ม 5 และ Σ (w_c/100) = 1
→ ผลลัพธ์อยู่ในช่วง 0..5 โดยอัตโนมัติ

**ตัวอย่าง:** หัวข้อ A(20%) B(20%) C(30%) D(30%)
กรรมการให้ A=4, B=5, C=3, D=4
```
= 4×0.20 + 5×0.20 + 3×0.30 + 4×0.30
= 0.80 + 1.00 + 0.90 + 1.20
= 3.90  (เต็ม 5)
```

### 3.2 คะแนนสุดท้ายของผู้เข้าแข่งขัน i (เต็ม 5)

เฉลี่ยจากกรรมการทั้งหมด `m` คน:
```
finalScore(i) = ( Σ_j judgeScore(i, j) ) / m
```

> หมายเหตุ: เวอร์ชันแรกใช้เฉลี่ยธรรมดา (ไม่ตัดสูง-ต่ำ) — สามารถเพิ่มโหมด trimmed mean ภายหลัง

### 3.3 การจัดอันดับและ tie-break

- เรียงจาก `finalScore` มาก → น้อย
- **Tie-break (รอยืนยัน user จริง):** ถ้า finalScore เท่ากัน เทียบคะแนนเฉลี่ยในหัวข้อที่น้ำหนักสูงสุดก่อน ถ้ายังเท่าให้ครองอันดับร่วม (rank เดียวกัน) — แนวทางนี้เจ้าของโปรเจกต์จะนำไปยืนยันกับ user จริงอีกครั้ง

## 4. API Endpoints (ร่าง)

### 4.1 Admin (ต้อง auth ด้วย admin session/JWT)
```
POST   /api/admin/login
POST   /api/competitions                     สร้างการแข่งขัน
GET    /api/competitions/:id                  ดูรายละเอียด
PATCH  /api/competitions/:id                  แก้ไข / เปลี่ยน status
POST   /api/competitions/:id/criteria         เพิ่มหัวข้อ (validate Σweight=100)
PATCH  /api/criteria/:id                       แก้หัวข้อ/น้ำหนัก
DELETE /api/criteria/:id

POST   /api/competitions/:id/competitors      เพิ่มผู้เข้าแข่งขัน
PATCH  /api/competitors/:id                    แก้ไข
DELETE /api/competitors/:id                    (soft delete / is_active=false)

POST   /api/competitions/:id/judges           สร้างกรรมการ + สร้าง access_token
POST   /api/judges/:id/revoke-token            เพิกถอน/สร้าง token ใหม่
GET    /api/judges/:id/link                     ดึงลิงก์เฉพาะของกรรมการ

GET    /api/competitions/:id/progress          ดูความคืบหน้าว่ากรรมการให้ครบหรือยัง
GET    /api/competitions/:id/results           ผลรวม + breakdown ต่อกรรมการ/หัวข้อ + อันดับ
GET    /api/competitions/:id/export?format=csv|xlsx|pdf
```

### 4.2 Judge (auth ด้วย access_token ในลิงก์)
```
GET    /api/judge/session?token=...            ตรวจ token + คืนข้อมูลการแข่งขัน + รายชื่อผู้เข้าแข่ง
GET    /api/judge/scores?token=...             คืนเฉพาะคะแนน "ของตัวเอง" เท่านั้น
PUT    /api/judge/scores?token=...             บันทึก/แก้คะแนน (auto-save รายหัวข้อ)
```

**การบังคับความเป็นส่วนตัว (NFR-1):**
- Endpoint ฝั่ง judge จะ filter ด้วย `judge_id` ที่ผูกกับ token เสมอ → ไม่มีทางดึงคะแนนคนอื่น
- ไม่มี endpoint ฝั่ง judge ที่คืนคะแนนรวม/อันดับ

## 5. Flow การใช้งาน

### 5.1 Admin ตั้งค่า
1. Login → สร้างการแข่งขัน (status=draft)
2. เพิ่มหัวข้อ + น้ำหนัก (ระบบ validate รวม = 100%)
3. เพิ่มผู้เข้าแข่งขัน (เพิ่ม/ลดได้ตลอด)
4. สร้างกรรมการ → ระบบ gen ลิงก์เฉพาะ → Admin ก๊อปแจก
5. เปลี่ยน status = open

### 5.2 Judge กรอกคะแนน
1. เปิดลิงก์เฉพาะของตน → ระบบ validate token
2. เห็นรายชื่อผู้เข้าแข่งขัน + สถานะของตัวเอง
3. กรอกคะแนนแต่ละหัวข้อ (0–5) → auto-save
4. แก้ไขได้จนกว่าจะ closed

### 5.3 Admin รวมผล
1. ตรวจ progress ว่ากรรมการครบไหม
2. เปลี่ยน status = closed
3. ดูตารางผล (breakdown + อันดับ) → export

## 6. ความปลอดภัยและความถูกต้อง

- **Token กรรมการ:** สุ่ม ≥ 32 ตัวอักษร (crypto-random), unique, เพิกถอนได้
- **Validation:** คะแนนกรรมการเป็นจำนวนเต็ม ∈ [0, 5]; น้ำหนักรวม = 100% เป๊ะ ก่อนเปิดแข่ง
- **Concurrency:** unique constraint (judge, competitor, criterion) + upsert กันข้อมูลชน
- **Audit:** เก็บ submitted_at / updated_at ของทุกคะแนน
