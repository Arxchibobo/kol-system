#!/bin/bash

# Google Cloud Run 部署脚本
# 使用方法: ./deploy-cloudrun.sh

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}"
echo "========================================="
echo "  MyShell KOL System"
echo "  部署到 Google Cloud Run"
echo "========================================="
echo -e "${NC}"

# 检查是否安装 gcloud
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ 错误: 未找到 gcloud 命令${NC}"
    echo ""
    echo "请先安装 Google Cloud SDK:"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# 获取项目ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠️  未设置 GCP 项目${NC}"
    echo ""
    read -p "请输入你的 GCP 项目ID: " PROJECT_ID
    gcloud config set project $PROJECT_ID
fi

echo -e "${GREEN}✓ 使用项目: $PROJECT_ID${NC}"

# 设置变量
SERVICE_NAME="kol-system"
REGION="asia-east1"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"

# 确认部署
echo ""
echo "准备部署:"
echo "  项目ID: $PROJECT_ID"
echo "  服务名: $SERVICE_NAME"
echo "  区域: $REGION"
echo "  镜像: $IMAGE"
echo ""
read -p "继续部署? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "取消部署"
    exit 1
fi

# 构建镜像
echo ""
echo -e "${YELLOW}📦 正在构建 Docker 镜像...${NC}"
gcloud builds submit --tag $IMAGE

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 镜像构建失败${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 镜像构建成功${NC}"

# 部署到 Cloud Run
echo ""
echo -e "${YELLOW}🚀 正在部署到 Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars DOMAIN=myshell.site \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --timeout 300

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 部署失败${NC}"
    exit 1
fi

# 获取服务 URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✅ 部署成功!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "服务 URL: $SERVICE_URL"
echo ""
echo "测试命令:"
echo "  curl $SERVICE_URL/health"
echo ""
echo "查看日志:"
echo "  gcloud run services logs read $SERVICE_NAME --region $REGION --follow"
echo ""
echo "配置自定义域名:"
echo "  gcloud run domain-mappings create --service $SERVICE_NAME --domain myshell.site --region $REGION"
echo ""
