# 🏨 履约驱动酒店管理系统

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![XState](https://img.shields.io/badge/XState-5.x-orange.svg)](https://xstate.js.org/)
[![RxDB](https://img.shields.io/badge/RxDB-16.x-green.svg)](https://rxdb.info/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**"我们不管理客房，我们管理客人"** - 基于履约驱动理念的现代化酒店管理系统

## 🎯 项目特色

### 🌟 核心理念
- **履约驱动**: 以客人履约历程为核心的业务架构
- **厚客户端**: 业务逻辑在客户端，实现<10ms瞬时响应
- **离线优先**: 完全离线可用，网络中断不影响业务
- **状态机驱动**: XState管理复杂的履约状态流转
- **事件溯源**: 完整记录客人履约过程中的所有事件

### 🏗️ 架构特征
- **DDD领域驱动**: Guest和FulfillmentJourney聚合根设计
- **模块化单体**: 清晰的领域边界，统一的部署单元
- **TypeScript严格模式**: 100%类型安全，编译时错误检测
- **测试驱动开发**: 90%+测试覆盖率，完整的质量保障

## 🚀 五阶段履约流程

```
认知阶段 → 评估阶段 → 预订阶段 → 体验阶段 → 反馈阶段
   ↓         ↓         ↓         ↓         ↓
陌生人    潜在客户   确定客户   体验客户   忠实客户
```

### 📊 核心功能
- **🧠 智能客人管理**: 基于履约历程的完整客人档案
- **📈 实时履约分析**: 转化率、满意度、LTV实时监控
- **🎯 个性化服务**: 基于历史行为的千人千面服务
- **🚨 异常检测**: 自动识别履约过程中的风险和机会
- **💎 忠诚度管理**: 四级忠诚度体系和动态权益管理

## 🛠️ 技术栈

### 客户端 (Rich Client)
```typescript
- TypeScript 5.x      // 严格类型安全
- XState 5.x          // 状态机管理
- RxDB 16.x           // 离线优先数据库
- Vite 5.x            // 现代构建工具
- Vitest              // 单元测试框架
```

### 服务端 (Thin Server)
```typescript
- Node.js + TypeScript  // API服务
- CouchDB              // 数据同步中枢
- Redis                // 状态缓存
- Docker               // 容器化部署
```

### 开发工具
```typescript
- Claude Code          // AI辅助开发
- ESLint + Prettier    // 代码质量
- @xstate/test        // 状态机测试
- Docker Compose       // 开发环境
```

## 📁 项目结构

```
src/
├── domain/                    # DDD领域层
│   ├── shared/base/          # 聚合根基类
│   ├── guests/aggregates/    # Guest聚合根
│   └── fulfillment/aggregates/ # FulfillmentJourney聚合根
├── xstate/                   # 状态机层
├── database/                 # 数据访问层
│   ├── schemas/             # RxDB Schema
│   └── repositories/        # 仓库实现
├── components/              # UI组件层
└── utils/                   # 工具函数

construction/                # 架构文档
├── flows.md                # 履约流程详解
├── data.md                 # 数据结构说明
├── ARCHITECTURE_PATTERN.md # 架构模式文档
└── fulfillment-development-roadmap.md # 开发路线图
```

## 🚀 快速开始

### 前置要求
- Node.js >= 18.0.0
- Docker Desktop
- Claude Code CLI (可选)

### 1. 克隆项目
```bash
git clone https://github.com/your-username/fulfillment-driven-hotel-management.git
cd fulfillment-driven-hotel-management
```

### 2. 环境配置
```bash
# 复制环境配置
cp .env.example .env

# 安装依赖
npm install
```

### 3. Docker开发环境
```bash
# 启动完整开发环境
npm run docker:up

# 查看服务状态
docker ps

# 进入开发容器
npm run docker:shell
```

### 4. 本地开发
```bash
# 启动开发服务器
npm run dev

# 访问应用: http://localhost:3000
# HMR端口: http://localhost:3001
```

## 🧪 测试

### 运行测试套件
```bash
# 单元测试
npm run test

# 测试覆盖率报告
npm run test:coverage

# 交互式测试UI
npm run test:ui

# 类型检查
npm run typecheck

# 代码检查
npm run lint
```

### 测试策略
- **单元测试**: 聚合根业务逻辑测试
- **状态机测试**: XState路径覆盖测试
- **集成测试**: 仓库和数据库集成测试
- **性能测试**: 响应时间和吞吐量基准测试

## 🤖 Claude Code集成

### 基础使用
```bash
# 在容器内使用Claude
npm run docker:shell
claude "基于履约驱动架构实现客人签到功能"
```

### 标准协作模式
```bash
claude "基于我们的履约驱动架构和DDD设计原则，实现[具体需求]：

【必须遵循】
- 五阶段履约流程逻辑
- Guest/FulfillmentJourney聚合根设计
- XState状态机集成
- TypeScript严格模式
- 90%测试覆盖率

【具体要求】
[详细功能描述]"
```

## 📊 性能指标

### 响应性能
- 本地查询: < 10ms
- 状态转换: < 50ms
- 事件处理: < 100ms
- 批量操作: > 1000条/秒

### 质量指标
- 测试覆盖率: > 90%
- 类型覆盖率: 100%
- 代码质量: A级
- 系统可用性: > 99.5%

## 🎯 关键业务指标

### 履约转化率
- 认知→预订: > 25%
- 预订→入住: > 95%
- 入住→复购: > 40%

### 客户价值
- NPS评分: > 70
- 平均评分: > 4.2/5
- LTV增长: > 30%

## 🤝 贡献指南

### 开发流程
1. Fork项目到个人账户
2. 创建功能分支: `git checkout -b feature/amazing-feature`
3. 提交变更: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 创建Pull Request

### 代码规范
- 遵循DDD聚合边界设计
- 使用XState管理状态流转
- 保持90%+测试覆盖率
- 通过ESLint和TypeScript检查
- 遵循履约驱动的业务理念

### Commit规范
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试相关
chore: 构建过程或辅助工具的变动
```

## 📚 文档

- [架构规范](./CLAUDE.md) - 核心架构共识和开发指南
- [履约流程](./construction/flows.md) - 五阶段履约流程详解
- [数据结构](./construction/data.md) - DDD数据模型说明
- [开发路线图](./construction/fulfillment-development-roadmap.md) - 12周开发计划
- [故障排查](./construction/troubleshooting-guide.md) - 常见问题解决

## 🏆 里程碑

### v1.1.0 - 履约核心引擎 ✅
- [x] Guest和FulfillmentJourney聚合根
- [x] XState履约状态机
- [x] 履约事件追踪系统
- [x] RxDB离线存储优化
- [x] 完整的DDD架构实现

### v1.2.0 - 客人管理中心 🚧
- [ ] 全面客人档案系统
- [ ] 履约历程可视化看板
- [ ] 客人价值分析引擎
- [ ] 智能客人洞察

### v1.3.0 - 预订履约优化 📋
- [ ] 智能预订推荐
- [ ] 风险评估引擎
- [ ] 个性化体验管理
- [ ] 实时质量监控

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证 - 查看 LICENSE 文件了解详情。

## 🌟 支持项目

如果这个项目对您有帮助，请考虑：

- ⭐ 给项目点个星
- 🐛 报告bug或提出建议
- 🤝 贡献代码或文档
- 📢 分享给更多人

## 📞 联系方式

- 项目主页: [GitHub Repository](https://github.com/your-username/fulfillment-driven-hotel-management)
- 问题反馈: [GitHub Issues](https://github.com/your-username/fulfillment-driven-hotel-management/issues)
- 讨论交流: [GitHub Discussions](https://github.com/your-username/fulfillment-driven-hotel-management/discussions)

---

**💪 让我们一起打造真正以客人为中心的酒店管理系统！**

> "履约驱动不仅是一种架构模式，更是一种以客人价值为核心的商业思维"