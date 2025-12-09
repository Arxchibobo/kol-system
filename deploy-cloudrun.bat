@echo off
setlocal enabledelayedexpansion

REM Google Cloud Run 部署脚本 (Windows)
REM 使用方法: deploy-cloudrun.bat

echo =========================================
echo   MyShell KOL System
echo   部署到 Google Cloud Run
echo =========================================
echo.

REM 检查是否安装 gcloud
where gcloud >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未找到 gcloud 命令
    echo.
    echo 请先安装 Google Cloud SDK:
    echo https://cloud.google.com/sdk/docs/install
    pause
    exit /b 1
)

REM 获取项目ID
for /f "tokens=*" %%i in ('gcloud config get-value project 2^>nul') do set PROJECT_ID=%%i

if "!PROJECT_ID!"=="" (
    echo [警告] 未设置 GCP 项目
    echo.
    set /p PROJECT_ID="请输入你的 GCP 项目ID: "
    gcloud config set project !PROJECT_ID!
)

echo [OK] 使用项目: !PROJECT_ID!

REM 设置变量
set SERVICE_NAME=kol-system
set REGION=asia-east1
set IMAGE=gcr.io/!PROJECT_ID!/!SERVICE_NAME!

REM 确认部署
echo.
echo 准备部署:
echo   项目ID: !PROJECT_ID!
echo   服务名: !SERVICE_NAME!
echo   区域: !REGION!
echo   镜像: !IMAGE!
echo.
set /p CONFIRM="继续部署? (y/n): "
if /i not "!CONFIRM!"=="y" (
    echo 取消部署
    exit /b 0
)

REM 构建镜像
echo.
echo [1/2] 正在构建 Docker 镜像...
gcloud builds submit --tag !IMAGE!

if %ERRORLEVEL% NEQ 0 (
    echo [错误] 镜像构建失败
    pause
    exit /b 1
)

echo [OK] 镜像构建成功

REM 部署到 Cloud Run
echo.
echo [2/2] 正在部署到 Cloud Run...
gcloud run deploy !SERVICE_NAME! ^
  --image !IMAGE! ^
  --platform managed ^
  --region !REGION! ^
  --allow-unauthenticated ^
  --set-env-vars DOMAIN=myshell.site ^
  --port 8080 ^
  --memory 512Mi ^
  --cpu 1 ^
  --max-instances 10 ^
  --timeout 300

if %ERRORLEVEL% NEQ 0 (
    echo [错误] 部署失败
    pause
    exit /b 1
)

REM 获取服务 URL
for /f "tokens=*" %%i in ('gcloud run services describe !SERVICE_NAME! --region !REGION! --format "value(status.url)"') do set SERVICE_URL=%%i

echo.
echo =========================================
echo   部署成功!
echo =========================================
echo.
echo 服务 URL: !SERVICE_URL!
echo.
echo 测试命令:
echo   curl !SERVICE_URL!/health
echo.
echo 查看日志:
echo   gcloud run services logs read !SERVICE_NAME! --region !REGION! --follow
echo.
echo 配置自定义域名:
echo   gcloud run domain-mappings create --service !SERVICE_NAME! --domain myshell.site --region !REGION!
echo.

pause
