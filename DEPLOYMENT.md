# 部署指南

## 📋 环境要求

- Node.js 18+
- npm 或 yarn
- 域名配置: `myshell.site`

---

## 🚀 部署到云端

### 方案 1: Google Cloud Run (推荐)

#### 1.1 准备 Dockerfile

项目已包含 `Dockerfile`,无需额外配置。

#### 1.2 构建并推送镜像

```bash
# 配置项目ID
gcloud config set project YOUR_PROJECT_ID

# 构建镜像
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/kol-system

# 部署到 Cloud Run
gcloud run deploy kol-system \
  --image gcr.io/YOUR_PROJECT_ID/kol-system \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --set-env-vars DOMAIN=myshell.site
```

#### 1.3 配置域名

在 Cloud Run 控制台:
1. 选择服务 → "管理自定义域名"
2. 添加 `myshell.site`
3. 按照提示配置 DNS 记录

---

### 方案 2: Vercel (简单快速)

#### 2.1 安装 Vercel CLI

```bash
npm install -g vercel
```

#### 2.2 部署

```bash
vercel
```

按照提示完成部署。

#### 2.3 配置环境变量

在 Vercel 控制台:
1. 项目设置 → Environment Variables
2. 添加: `DOMAIN=myshell.site`

---

### 方案 3: 自建服务器

#### 3.1 安装依赖

```bash
cd /path/to/kol-system
npm install --production
```

#### 3.2 构建前端

```bash
npm run build
```

#### 3.3 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start npm --name "kol-system" -- start

# 开机自启动
pm2 startup
pm2 save
```

#### 3.4 配置 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name myshell.site;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 3.5 配置 SSL (Let's Encrypt)

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d myshell.site
```

---

## 🔧 环境变量

创建 `.env` 文件:

```bash
PORT=8080
DOMAIN=myshell.site
NODE_ENV=production
```

---

## 📊 数据库

项目使用 SQLite,数据存储在 `/tmp/tracking.sqlite`

**注意**:
- Cloud Run 使用临时文件系统,重启后数据会丢失
- 生产环境建议使用 Cloud SQL 或其他持久化数据库

### 迁移到 PostgreSQL (可选)

如需持久化存储,可以修改 `backend/database.ts` 使用 PostgreSQL:

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
```

---

## 🔐 安全配置

### CORS 配置

在 `backend/server.ts` 中已配置 CORS:

```typescript
app.use(cors());
```

生产环境建议限制来源:

```typescript
app.use(cors({
  origin: ['https://myshell.site', 'https://www.myshell.site']
}));
```

### 环境变量

不要在代码中硬编码敏感信息,使用环境变量:

```typescript
const SECRET_KEY = process.env.SECRET_KEY;
```

---

## 📈 监控和日志

### 使用 Cloud Logging (GCP)

日志会自动发送到 Cloud Logging。

### 使用 PM2 (自建服务器)

```bash
# 查看日志
pm2 logs kol-system

# 查看监控
pm2 monit
```

---

## 🧪 健康检查

服务提供健康检查端点:

```bash
curl https://myshell.site/health
```

返回:
```json
{
  "status": "ok",
  "domain": "myshell.site",
  "version": "v9-stable-double-jump",
  "timestamp": "2025-12-09T03:00:00.000Z"
}
```

---

## 🔄 持续集成/持续部署

### GitHub Actions 示例

创建 `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Cloud SDK
        uses: google-github-actions/setup-gcloud@v0
        with:
          project_id: ${{ secrets.GCP_PROJECT_ID }}
          service_account_key: ${{ secrets.GCP_SA_KEY }}

      - name: Build and Deploy
        run: |
          gcloud builds submit --tag gcr.io/${{ secrets.GCP_PROJECT_ID }}/kol-system
          gcloud run deploy kol-system \
            --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/kol-system \
            --platform managed \
            --region asia-east1 \
            --allow-unauthenticated
```

---

## 🐛 故障排查

### 问题 1: 短链接无法跳转

**检查**:
1. 确认 `DOMAIN` 环境变量设置正确
2. 检查数据库连接
3. 查看服务器日志

### 问题 2: 数据丢失

**原因**: Cloud Run 使用临时文件系统

**解决**: 使用 Cloud SQL 或其他持久化存储

### 问题 3: CORS 错误

**解决**: 检查 `backend/server.ts` 中的 CORS 配置

---

## 📞 支持

如有问题,请查看:
- [GitHub Issues](https://github.com/your-repo/issues)
- [文档](./README.md)
