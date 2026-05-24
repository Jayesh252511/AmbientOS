@echo off
title AmbientOS - Push to GitHub
cd /d "%~dp0"

echo.
echo  ==================================================
1: echo           AmbientOS - Git Push Automator
echo  ==================================================
echo.

:: 1. Check if git is initialized
if not exist ".git" (
  echo  [Error] Git is not initialized in this folder!
  echo  Initializing git repository now...
  git init -b master
)

:: 2. Prompt for GitHub repository URL
echo  Please paste your GitHub Repository URL.
echo  (Example: https://github.com/Jayesh252511/AmbientOS.git)
echo.
set /p repo_url="Enter URL: "

if "%repo_url%"=="" (
  echo  [Error] No URL entered. Exiting...
  pause
  exit /b
)

:: 3. Configure remote
echo.
echo  [1/3] Adding remote origin...
git remote remove origin >nul 2>&1
git remote add origin %repo_url%
if %errorlevel% neq 0 (
  echo  [Error] Failed to add remote origin.
  pause
  exit /b
)

:: 4. Stage and commit files
echo.
echo  [2/3] Staging and committing files...
git add .gitignore README.md package.json package-lock.json server.js notifications.js auth.js main.js setup.bat launch.bat start-server.vbs index.html script.js style.css public/
git commit -m "feat: initial commit for AmbientOS premium click-through overlay" >nul 2>&1

:: 5. Push to GitHub
echo.
echo  [3/3] Uploading code to GitHub...
echo        (A Windows security popup may appear to authenticate your account)
echo.
git push -u origin master

if %errorlevel% neq 0 (
  echo.
  echo  [Error] Push failed!
  echo  Please check if you typed the correct URL or if you are logged into GitHub in Git.
  echo.
) else (
  echo.
  echo  ==================================================
  echo      🎉 Code Uploaded to GitHub Successfully!
  echo  ==================================================
  echo.
  echo  Your repository is now online and perfectly saved.
  echo.
)

pause
