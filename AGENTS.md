# AGENTS.md — คู่มือสำหรับ AI agent ที่ทำงานกับ repo นี้

> อ่านไฟล์นี้ก่อนเริ่มงาน เพื่อทำตาม convention เดียวกันเวลาผู้ใช้สั่งสั้น ๆ

## โปรเจกต์
score-app — ระบบให้คะแนนการแข่งขัน (กรรมการหลายคนให้คะแนนแยกกัน แล้วรวม/จัดอันดับ)
- **Frontend:** React + TS + Vite + Tailwind (`frontend/`)
- **Backend:** Node + Express + TS + Prisma + SQLite (`backend/`)
- **Deploy:** Docker image เดียว บน Azure Container Apps (ACA); SQLite บน Azure Files
- เอกสารทั้งหมดอยู่ใน `docs/` (เริ่มที่ `README.md`)

## เมื่อผู้ใช้สั่ง "deploy" / "ขึ้น prod" / "ออก release"
ทำตาม `docs/07-dev-workflow.md`:
1. **Bump version ให้ครบทุกไฟล์:** `VERSION`, `backend/package.json`, `frontend/package.json`, `README.md` (badge + บรรทัด "เวอร์ชันปัจจุบัน"), `CHANGELOG.md` (SemVer)
2. Build ให้ผ่านทั้ง frontend + backend ก่อนเสมอ
3. Commit (`feat:`/`fix:` + `chore: bump X.Y.Z`) → tag `vX.Y.Z` → `git push origin main` + `git push origin --tags`
4. **การ push tag `v*` จะ trigger CD ให้ deploy เอง** — ไม่ต้องรัน `az` เอง (เว้นแต่ CD ใช้ไม่ได้ → fallback ดู `docs/05-deployment.md` §4)
5. Verify: `https://<fqdn>/api/version` ต้องขึ้นเวอร์ชันใหม่

> ถ้า deploy เร่งด่วนไม่ออก tag: กด "Run workflow" (CD) เอง → ได้ image `manual-<run#>`

## CI/CD (ดู `docs/07-dev-workflow.md`)
- **CI** (`.github/workflows/ci.yml`): รันทุก push/PR — build/typecheck. **push โค้ดปกติไม่ deploy**
- **CD** (`.github/workflows/deploy.yml`): รันเมื่อ **push tag `v*`** หรือกด Run เอง — build image + deploy ACA + smoke test
- CI/CD **แยกกัน** (ผู้ใช้ต้องการแบบนี้) — CD ไม่รอ CI

## Azure resources (ดู `docs/05-deployment.md`)
- ACR: `acrscoreapp6182` · RG: `rg-score-app` · Container App: `score-app`
- FQDN: `score-app.jollyrock-fc32fd20.southeastasia.azurecontainerapps.io`
- Subscription: `569fb520-f29d-4b0f-b045-f862c842d498`
- image tag ล่าสุดใช้เลขเรียง (v1, v2, ... หรือชื่อ git tag v0.x.0)

## กฎเหล็ก / ข้อควรระวัง
- **ห้าม commit** `backend/.env`, `backend/prisma/dev.db` (gitignore แล้ว) — เช็ค `git status` ก่อน commit
- **ห้าม push ตรงเข้า main โดยไม่ได้รับอนุญาต** / อย่า deploy ตอนกรรมการกำลังกรอกคะแนน
- **migration Prisma** apply อัตโนมัติตอน container start — ไม่ต้องทำใน pipeline
- Windows shell: `az acr build` ต้องตั้ง `chcp 65001` + `PYTHONUTF8=1` + `--no-logs` กัน unicode crash (ดู `docs/05-deployment.md` §6.3)
- Build ต้องผ่านก่อน commit/deploy เสมอ

## เอกสารอ้างอิง
- `docs/01-requirements.md` · `docs/02-design.md` (data model/API) · `docs/03-tech-stack.md`
- `docs/04-live-workflow.md` · `docs/05-deployment.md` (ACA, CI/CD setup)
- `docs/06-design-log-and-scorelock.md` (Log + ล็อกคะแนน) · `docs/07-dev-workflow.md` (dev/release flow)
