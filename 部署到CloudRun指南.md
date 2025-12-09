# 部署到 Google Cloud Run 指南

## 📋 前置准备

### 1. 安装 Google Cloud SDK

**Windows 安装:**

1. 下载安装程序: https://cloud.google.com/sdk/docs/install
2. 运行安装程序 `GoogleCloudSDKInstaller.exe`
3. 重启终端验证安装:
   ```bash
   gcloud --version
   ```

### 2. 创建 GCP 项目

1. 访问: https://console.cloud.google.com/
2. 点击顶部的项目选择器
3. 点击 "新建项目"
4. 输入项目名称 (例如: `myshell-kol-system`)
5. 记录项目ID (例如: `myshell-kol-123456`)

### 3. 启用必要的 API

在 GCP 控制台中启用:
- Cloud Run API
- Cloud Build API
- Container Registry API

或使用命令行:
```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

---

## 🚀 部署步骤

### 步骤 1: 登录 GCP

```bash
gcloud auth login
```

这会打开浏览器让你登录 Google 账号。

### 步骤 2: 设置项目

```bash
# 设置项目ID (替换为你的项目ID)
gcloud config set project myshell-kol-123456

# 设置默认区域 (亚洲东部)
gcloud config set run/region asia-east1
```

### 步骤 3: 构建并推送 Docker 镜像

```bash
# 进入项目目录
cd "e:\Bobo's Coding cache\kol-system"

