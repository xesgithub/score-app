import { randomBytes } from 'crypto';

/** สร้าง access token สุ่ม (url-safe) สำหรับลิงก์กรรมการ */
export function generateToken(): string {
  return randomBytes(24).toString('base64url');
}
