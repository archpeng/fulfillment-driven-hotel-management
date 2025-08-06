# 使用官方的 Node.js 开发容器镜像
FROM mcr.microsoft.com/devcontainers/typescript-node:1-20-bookworm

# 安装额外的开发工具
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    curl \
    jq \
    httpie \
    vim \
    nano \
    htop \
    net-tools \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 安装全局 npm 包
RUN npm install -g \
    @xstate/cli \
    typescript \
    vitest \
    @anthropic/claude-code \
    npm-check-updates \
    concurrently \
    nodemon \
    pm2

# 设置工作目录
WORKDIR /workspace

# 创建必要的目录
RUN mkdir -p /workspace/.vscode

# 复制项目文件
COPY package*.json ./

# 预安装依赖以加速启动
RUN npm install

# 设置环境变量
ENV NODE_ENV=development
ENV VITE_BACKEND_URL=http://localhost:8080
ENV COUCH_URL=http://admin:password@localhost:5984

# 暴露端口
EXPOSE 3000 3001 8080 5984 6379 5432

# 设置默认命令
CMD ["bash"]