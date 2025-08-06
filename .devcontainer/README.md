# GitHub Codespaces 配置说明

## 🚀 快速开始

### 1. 创建 Codespace

在 GitHub 仓库页面，点击 "Code" 按钮，然后选择 "Codespaces" 标签页，点击 "Create codespace on main"。

### 2. 等待环境初始化

Codespace 会自动：
- 安装所有必需的开发工具
- 配置 VS Code 扩展
- 安装项目依赖
- 启动数据库服务（CouchDB、Redis）

### 3. 启动开发服务器

在终端中运行：

```bash
# 启动前端开发服务器
npm run dev

# 在新终端中启动后端服务器
cd backend
npm run dev
```

### 4. 访问应用

- **前端应用**: 点击端口 3000 的链接（会自动转发）
- **CouchDB 管理界面**: 端口 5984 (用户名: admin, 密码: password)
- **后端 API**: 端口 8080

## 🛠️ 开发环境功能

### 预装工具

- **Node.js 20.x**: 最新的 LTS 版本
- **TypeScript**: 全局安装，支持类型检查
- **XState CLI**: 状态机可视化工具
- **Vitest**: 测试框架
- **Docker**: 容器管理
- **GitHub CLI**: GitHub 操作

### VS Code 扩展

- ESLint: 代码质量检查
- Prettier: 代码格式化
- TypeScript 增强支持
- XState 可视化
- GitHub Copilot
- Docker 支持
- Vitest 测试资源管理器

### 环境变量

已预配置的环境变量：
- `NODE_ENV=development`
- `VITE_BACKEND_URL=http://localhost:8080`
- `COUCH_URL=http://admin:password@localhost:5984`

## 📝 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
npm run build           # 构建生产版本
npm run preview         # 预览生产构建

# 测试
npm test                # 运行测试
npm run test:coverage   # 运行测试并生成覆盖率报告
npm run test:ui         # 启动 Vitest UI

# 代码质量
npm run lint            # 运行 ESLint
npm run typecheck       # 运行 TypeScript 类型检查

# 数据库操作
npm run db:init         # 初始化数据库
npm run db:seed         # 填充演示数据

# XState 可视化
npm run xstate:visualize # 可视化状态机
```

## 🔧 故障排除

### 端口被占用

如果遇到端口冲突，可以在 VS Code 的 "Ports" 面板中管理端口转发。

### 数据库连接失败

1. 检查 Docker 容器是否正在运行：
   ```bash
   docker ps
   ```

2. 重启数据库服务：
   ```bash
   docker-compose -f .devcontainer/docker-compose.yml restart
   ```

### 依赖安装失败

清理并重新安装：
```bash
rm -rf node_modules package-lock.json
npm install
```

## 🎯 性能优化建议

1. **使用 4 核 CPU 配置**: 在创建 Codespace 时选择更高配置
2. **启用缓存**: 项目已配置缓存优化
3. **使用轻量级编辑器主题**: 减少 UI 渲染开销

## 📚 相关文档

- [履约驱动架构文档](../CLAUDE.md)
- [系统设计文档](../README.md)
- [API 文档](../docs/api.md)

---

💡 **提示**: Codespace 会在不活动 30 分钟后自动停止。您的所有更改都会保存，下次启动时会恢复到相同状态。