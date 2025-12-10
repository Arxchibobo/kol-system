@echo off
chcp 65001 >nul
echo ========================================
echo    KOL 系统 - 一键启动测试脚本
echo ========================================
echo.

:: 1. 清理旧进程
echo [1/5] 正在清理旧的服务器进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    echo 发现占用 8080 端口的进程 %%a，正在关闭...
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 >nul

:: 2. 构建前端
echo.
echo [2/5] 正在构建前端代码...
call npm run build
if errorlevel 1 (
    echo [错误] 前端构建失败！
    pause
    exit /b 1
)

:: 3. 启动后端服务器
echo.
echo [3/5] 正在启动后端服务器...
start /B cmd /c "npm start > server.log 2>&1"
timeout /t 3 >nul

:: 4. 检查服务器是否启动成功
echo.
echo [4/5] 正在检查服务器状态...
timeout /t 2 >nul
netstat -ano | findstr :8080 | findstr LISTENING >nul
if errorlevel 1 (
    echo [错误] 服务器启动失败！请查看 server.log
    pause
    exit /b 1
)
echo [成功] 服务器已在 8080 端口启动！

:: 5. 打开浏览器
echo.
echo [5/5] 正在打开浏览器...
timeout /t 1 >nul
start http://localhost:8080

echo.
echo ========================================
echo    启动完成！
echo    前端地址: http://localhost:8080
echo    服务器日志: server.log
echo ========================================
echo.
echo 按任意键关闭此窗口（服务器将继续运行）
echo 如需停止服务器，请运行 stop-dev.bat
pause >nul
