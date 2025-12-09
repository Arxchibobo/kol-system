@echo off
echo ========================================
echo   测试 Docker 镜像构建
echo ========================================
echo.

REM 检查 Docker 是否运行
docker version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] Docker 未运行
    echo 请先启动 Docker Desktop
    pause
    exit /b 1
)

echo [1/3] 构建 Docker 镜像...
docker build -t kol-system:test .

if %ERRORLEVEL% NEQ 0 (
    echo [错误] 构建失败
    pause
    exit /b 1
)

echo.
echo [2/3] 启动容器...
docker run -d -p 8080:8080 --name kol-system-test kol-system:test

if %ERRORLEVEL% NEQ 0 (
    echo [错误] 启动失败
    docker rm -f kol-system-test 2>nul
    pause
    exit /b 1
)

echo.
echo [3/3] 等待服务启动...
timeout /t 5 >nul

echo.
echo 测试健康检查...
curl -s http://localhost:8080/health

echo.
echo.
echo ========================================
echo   测试完成!
echo ========================================
echo.
echo 服务运行在: http://localhost:8080
echo.
echo 查看日志: docker logs -f kol-system-test
echo 停止容器: docker stop kol-system-test
echo 删除容器: docker rm -f kol-system-test
echo.

pause
