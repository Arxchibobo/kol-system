# GCP 快速配置指南

## 🎯 目标
在 10 分钟内完成 Google Cloud Platform 配置,准备部署

---

## 📝 步骤 1: 安装 Google Cloud SDK

### Windows 安装

1. **下载安装程序**
   - 访问: https://cloud.google.com/sdk/docs/install#windows
   - 下载 `GoogleCloudSDKInstaller.exe`

2. **运行安装**
   - 双击运行安装程序
   - 保持默认选项
   - 勾选 "Start Google Cloud SDK Shell" 和 "Run gcloud init"

3. **验证安装**
   打开 Git Bash 或 PowerShell:
   ```bash
   gcloud --version
   ```

   应该看到类似输出:
   ```
   Google Cloud SDK 456.0.0
   bq 2.0.101
   core 2024.01.05
   gcloud-crc32c 1.0.0
   gsutil 5.27
   ```

---

## 🏗️ 步骤 2: 创建 GCP 项目

### 方法 1: 通过网页控制台

1. **访问 GCP 控制台**
   - https://console.cloud.google.com/

2. **创建新项目**
   - 点击顶部项目选择器
   - 点击 "新建项目"
   - 项目名称: `MyShell KOL System`
   - 项目ID: `myshell-kol-[随机数字]` (例如: `myshell-kol-123456`)
   - 点击 "创建"

3. **记录项目信息**
   ```
   项目名称: MyShell KOL System
   项目ID: myshell-kol-123456
   项目编号: 123456789012
   ```

### 方法 2: 通过命令行

```bash
# 创建项目 (项目ID必须全局唯一)
gcloud projects create myshell-kol-123456 --name="MyShell KOL System"

# 设置为当前项目
gcloud config set project myshell-kol-123456
```

---

## 💳 步骤 3: 启用结算账户

⚠️ **重要**: Cloud Run 需要启用结算账户,但有免费额度

1. **访问结算页面**
   - https://console.cloud.google.com/billing

2. **创建结算账户**
   - 点击 "创建账户"
   - 填写信用卡信息 (用于验证身份)
   - **新用户可获得 $300 免费额度**

3. **关联项目**
   - 选择刚创建的项目
   - 点击 "关联结算账户"

---

## 🔌 步骤 4: 启用必要的 API

### 方法 1: 通过网页控制台

1. **访问 API 库**
   - https://console.cloud.google.com/apis/library

2. **启用以下 API**:
   - Cloud Run API
   - Cloud Build API
   - Container Registry API
   - Artifact Registry API

### 方法 2: 通过命令行 (推荐)

```bash
# 启用所有必要的 API
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# 验证已启用的服务
gcloud services list --enabled
```

---

## 🔑 步骤 5: 配置 gcloud CLI

### 初始化配置

```bash
# 登录 Google 账号
gcloud auth login

# 设置默认项目
gcloud config set project myshell-kol-123456

# 设置默认区域
gcloud config set run/region asia-east1

# 设置默认计算区域 (可选)
gcloud config set compute/region asia-east1
gcloud config set compute/zone asia-east1-a

# 验证配置
gcloud config list
```

**预期输出**:
```
[compute]
region = asia-east1
zone = asia-east1-a
[core]
account = your-email@gmail.com
disable_usage_reporting = False
project = myshell-kol-123456
[run]
region = asia-east1
```

---

## ✅ 步骤 6: 验证配置

运行以下命令测试:

```bash
# 测试认证
gcloud auth list

# 测试项目访问
gcloud projects describe myshell-kol-123456

# 测试 Cloud Run 访问
gcloud run services list --region asia-east1
```

---

## 🚀 准备就绪!

现在你可以运行部署脚本了:

### Windows:
```bash
deploy-cloudrun.bat
```

### Linux/Mac:
```bash
chmod +x deploy-cloudrun.sh
./deploy-cloudrun.sh
```

---

## 🔧 常见问题

### Q1: gcloud 命令找不到

**Windows 解决方案**:
1. 重启终端
2. 或者将 Google Cloud SDK 添加到 PATH:
   - `C:\Users\[用户名]\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin`

### Q2: 项目ID已存在

**解决方案**:
使用不同的项目ID,例如添加随机数字:
```bash
myshell-kol-789456
myshell-kol-system-2024
```

### Q3: API 启用失败

**解决方案**:
1. 确认已启用结算账户
2. 等待几分钟后重试
3. 通过网页控制台手动启用

### Q4: 权限不足

**解决方案**:
确保你的 Google 账号有以下权限:
- 项目编辑者 (Editor)
- 或 Cloud Run 管理员 + Cloud Build 管理员

---

## 💰 费用说明

### Cloud Run 免费额度 (每月):
- ✅ 2,000,000 次请求
- ✅ 360,000 GB-秒 (内存)
- ✅ 180,000 vCPU-秒

### 预估费用:
- **小流量** (< 1万次请求/天): **$0 - $2/月**
- **中等流量** (1-10万次请求/天): **$5 - $15/月**
- **大流量** (> 10万次请求/天): **$15 - $50/月**

### 节省费用技巧:
1. 使用 `--memory 512Mi` (最小内存)
2. 设置 `--max-instances` 限制最大实例数
3. 启用 "CPU 仅在请求处理时分配"

---

## 📞 获取帮助

- **官方文档**: https://cloud.google.com/run/docs/quickstarts/build-and-deploy
- **计费**: https://console.cloud.google.com/billing
- **配额**: https://console.cloud.google.com/iam-admin/quotas

---

## 📋 配置检查清单

- [ ] 安装 Google Cloud SDK
- [ ] 创建 GCP 项目
- [ ] 启用结算账户
- [ ] 启用必要的 API
- [ ] 配置 gcloud CLI
- [ ] 验证配置正确
- [ ] 准备部署!

---

**下一步**: 运行 `deploy-cloudrun.bat` 开始部署!
