@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Floorball Content Editor
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not available. Please contact the project maintainer.
  pause
  exit /b 1
)
if not exist "node_modules\markdown-it\package.json" (
  echo Project dependencies are missing. Please contact the project maintainer.
  pause
  exit /b 1
)
echo Starting the local visual editor...
echo Keep this window open while editing. Close it to stop the editor.
node ".local-editor\server.mjs" --open
if errorlevel 1 pause
