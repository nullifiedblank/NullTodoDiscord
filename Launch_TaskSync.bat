@echo off
echo ===================================================
echo Starting TaskSync: Bot and Web Dashboard
echo ===================================================

:: Start the Discord Bot (we are already in the bot folder)
echo Starting Discord Bot...
start cmd /k "node index.js"

:: Start the Next.js Website (go into the nested web folder)
echo Starting Web Dashboard...
start cmd /k "cd discord-todo-web && npm run dev"

echo All systems launching! You can close this tiny window.
exit