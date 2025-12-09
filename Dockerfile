# ==========================================
# 阶段 1: 构建阶段
# ==========================================
FROM node:22-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装所有依赖 (包括 devDependencies)
RUN npm ci

# 复制源代码
COPY . .

# 构建前端
RUN npm run build

# ==========================================
# 阶段 2: 生产阶段
# ==========================================
FROM node:22-alpine

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 只安装生产依赖 + tsx (运行时需要)
RUN npm ci --omit=dev && \
    npm install tsx sql.js

# 从构建阶段复制构建产物
COPY --from=builder /app/dist ./dist

# 复制后端代码
COPY backend ./backend

# 复制其他必要文件
COPY tsconfig.json ./

# 暴露端口
EXPOSE 8080

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动服务器
CMD ["npx", "tsx", "backend/server.ts"]
