@echo off
cd /d C:\autonomous-coder
if exist .git\index.lock del /f .git\index.lock
git add Dockerfile render.yaml .dockerignore
git commit -m "fix: remove --no-optional from builder stage (rollup/esbuild need platform binaries)"
git push origin main
echo.
echo Done! Press any key to close.
pause
