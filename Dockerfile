# 履约驱动酒店管理系统 - 后端Dockerfile (根目录版本)
FROM node:18-alpine

# 安装 curl 用于健康检查
RUN apk add --no-cache curl

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY backend/package*.json ./

# 安装依赖
RUN npm install --omit=dev

# 复制源代码
COPY backend/ .

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 启动服务 (使用带同步功能的版本)
CMD ["node", "server-with-sync.js"]