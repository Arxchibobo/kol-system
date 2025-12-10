@echo off
chcp 65001 >nul
echo ========================================
echo    KOL 系统 - 快速重启脚本
echo    (不重新构建前端)
echo ========================================
echo.

:: 1. 停止服务器
echo [1/3] 正在停止旧服务器...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 >nul

:: 2. 启动服务器
echo.
echo [2/3] 正在启动服务器...
start /B cmd /c "npm start > server.log 2>&1"
timeout /t 3 >nul

:: 3. 打开浏览器
echo.
echo [3/3] 正在打开浏览器...
start http://localhost:8080

echo.
echo ========================================
echo    重启完成！
echo    前端地址: http://localhost:8080
echo ========================================
echo.
pause
