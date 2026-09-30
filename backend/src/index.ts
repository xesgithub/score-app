import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import adminRoutes from './routes/admin';
import judgeRoutes from './routes/judge';

const app = express();
// เชื่อถือ proxy header (X-Forwarded-Proto) จาก ingress ของ ACA
// เพื่อให้ req.protocol เป็น https ถูกต้องตอนสร้างลิงก์กรรมการ
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// เวอร์ชันแอป (อ่านจาก package.json ของ backend)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const APP_VERSION: string = (() => {
  try {
    return require('../package.json').version ?? 'unknown';
  } catch {
    return process.env.APP_VERSION ?? 'unknown';
  }
})();
app.get('/api/version', (_req, res) => res.json({ version: APP_VERSION }));

app.use('/api/admin', adminRoutes);
app.use('/api/judge', judgeRoutes);

// error handler กันเคส exception หลุด
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error', detail: String(err?.message ?? err) });
});

// เสิร์ฟ frontend build (production) — โฟลเดอร์ถูกก๊อปมาไว้ที่ ./public ตอน build image
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // SPA fallback: ทุก path ที่ไม่ใช่ /api คืน index.html
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`score-app backend running on http://localhost:${PORT}`);
});
