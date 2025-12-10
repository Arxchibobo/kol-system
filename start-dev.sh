#!/bin/bash
# KOL 系统 - 一键启动测试脚本 (Git Bash 版本)

echo "========================================"
echo "   KOL 系统 - 一键启动测试脚本"
echo "========================================"
echo ""

# 1. 清理旧进程
echo "[1/5] 正在清理旧的服务器进程..."
OLD_PID=$(netstat -ano | grep :8080 | grep LISTENING | awk '{print $5}' | head -1)
if [ ! -z "$OLD_PID" ]; then
    echo "发现占用 8080 端口的进程 $OLD_PID，正在关闭..."
    taskkill //F //PID $OLD_PID > /dev/null 2>&1
fi
sleep 1

# 2. 构建前端
echo ""
echo "[2/5] 正在构建前端代码..."
npm run build
if [ $? -ne 0 ]; then
    echo "[错误] 前端构建失败！"
    read -p "按 Enter 键退出..."
    exit 1
fi

# 3. 启动后端服务器
echo ""
echo "[3/5] 正在启动后端服务器..."
npm start > server.log 2>&1 &
sleep 3

# 4. 检查服务器是否启动成功
echo ""
echo "[4/5] 正在检查服务器状态..."
sleep 2
SERVER_PID=$(netstat -ano | grep :8080 | grep LISTENING | awk '{print $5}' | head -1)
if [ -z "$SERVER_PID" ]; then
    echo "[错误] 服务器启动失败！请查看 server.log"
    read -p "按 Enter 键退出..."
    exit 1
fi
echo "[成功] 服务器已在 8080 端口启动！(PID: $SERVER_PID)"

# 5. 打开浏览器
echo ""
echo "[5/5] 正在打开浏览器..."
sleep 1
start http://localhost:8080

echo ""
echo "========================================"
echo "   启动完成！"
echo "   前端地址: http://localhost:8080"
echo "   服务器日志: server.log"
echo "   服务器 PID: $SERVER_PID"
echo "========================================"
echo ""
echo "按 Enter 键关闭此窗口（服务器将继续运行）"
echo "如需停止服务器，请运行: ./stop-dev.sh"
read -p ""
