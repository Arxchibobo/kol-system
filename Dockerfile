# 使用 Node.js 22 LTS
FROM node:22-alpine

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 安装构建依赖
RUN npm install -g tsx

# 复制源代码
COPY . .

# 构建前端
RUN npm run build

# 暴露端口
EXPOSE 8080

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=8080

# 启动服务器
CMD ["tsx", "backend/server.ts"]
