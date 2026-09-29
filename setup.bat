@echo off
REM ===== score-app: ติดตั้งครั้งแรก (setup) =====
REM รันหนึ่งครั้งก่อนใช้ dev.bat: ติดตั้ง dependencies + สร้าง database + ใส่ข้อมูลตัวอย่าง

cd /d "%~dp0"

echo.
echo ============================================
echo   score-app - Setup (ครั้งแรก)
echo ============================================
echo.

echo [1/4] ติดตั้ง dependencies: backend ...
cd /d "%~dp0backend"
call npm install
if errorlevel 1 goto error

echo.
echo [2/4] สร้าง database + migrate ...
call npx prisma migrate dev --name init
if errorlevel 1 goto error

echo.
echo [3/4] ใส่ข้อมูลตัวอย่าง (seed) ...
call npm run seed

echo.
echo [4/4] ติดตั้ง dependencies: frontend ...
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 goto error

echo.
echo ============================================
echo   เสร็จแล้ว! ตอนนี้ดับเบิลคลิก dev.bat เพื่อรัน
echo ============================================
pause
exit /b 0

:error
echo.
echo [X] เกิดข้อผิดพลาดระหว่างติดตั้ง — ดูข้อความด้านบน
pause
exit /b 1
