@echo off
REM ===== score-app: รัน backend + frontend บน local (dev) =====
REM ดับเบิลคลิกไฟล์นี้ หรือรันจาก cmd: dev.bat
REM จะเปิด 2 หน้าต่าง: Backend (http://localhost:4000) และ Frontend (http://localhost:5173)

cd /d "%~dp0"

echo.
echo ============================================
echo   score-app - Local Dev
echo ============================================
echo   Backend : http://localhost:4000
echo   Frontend: http://localhost:5173/admin
echo ============================================
echo.

REM ตรวจว่าติดตั้ง dependencies แล้วหรือยัง
if not exist "backend\node_modules" (
  echo [!] ยังไม่ได้ติดตั้ง dependencies ของ backend
  echo     รัน setup.bat ก่อนหนึ่งครั้ง
  pause
  exit /b 1
)
if not exist "frontend\node_modules" (
  echo [!] ยังไม่ได้ติดตั้ง dependencies ของ frontend
  echo     รัน setup.bat ก่อนหนึ่งครั้ง
  pause
  exit /b 1
)

REM เปิด backend ในหน้าต่างใหม่
start "score-app backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

REM รอ backend ตั้งตัวสักครู่ แล้วเปิด frontend
timeout /t 3 /nobreak >nul
start "score-app frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo เปิด 2 หน้าต่างแล้ว (backend + frontend)
echo ปิดหน้าต่างเหล่านั้นเพื่อหยุดเซิร์ฟเวอร์
echo.
timeout /t 3 /nobreak >nul
