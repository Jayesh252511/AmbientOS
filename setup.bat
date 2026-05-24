@echo off
title AmbientOS - One-Click Setup
cd /d "%~dp0"

echo.
echo  ==================================================
echo            AmbientOS - One-Click Installer
echo  ==================================================
echo.

:: 1. Check Node.js installation
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  [Error] Node.js is not installed on this PC!
  echo  Please download and install Node.js from https://nodejs.org/ first.
  echo.
  pause
  exit /b
)

:: 2. Install Dependencies
echo  [1/4] Installing Node and Electron dependencies...
echo        (This may take 1-2 minutes, please wait...)
echo.
call npm install
if %errorlevel% neq 0 (
  echo  [Error] Failed to install dependencies! Make sure you are connected to the internet.
  echo.
  pause
  exit /b
)

:: 3. Register Auto-Startup Task via PowerShell
echo.
echo  [2/4] Registering Windows Scheduled Task for silent startup on logon...
powershell -NoProfile -ExecutionPolicy Bypass -Command "^
  $taskName = 'AmbientOS';^
  $workDir = '%~dp0';^
  $vbsPath = Join-Path $workDir 'start-server.vbs';^
  $action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument $vbsPath -WorkingDirectory $workDir;^
  $trigger = New-ScheduledTaskTrigger -AtLogOn;^
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries;^
  Register-ScheduledTask -TaskName $taskName -Trigger $trigger -Action $action -Settings $settings -Force;^
  Enable-ScheduledTask -TaskName $taskName;^
"
if %errorlevel% neq 0 (
  echo  [Warning] Scheduled Task registration failed!
  echo  You may need to run this command window as Administrator to complete this step.
) else (
  echo  [Success] Auto-startup registered! AmbientOS will boot silently whenever you log in.
)

:: 4. Verify credentials.json
echo.
echo  [3/4] Checking Google Cloud Credentials...
if not exist "credentials.json" (
  echo  [Notice] credentials.json is missing in this folder.
  echo  To connect your live Google account, please download your client_secret JSON
  echo  from Google Cloud Console, rename it to "credentials.json", and place it here.
) else (
  echo  [Success] credentials.json detected!
)

:: 5. Launch Overlay
echo.
echo  [4/4] Launching AmbientOS native overlay...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-ScheduledTask -TaskName 'AmbientOS'"

echo.
echo  ==================================================
echo            Setup Completed Successfully!
echo  ==================================================
echo.
echo  AmbientOS is now running silently in the background!
echo  👉 To connect Google, go to: http://localhost:3000/auth
echo.
pause
