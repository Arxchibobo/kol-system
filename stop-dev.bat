@echo off
chcp 65001 >nul
echo ========================================
echo    KOL 系统 - 停止服务器脚本
echo ========================================
echo.

echo 正在查找并关闭占用 8080 端口的进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    echo 发现进程 %%a，正在关闭...
    taskkill /F /PID %%a
)

echo.
echo [完成] 服务器已停止
echo.
pause
