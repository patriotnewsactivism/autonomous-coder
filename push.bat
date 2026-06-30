@echo off
cd /d C:\autonomous-coder
if exist .git\index.lock del /f .git\index.lock

git add package.json Dockerfile
git add src/components/ide/MonacoEditor.tsx
git add src/components/ide/FileTree.tsx
git add src/components/ide/EditorTabs.tsx
git add src/components/ide/DiffViewer.tsx
git add src/components/ide/MemoryTab.tsx
git add src/components/ide/CinemaPanel.tsx
git add src/components/ide/MissionControlBar.tsx
git add src/components/ide/ErrorIngestionPanel.tsx
git add src/components/ide/IDEWorkspace.tsx
git add src/components/ide/index.ts
git add server/index.ts
git add src/pages/VibeCoding.tsx

git commit -m "feat: full IDE workspace — Monaco + FileTree + DiffViewer + MemoryTab + CinemaPanel + MissionControl + ErrorIngestion + IDEWorkspace resizable layout"

git push origin main

echo.
echo Done! Press any key to close.
pause
