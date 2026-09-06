@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 請先安裝 Node.js LTS，再重新啟動遊戲。
  pause
  exit /b 1
)
if not exist node_modules\vite (
  call npm install
  if errorlevel 1 (
    echo 套件安裝失敗，請檢查網路後重試。
    pause
    exit /b 1
  )
)
echo 能量防線啟動中，請開啟下方顯示的 Local 網址。
call npm run dev -- --open
pause