# 构建镜像并推送到 Google Container Registry
gcloud builds submit --tag gcr.io/myshell-kol-123456/kol-system
```

**预期输出**:
```
Creating temporary tarball archive...
Uploading tarball of [.] to [gs://...]
...
DONE
--------------------------------------------------------------------------------
ID                                    CREATE_TIME                DURATION  SOURCE    IMAGES    STATUS
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  2025-XX-XXTXX:XX:XX+00:00  2M30S     gs://...  gcr.io/myshell-kol-123456/kol-system  SUCCESS
```

### 步骤 4: 部署到 Cloud Run

```bash
gcloud run deploy kol-system \
  --image gcr.io/myshell-kol-123456/kol-system \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --set-env-vars DOMAIN=myshell.site \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10
```

**参数说明**:
- `--image`: Docker 镜像地址
- `--platform managed`: 使用完全托管的 Cloud Run
- `--region`: 部署区域 (亚洲东部 - 香港)
- `--allow-unauthenticated`: 允许未认证访问
- `--set-env-vars`: 设置环境变量
- `--port`: 容器端口
- `--memory`: 内存限制
- `--cpu`: CPU 数量
- `--max-instances`: 最大实例数

**预期输出**:
```
Deploying container to Cloud Run service [kol-system] in project [myshell-kol-123456] region [asia-east1]
✓ Deploying new service... Done.
  ✓ Creating Revision...
  ✓ Routing traffic...
Done.
Service [kol-system] revision [kol-system-00001-xxx] has been deployed and is serving 100 percent of traffic.
Service URL: https://kol-system-xxxxxxxxxx-df.a.run.app
```

### 步骤 5: 测试部署

```bash
# 获取服务 URL
SERVICE_URL=$(gcloud run services describe kol-system --region asia-east1 --format 'value(status.url)')

# 测试健康检查
curl $SERVICE_URL/health

# 测试创建短链接
curl -X POST $SERVICE_URL/api/tracking-links \
  -H "Content-Type: application/json" \
  -d '{"creator_user_id":"test","task_id":"t-1","campaign_id":"c-1","target_url":"https://art.myshell.ai/cosplay/zootopia-2-poster-maker"}'
```

---

## 🌐 配置自定义域名

### 步骤 1: 在 Cloud Run 中添加域名

```bash
# 映射域名到服务
gcloud run domain-mappings create --service kol-system --domain myshell.site --region asia-east1
```

### 步骤 2: 配置 DNS 记录

Cloud Run 会提供 DNS 记录信息,在你的域名服务商 (Cloudflare) 添加:

```
类型: CNAME
名称: myshell.site (或 @)
目标: ghs.googlehosted.com
代理状态: 仅 DNS (橙色云朵关闭)
```

或者使用 A 记录:
```
类型: A
名称: @
目标: [Cloud Run 提供的 IP 地址]
```

**验证 DNS**:
```bash
nslookup myshell.site
```

### 步骤 3: 等待 SSL 证书

Cloud Run 会自动配置 SSL 证书,通常需要 15-60 分钟。

**检查状态**:
```bash
gcloud run domain-mappings describe --domain myshell.site --region asia-east1
```

---

## 🔄 更新部署

### 方法 1: 重新构建和部署

```bash
# 1. 构建新镜像
gcloud builds submit --tag gcr.io/myshell-kol-123456/kol-system

# 2. 部署新版本
gcloud run deploy kol-system \
  --image gcr.io/myshell-kol-123456/kol-system \
  --region asia-east1
```

### 方法 2: 使用脚本

创建 `deploy.sh`:
```bash
#!/bin/bash
PROJECT_ID="myshell-kol-123456"
SERVICE_NAME="kol-system"
REGION="asia-east1"

echo "🚀 开始部署到 Cloud Run..."

echo "📦 构建 Docker 镜像..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

echo "🌐 部署服务..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars DOMAIN=myshell.site

echo "✅ 部署完成!"
```

运行:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 📊 监控和日志

### 查看日志

```bash
# 实时查看日志
gcloud run services logs read kol-system --region asia-east1 --follow

# 查看最近的日志
gcloud run services logs read kol-system --region asia-east1 --limit 50
```

### 查看指标

访问: https://console.cloud.google.com/run

选择服务 → 指标标签

可以查看:
- 请求数
- 延迟
- 错误率
- CPU 使用率
- 内存使用率

---

## 🔧 常用命令

### 查看服务信息

```bash
gcloud run services describe kol-system --region asia-east1
```

### 列出所有服务

```bash
gcloud run services list
```

### 删除服务

```bash
gcloud run services delete kol-system --region asia-east1
```

### 查看配置

```bash
gcloud config list
```

---

## 💰 费用估算

Cloud Run 按使用量计费:

**免费额度** (每月):
- 2 百万次请求
- 360,000 GB-秒
- 180,000 vCPU-秒

**超出后的价格**:
- 请求: $0.40 / 百万次
- CPU: $0.00002400 / vCPU-秒
- 内存: $0.00000250 / GB-秒

**预估月费用** (中等流量):
- 100万次请求/月: 免费
- 实例运行时间: 约 $5-10/月

---

## 🐛 故障排查

### 问题 1: 构建失败

**检查**:
```bash
gcloud builds list --limit 5
```

**查看构建日志**:
```bash
gcloud builds log [BUILD_ID]
```

### 问题 2: 部署超时

**增加超时时间**:
```bash
gcloud run deploy kol-system \
  --image gcr.io/myshell-kol-123456/kol-system \
  --timeout 300s
```

### 问题 3: 内存不足

**增加内存**:
```bash
gcloud run deploy kol-system \
  --image gcr.io/myshell-kol-123456/kol-system \
  --memory 1Gi
```

### 问题 4: 域名映射失败

**检查域名状态**:
```bash
gcloud run domain-mappings describe --domain myshell.site --region asia-east1
```

---

## 🔐 安全建议

### 1. 限制访问来源

```bash
gcloud run services set-iam-policy kol-system policy.yaml
```

### 2. 使用 Secret Manager 存储敏感信息

```bash
# 创建 secret
echo -n "your-secret-value" | gcloud secrets create api-key --data-file=-

# 在 Cloud Run 中使用
gcloud run deploy kol-system \
  --update-secrets=API_KEY=api-key:latest
```

### 3. 启用 VPC 连接器 (可选)

用于连接私有数据库等资源。

---

## 📞 获取帮助

- **官方文档**: https://cloud.google.com/run/docs
- **定价**: https://cloud.google.com/run/pricing
- **社区支持**: https://stackoverflow.com/questions/tagged/google-cloud-run

---

## ✅ 部署检查清单

- [ ] 安装 gcloud CLI
- [ ] 创建 GCP 项目
- [ ] 启用必要的 API
- [ ] 构建 Docker 镜像
- [ ] 部署到 Cloud Run
- [ ] 配置自定义域名
- [ ] 配置 DNS 记录
- [ ] 等待 SSL 证书生效
- [ ] 测试所有功能
- [ ] 配置监控和告警

---

**下一步**: 按照上述步骤完成部署后,你的服务将在 `https://myshell.site` 上线!
