@echo off
chcp 65001 >nul
cd /d "D:\02_projects\ZZC"
echo ============================================
echo  Upload site updates to zzcspace.com
echo ============================================
git add -A
git commit -m "update: site changes" >nul 2>&1
git push origin main
if %errorlevel%==0 (
  echo.
  echo [OK] Pushed! Vercel updates the live site in 1-2 min.
) else (
  echo.
  echo [INFO] If there was nothing new to commit, the site is already up to date.
)
echo.
pause
