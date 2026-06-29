@echo off
cd /d C:\autonomous-coder
if exist .git\index.lock del /f .git\index.lock
git add package.json
git commit -m "fix: use esbuild splitting so vite dynamic import stays lazy in production"
git push origin main
echo.
echo Done! Press any key to close.
pause
