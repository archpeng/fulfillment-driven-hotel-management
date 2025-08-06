# GitHub Codespaces 快速开始指南 🚀

## 🏨 履约驱动酒店管理系统 - 云端开发环境

### 一键启动开发环境

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/archpeng/fulfillment-driven-hotel-management)

## 🎯 什么是 GitHub Codespaces？

GitHub Codespaces 是一个完整的云端开发环境，让您可以：
- 🌐 在浏览器中直接编码，无需本地配置
- 🚀 几秒钟内启动完整的开发环境
- 💻 获得与本地开发相同的体验
- 🔄 自动同步您的代码更改

## 📋 快速开始步骤

### 1. 创建您的 Codespace

1. 在仓库主页，点击绿色的 **"Code"** 按钮
2. 选择 **"Codespaces"** 标签
3. 点击 **"Create codespace on main"**

### 2. 等待环境初始化（约2-3分钟）

Codespace 会自动为您：
- ✅ 安装 Node.js 20 和所有开发工具
- ✅ 配置 TypeScript、XState、Vitest 等
- ✅ 启动 CouchDB 和 Redis 数据库
- ✅ 安装所有项目依赖
- ✅ 配置 VS Code 扩展和设置

### 3. 启动应用

环境准备就绪后，在终端中运行：

```bash
# 启动前端开发服务器
npm run dev

# 在新终端中启动后端 (Ctrl+Shift+` 打开新终端)
cd backend
npm run dev
```

### 4. 访问您的应用

- 🌐 **前端应用**: 点击弹出的端口 3000 通知，或在 "Ports" 面板中找到它
- 🔧 **后端 API**: 端口 8080
- 🗄️ **CouchDB 管理界面**: 端口 5984 (_utils路径)
  - 用户名: `admin`
  - 密码: `password`

## 🛠️ 预配置的开发环境

### 已安装的工具

- **Node.js 20**: 最新 LTS 版本
- **TypeScript 5.x**: 全局可用
- **XState CLI**: 状态机可视化
- **Vitest**: 测试框架
- **Docker**: 容器管理
- **GitHub CLI**: GitHub 集成

### VS Code 扩展

自动安装的扩展包括：
- 🔍 ESLint & Prettier
- 📘 TypeScript 增强支持
- 🎨 Tailwind CSS IntelliSense
- 🤖 GitHub Copilot
- 🧪 Vitest 测试资源管理器
- 📊 XState 可视化工具

## 💡 常用操作

### 运行测试

```bash
# 运行所有测试
npm test

# 带覆盖率报告
npm run test:coverage

# 测试 UI 界面
npm run test:ui
```

### 状态机可视化

```bash
# 可视化 XState 状态机
npm run xstate:visualize
```

### 性能监控

1. 打开应用后，滚动到 "系统性能监控" 部分
2. 点击 "运行性能测试" 进行基准测试
3. 查看实时性能指标和健康状态

### 离线模式测试

```bash
# 运行完整的离线模式测试套件
# 在应用中点击 "测试离线模式" 按钮
```

## 🔧 故障排除

### 端口无法访问？

1. 检查 VS Code 的 "Ports" 面板
2. 确保端口状态为 "Forwarded"
3. 如果是 Private，点击改为 Public

### 数据库连接失败？

运行以下命令重启服务：

```bash
# 查看容器状态
docker ps

# 重启所有服务
docker-compose -f .devcontainer/docker-compose.yml restart
```

### 依赖安装问题？

```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
```

## 🌟 高级技巧

### 1. 使用更高配置

创建 Codespace 时可以选择：
- 4 核 CPU / 8GB RAM（推荐）
- 8 核 CPU / 16GB RAM（性能最佳）

### 2. 预构建加速

我们已配置自动预构建，每次推送到 main 分支都会更新预构建镜像，大幅减少启动时间。

### 3. 个性化设置

您的 VS Code 设置会自动同步，包括：
- 主题和颜色
- 键盘快捷键
- 扩展配置

### 4. 协作开发

- 可以通过 Live Share 邀请他人协作
- 支持端口共享，方便演示

## 📊 资源使用

- **免费用户**: 每月 60 小时免费使用
- **Pro 用户**: 每月 180 小时免费使用
- **自动停止**: 30 分钟不活动后自动停止（可配置）
- **数据持久化**: 停止后数据保留 30 天

## 🔗 相关资源

- [履约驱动架构文档](./CLAUDE.md)
- [项目 README](./README.md)
- [API 文档](./docs/api.md)
- [GitHub Codespaces 文档](https://docs.github.com/codespaces)

---

💬 **需要帮助？** 在 [Issues](https://github.com/archpeng/fulfillment-driven-hotel-management/issues) 中提问，或查看 [Discussions](https://github.com/archpeng/fulfillment-driven-hotel-management/discussions) 获取社区支持。

🎉 **Happy Coding in the Cloud!**