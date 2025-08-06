#!/bin/bash

echo "🏨 履约驱动酒店管理系统 - Codespace 初始化脚本"
echo "================================================"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查并安装依赖
echo -e "${YELLOW}📦 安装项目依赖...${NC}"
npm ci || npm install

# 安装后端依赖
echo -e "${YELLOW}📦 安装后端依赖...${NC}"
cd backend && (npm ci || npm install) && cd ..

# 安装全局工具（确保命令可用）
echo -e "${YELLOW}🔧 安装全局开发工具...${NC}"
npm install -g vite nodemon concurrently tsx typescript @xstate/cli

# 初始化数据库
echo -e "${YELLOW}🗄️ 初始化 CouchDB...${NC}"
# 等待 CouchDB 启动
sleep 5

# 创建必要的数据库
curl -X PUT http://admin:password@localhost:5984/_users 2>/dev/null || true
curl -X PUT http://admin:password@localhost:5984/_replicator 2>/dev/null || true
curl -X PUT http://admin:password@localhost:5984/hotel_guests 2>/dev/null || true

echo -e "${GREEN}✅ 数据库初始化完成${NC}"

# 创建演示数据
echo -e "${YELLOW}📊 创建演示数据...${NC}"
# 这里可以运行创建演示数据的脚本

# 设置 Git 配置
echo -e "${YELLOW}🔧 配置 Git...${NC}"
git config --global user.email "developer@codespace.local"
git config --global user.name "Codespace Developer"

# 显示系统信息
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 Codespace 环境准备就绪！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📋 快速开始指南："
echo "1. 启动前端: npm run dev"
echo "2. 启动后端: cd backend && npm run dev"
echo "3. 访问应用: http://localhost:3000"
echo ""
echo "🔗 服务地址："
echo "- 前端应用: http://localhost:3000"
echo "- 后端 API: http://localhost:8080"
echo "- CouchDB: http://localhost:5984/_utils"
echo "- Redis: localhost:6379"
echo ""
echo "💡 提示: 使用 'npm run help' 查看所有可用命令"