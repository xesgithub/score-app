# Dev & Release Workflow — score-app

> เอกสารนี้บันทึก **ขั้นตอนการทำงานมาตรฐาน** ตั้งแต่แก้โค้ด → ออก release → deploy
> ใช้อ้างอิงเวลาสั่งงาน (คน หรือ AI agent) จะได้ทำตามแบบแผนเดียวกัน

## 1. ภาพรวม CI/CD

| Workflow | ไฟล์ | Trigger | ทำอะไร |
|----------|------|---------|--------|
| **CI** | `.github/workflows/ci.yml` | ทุก push/PR เข้า `main` | build + typecheck (frontend + backend) + `prisma validate` |
| **CD** | `.github/workflows/deploy.yml` | push tag `v*` **หรือ** กด Run workflow เอง | `az acr build` → `az containerapp update` → smoke test |

**หลักการสำคัญ:**
- **CI กับ CD แยกกัน** — push โค้ดปกติ **ไม่ deploy** (รันแค่ CI)
- **CD ต้องตั้งใจสั่ง** — deploy เกิดเฉพาะเมื่อออก tag หรือกดปุ่มเอง (กัน deploy หลุดระหว่างงานจริง)
- image tag = ชื่อ git tag (เช่น `v0.6.0`) เพื่อ traceable; ถ้ากดรันเองแบบไม่ใส่ tag จะได้ `manual-<run#>`

## 2. ตารางสรุป: ทำอะไร → เกิดอะไร

| การกระทำ | CI | CD (deploy) |
|-----------|----|-----|
| `git push` เข้า main | ✅ รัน | ❌ ไม่รัน |
| เปิด PR เข้า main | ✅ รัน | ❌ ไม่รัน |
| `git tag vX.Y.Z && git push --tags` | ❌ | ✅ deploy image `vX.Y.Z` |
| กด "Run workflow" (Actions → CD) | ❌ | ✅ deploy image `manual-<run#>` |

## 3. ขั้นตอนแก้โค้ดปกติ (ไม่ release)
```bash
git add <files>
git commit -m "feat: ..."   # ใช้ Conventional Commits (ดู README)
git push                     # → CI รันอัตโนมัติ (build/typecheck)
```

## 4. ขั้นตอนออก Release + Deploy (ทำเมื่อพร้อม deploy จริง)

1. **Bump version** ให้ครบทุกไฟล์ (ต้องตรงกันหมด):
   - `VERSION`
   - `backend/package.json` (`version`)
   - `frontend/package.json` (`version`)
   - `README.md` (badge + บรรทัด "เวอร์ชันปัจจุบัน")
   - `CHANGELOG.md` (เพิ่มหัวข้อเวอร์ชันใหม่)
2. **Commit + tag + push:**
   ```bash
   git add -A
   git commit -m "feat: ..." -m "chore: bump X.Y.Z"
   git tag vX.Y.Z
   git push origin main
   git push origin --tags        # ← ตัวนี้ทำให้ CD เริ่ม deploy
   ```
3. CD จะ build image `score-app:vX.Y.Z` → deploy ACA → smoke test อัตโนมัติ
4. ตรวจผลที่ Actions หรือ `https://<fqdn>/api/version` ต้องขึ้นเวอร์ชันใหม่

> **Semantic Versioning:** ฟีเจอร์ใหม่ (compatible) = minor (`0.x.0`); แก้บั๊ก = patch (`0.0.x`); breaking = major

## 5. Deploy โดยไม่ออก tag (เช่น hotfix ทดสอบ)
- ไปที่ GitHub → **Actions** → workflow **"CD - Deploy to Azure Container Apps"** → **Run workflow**
- ได้ image `manual-<run#>` (ไม่ผูกเวอร์ชัน — ใช้เฉพาะกรณีเร่งด่วน/ทดสอบ)

## 6. Manual deploy จากเครื่อง (fallback ถ้า CD ใช้ไม่ได้)
ดู [`05-deployment.md`](05-deployment.md) §4 — `az acr build` + `az containerapp update --image` โดยตรง

## 7. ข้อควรระวัง
- **อย่า deploy ตอนกรรมการกำลังกรอกคะแนน** (revision เก่า/ใหม่รันซ้อนช่วงเปลี่ยน) — ดู `05-deployment.md` §8
- **migration Prisma** apply อัตโนมัติตอน container start (`prisma migrate deploy` ใน Dockerfile) — ไม่ต้องทำใน pipeline
- **secret `AZURE_CREDENTIALS`** ตั้งใน GitHub repo settings (ดู `05-deployment.md` §9.2) — ถ้าไม่มี CD จะ login ไม่ผ่าน
- **ห้าม commit** `backend/.env`, `backend/prisma/dev.db` (gitignore ไว้แล้ว)

## 8. (ทางเลือก) เพิ่มด่านอนุมัติก่อน deploy
ถ้าต้องการให้ CD **รอกดอนุมัติก่อน** deploy จริง: ตั้ง GitHub **Environment `production`** + Required reviewers
แล้วผูก job ใน `deploy.yml` กับ environment นั้น (ยังไม่ได้ทำ — เปิดเป็นตัวเลือกไว้)
