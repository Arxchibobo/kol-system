# MyShell Affiliate Center

KOL 推广系统 - 短链接追踪和达人管理平台

## ✨ 功能特性

- 🔗 **短链接生成**: 6位随机代码,真正的短链接
- 📊 **点击追踪**: 实时统计点击数据
- 🎯 **UTM 参数**: 自动添加追踪参数到目标 URL
- 👥 **达人管理**: 多角色权限管理(管理员/运营/达人)
- 📈 **数据统计**: 可视化展示推广效果
- 🚀 **两次跳转**: 记录点击 + 带参数重定向

## 🚀 快速开始

### 本地开发

**环境要求**:
- Node.js 18+
- npm 或 yarn

**启动步骤**:

```bash
# 1. 克隆项目
git clone <repository-url>
cd kol-system

# 2. 安装依赖
npm install

# 3. 启动服务器
npm start
```

访问: `http://localhost:8080`

### Windows 快速启动

双击运行 `启动服务器.bat`

## 📋 技术栈

### 前端
- React 19 + TypeScript
- Vite 5 (构建工具)
- Tailwind CSS (样式)
- Lucide React (图标)
- Recharts (图表)

### 后端
- Node.js + Express
- TypeScript
- SQLite (sql.js)
- tsx (TypeScript 运行时)

## 🔧 开发命令

```bash
# 启动开发服务器
npm start

# 构建前端
npm run build

# 预览构建结果
npm run serve
```

## 📚 项目结构

```
kol-system/
├── backend/              # 后端代码
│   ├── server.ts        # Express 服务器
│   └── database.ts      # 数据库操作
├── components/          # React 组件
├── contexts/            # React Context
├── services/            # 业务逻辑
├── dist/               # 前端构建输出
├── vite.config.mts     # Vite 配置
└── package.json        # 项目依赖
```

## 🌐 部署

详细部署指南请参考: [DEPLOYMENT.md](./DEPLOYMENT.md)

### 快速部署到 Cloud Run

```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/kol-system
gcloud run deploy kol-system \
  --image gcr.io/PROJECT_ID/kol-system \
  --platform managed \
  --allow-unauthenticated
```

## 🔗 短链接系统

### 生成短链接

```bash
POST /api/tracking-links
Content-Type: application/json

{
  "creator_user_id": "user-123",
  "task_id": "t-task-1",
  "campaign_id": "c-campaign-1",
  "target_url": "https://example.com"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "short_url": "https://myshell.site/abc123",
    "code": "abc123",
    "target_url": "https://example.com"
  }
}
```

### 短链接跳转

访问: `https://myshell.site/abc123`

自动跳转到: `https://example.com?utm_source=myshell&utm_medium=affiliate&aff_id=user-123&task_id=t-task-1&ref=abc123`

### 统计数据

```bash
GET /api/stats/affiliate/:userId
```

**响应**:
```json
{
  "totalClicks": 42
}
```

## 🔐 环境变量

创建 `.env` 文件:

```bash
PORT=8080
DOMAIN=myshell.site
NODE_ENV=production
```

## 🧪 测试

### API 测试

```bash
# 健康检查
curl http://localhost:8080/health

# 创建短链接
curl -X POST http://localhost:8080/api/tracking-links \
  -H "Content-Type: application/json" \
  -d '{"creator_user_id":"test","task_id":"t-1","campaign_id":"c-1","target_url":"https://example.com"}'

# 测试跳转
curl -I http://localhost:8080/abc123
```

### 用户测试

参考: [USER_TEST_CHECKLIST.md](./USER_TEST_CHECKLIST.md)

## 📊 数据库

项目使用 SQLite,数据存储在 `/tmp/tracking.sqlite`

**表结构**:

### links 表
- `id`: 主键
- `code`: 短链接代码 (唯一)
- `creator_user_id`: 创建者 ID
- `task_id`: 任务 ID
- `campaign_id`: 活动 ID
- `target_url`: 目标 URL
- `created_at`: 创建时间
- `click_count`: 点击次数

### clicks 表
- `id`: 主键
- `link_id`: 关联的链接 ID
- `ip_address`: 访客 IP
- `user_agent`: 用户代理
- `referrer`: 来源页面
- `clicked_at`: 点击时间

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📄 许可

MIT License

## 📞 支持

如有问题,请查看:
- [部署指南](./DEPLOYMENT.md)
- [测试报告](./TEST_REPORT.md)
- [用户测试清单](./USER_TEST_CHECKLIST.md)
