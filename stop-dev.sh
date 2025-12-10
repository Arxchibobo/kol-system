#!/bin/bash
# KOL 系统 - 停止服务器脚本 (Git Bash 版本)

echo "========================================"
echo "   KOL 系统 - 停止服务器脚本"
echo "========================================"
echo ""

echo "正在查找并关闭占用 8080 端口的进程..."
SERVER_PID=$(netstat -ano | grep :8080 | grep LISTENING | awk '{print $5}' | head -1)

if [ ! -z "$SERVER_PID" ]; then
    echo "发现进程 $SERVER_PID，正在关闭..."
    taskkill //F //PID $SERVER_PID
    echo ""
    echo "[完成] 服务器已停止"
else
    echo "[提示] 没有发现运行中的服务器"
fi

echo ""
read -p "按 Enter 键退出..."
