#!/bin/bash

echo "🔧 修复 Codespace 依赖问题"
echo "================================"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查当前位置
echo -e "${YELLOW}📍 检查当前位置...${NC}"
pwd

# 回到项目根目录
cd ~/fulfillment-driven-hotel-management || {
    echo -e "${RED}❌ 无法找到项目目录${NC}"
    exit 1
}

echo -e "${GREEN}✅ 切换到项目根目录${NC}"

# 检查 Node.js 和 npm 版本
echo -e "${YELLOW}🔍 检查 Node.js 和 npm 版本...${NC}"
node --version
npm --version

# 清理并重新安装前端依赖
echo -e "${YELLOW}📦 清理并重新安装前端依赖...${NC}"
rm -rf node_modules package-lock.json
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 前端依赖安装成功${NC}"
else
    echo -e "${RED}❌ 前端依赖安装失败${NC}"
    exit 1
fi

# 清理并重新安装后端依赖
echo -e "${YELLOW}📦 清理并重新安装后端依赖...${NC}"
cd backend
rm -rf node_modules package-lock.json
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 后端依赖安装成功${NC}"
else
    echo -e "${RED}❌ 后端依赖安装失败${NC}"
    exit 1
fi

cd ..

# 安装全局工具
echo -e "${YELLOW}🔧 安装全局开发工具...${NC}"
npm install -g vite nodemon concurrently tsx typescript @xstate/cli

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 全局工具安装成功${NC}"
else
    echo -e "${YELLOW}⚠️ 全局工具安装可能失败，但不影响使用${NC}"
fi

# 验证工具可用性
echo -e "${YELLOW}🧪 验证工具可用性...${NC}"

if command -v npx &> /dev/null; then
    echo -e "${GREEN}✅ npx 可用${NC}"
    
    if npx vite --version &> /dev/null; then
        echo -e "${GREEN}✅ vite 可通过 npx 使用${NC}"
    else
        echo -e "${YELLOW}⚠️ vite 需要通过 npx 使用${NC}"
    fi
    
    if npx nodemon --version &> /dev/null; then
        echo -e "${GREEN}✅ nodemon 可通过 npx 使用${NC}"
    else
        echo -e "${YELLOW}⚠️ nodemon 需要通过 npx 使用${NC}"
    fi
else
    echo -e "${RED}❌ npx 不可用${NC}"
    exit 1
fi

# 启动数据库服务
echo -e "${YELLOW}🗄️ 启动数据库服务...${NC}"
docker-compose -f .devcontainer/docker-compose.yml up -d

sleep 5

# 检查服务状态
echo -e "${YELLOW}🔍 检查服务状态...${NC}"
docker-compose -f .devcontainer/docker-compose.yml ps

# 显示使用说明
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 修复完成！现在可以启动服务了${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}📋 启动命令:${NC}"
echo "1. 启动前端服务:"
echo "   npm run dev"
echo ""
echo "2. 在新终端中启动后端服务:"
echo "   cd backend"
echo "   npm run dev"
echo ""
echo -e "${YELLOW}🔧 如果还有问题，尝试直接使用 npx:${NC}"
echo "   npx vite --host 0.0.0.0"
echo "   npx nodemon backend/server-smart.js"
echo ""
echo -e "${YELLOW}🌐 访问地址:${NC}"
echo "- 前端: http://localhost:3000"
echo "- 后端: http://localhost:8080"
echo "- CouchDB: http://localhost:5984/_utils"