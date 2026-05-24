@echo off
title AmbientOS

echo.
echo  ================================================
echo        AmbientOS - Starting Native Overlay
echo  ================================================
echo.

:: Check if port 3000 is already in use
netstat -ano | findstr LISTENING | findstr :3000 >nul
if %errorlevel% equ 0 (
  echo  [Error] Port 3000 is already in use!
  echo  An active instance of AmbientOS or another app is already running.
  echo.
  pause
  exit /b
)

echo  Launching AmbientOS native desktop overlay...
start "" npx electron .

echo.
echo  AmbientOS Native Layer is running.
echo  Your screen is now active as a transparent, always-on-top HUD!
echo  To connect your Google account, open your browser and go to:
echo  👉 http://localhost:3000/auth
echo.
