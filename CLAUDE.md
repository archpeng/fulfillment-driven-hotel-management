# 履约驱动酒店管理系统 - 架构规范与开发指南

**系统定位**: 履约优先的酒店管理系统 - "我们不管理客房，我们管理客人"  
**架构模式**: 厚客户端模块化单体 + DDD领域驱动设计  
**核心理念**: 履约流程流畅执行 + 客户数据不断积累  
**技术特征**: 离线优先 + 状态机驱动 + 事件溯源

---

## 🎯 核心架构共识 (不可动摇)

### 1. 业务架构原则

#### 履约驱动核心理念
- **客人中心**: 一切围绕客人履约历程展开，不是房间管理而是客人管理
- **五阶段履约流程**: 认知→评估→预订→体验→反馈 (固定不变)
- **完整生命周期**: 从陌生人到忠实客户的完整转化历程
- **数据驱动决策**: 基于真实履约数据的智能分析和优化

#### 业务价值核心
- **履约质量评分**: 实时计算每个阶段的执行质量(0-100分)
- **客户生命周期价值(LTV)**: 自动计算和预测客户价值
- **忠诚度等级管理**: 基于5个维度的动态等级计算
- **个性化服务**: 基于履约历史的千人千面服务

### 2. 技术架构原则

#### 厚客户端架构 (Rich Client)
```
客户端 = 业务逻辑主体 + 本地数据库 + 实时计算
服务端 = 数据同步中枢 + 关键验证 + 备份存储
```

**客户端职责**:
- 🧠 **核心业务逻辑**: 所有DDD聚合根、值对象、领域服务
- 💾 **本地数据库**: RxDB作为主要读取模型，支持复杂查询
- ⚡ **实时响应**: <10ms的操作反馈，瞬时状态更新
- 🤖 **智能计算**: LTV计算、忠诚度评估、风险分析

**服务端职责**:
- 🔐 **关键验证**: 支付验证、身份认证、核心业务规则
- 🔄 **数据同步**: CouchDB双向同步、冲突解决
- 📊 **数据中枢**: 多设备数据一致性、备份恢复

#### DDD领域驱动设计
```
domain/
├── shared/           # 共享内核
│   ├── base/        # AggregateRoot基类
│   └── value-objects/ # FulfillmentStage, LoyaltyLevel
├── guests/          # 客人领域 (Bounded Context)
│   ├── aggregates/  # Guest聚合根
│   └── repositories/ # GuestRepository接口
└── fulfillment/     # 履约领域 (Bounded Context)
    ├── aggregates/  # FulfillmentJourney聚合根
    ├── value-objects/ # FulfillmentEvent值对象
    └── services/    # FulfillmentEventTracker服务
```

### 3. 数据架构标准

#### 核心聚合根设计 (不可修改)

##### Guest聚合根
```typescript
class Guest extends AggregateRoot<string> {
  // 履约历程状态
  private _fulfillmentHistory: {
    currentStage: FulfillmentStage;     // 当前履约阶段
    stageStartTime: Date;               // 阶段开始时间
    completedStages: StageProgress[];   // 已完成阶段
    journeyCount: number;               // 完整履约次数
  };
  
  // 商业价值指标
  private _businessMetrics: {
    lifetimeValue: number;              // 生命周期价值
    totalBookings: number;              // 总预订次数
    averageRating: number;              // 平均评分
    referralCount: number;              // 推荐人数
  };
  
  // 个性化标签
  private _tags: {
    loyaltyLevel: LoyaltyLevel;         // 忠诚度等级(铜银金白金)
    riskLevel: 'low' | 'medium' | 'high'; // 风险等级
    valueSegment: string;               // 价值分段
  };
}
```

##### FulfillmentJourney聚合根
```typescript
class FulfillmentJourney extends AggregateRoot<string> {
  private _currentStage: FulfillmentStage;    // 当前阶段
  private _overallScore: number;              // 整体评分(0-100)
  private _events: FulfillmentEvent[];        // 履约事件列表
  private _milestones: Milestone[];           // 里程碑记录
  private _isActive: boolean;                 // 是否活跃状态
}
```

#### 履约阶段值对象 (固定不变)
```typescript
class FulfillmentStage {
  public static readonly AWARENESS = new FulfillmentStage('awareness', '认知阶段', 0);
  public static readonly EVALUATION = new FulfillmentStage('evaluation', '评估阶段', 1);
  public static readonly BOOKING = new FulfillmentStage('booking', '预订阶段', 2);
  public static readonly EXPERIENCING = new FulfillmentStage('experiencing', '体验阶段', 3);
  public static readonly FEEDBACK = new FulfillmentStage('feedback', '反馈阶段', 4);
}
```

### 4. 状态机架构标准

#### XState履约状态机 (核心逻辑)
```
awareness → evaluation → booking → confirmed → experiencing → completed → reviewed
     ↓           ↓          ↓          ↓            ↓           ↓
   lost        lost      expired    noShow       问题处理     复购循环
```

**状态机特征**:
- 🔄 **并行状态**: 体验阶段支持服务监控和满意度跟踪并行
- ⏰ **超时机制**: 各阶段自动超时检测和处理
- 🚨 **异常处理**: 完整的异常状态和恢复机制
- 📊 **质量评分**: 实时的履约质量评分更新

### 5. 事件驱动架构

#### 履约事件系统 (30+事件类型)
```typescript
// 认知阶段: PAGE_VIEW, AD_CLICK, SEARCH_QUERY, SOCIAL_SHARE
// 评估阶段: DETAILS_VIEW, INQUIRY_SUBMIT, LIVE_CHAT, PHONE_CALL  
// 预订阶段: BOOKING_START, PAYMENT_SUCCESS, BOOKING_CONFIRMED
// 体验阶段: CHECK_IN, SERVICE_REQUEST, COMPLAINT, CHECK_OUT
// 反馈阶段: REVIEW_SUBMIT, REFERRAL, REPEAT_BOOKING
```

**事件特征**:
- 📈 **影响评分**: 每个事件有-100到+100的影响分
- 🔍 **模式分析**: 自动识别客人行为模式和异常
- 📊 **实时监控**: 事件队列异步处理，支持实时分析

---

## 🛠️ 技术栈标准 (严格遵循)

### 客户端技术栈
```typescript
// 核心框架
- TypeScript 5.x (strict模式，100%类型覆盖)
- React/Vue (现代化UI框架)
- XState 5.x (状态机管理)
- RxDB 16.x (离线优先数据库)

// 构建和工具
- Vite 5.x (构建工具)
- Vitest (测试框架)
- ESLint + Prettier (代码质量)

// 业务特定
- @xstate/test (状态机测试)
- IndexedDB/Dexie (底层存储)
```

### 服务端技术栈
```typescript
// API服务
- Node.js + TypeScript
- Express/Fastify (API框架)
- JWT认证 + 权限控制

// 数据存储
- CouchDB (主数据同步)
- Redis (状态缓存)
- PostgreSQL (事务数据，备选)

// 运维部署
- Docker + Docker Compose
- 环境配置标准化
```

### 数据库设计标准
```typescript
// RxDB索引策略 (性能保证)
indexes: [
  'personalInfo.phone',                    // 按电话查找
  'fulfillmentHistory.currentStage',       // 按阶段筛选
  'tags.loyaltyLevel',                     // 按忠诚度筛选
  'businessMetrics.lifetimeValue',         // 按价值排序
  ['fulfillmentHistory.currentStage', 'updatedAt'], // 复合索引
  ['tags.loyaltyLevel', 'businessMetrics.lifetimeValue']
]
```

---

## 📋 开发规范 (强制遵循)

### 1. 代码质量标准
```typescript
// TypeScript配置 (tsconfig.json)
{
  "compilerOptions": {
    "strict": true,                    // 严格模式必需
    "noImplicitAny": true,            // 禁止隐式any
    "exactOptionalPropertyTypes": true // 精确可选属性
  }
}

// 测试覆盖率要求
{
  "coverage": {
    "statements": 90,                  // 语句覆盖率≥90%
    "branches": 85,                    // 分支覆盖率≥85%
    "functions": 95,                   // 函数覆盖率≥95%
  }
}
```

### 2. DDD实现规范
```typescript
// 聚合根必须继承基类
class Guest extends AggregateRoot<string> {
  // 业务逻辑方法
  public advanceToStage(stage: FulfillmentStage): void {
    // 业务规则验证
    if (!this._fulfillmentHistory.currentStage.canTransitionTo(stage)) {
      throw new Error("Invalid stage transition");
    }
    
    // 状态更新
    this._fulfillmentHistory.currentStage = stage;
    
    // 领域事件发布
    this.addDomainEvent(new GuestStageAdvancedEvent(this._id, stage));
    
    // 版本递增
    this.incrementVersion();
  }
}
```

### 3. 状态机集成规范
```typescript
// 状态机服务必须统一管理
const fulfillmentService = new FulfillmentXStateService();

// 事件发送标准格式
fulfillmentService.sendEventToJourney(journeyId, {
  type: 'MAKE_BOOKING',
  data: { roomType: 'deluxe', amount: 500 }
});

// 状态持久化集成
actor.subscribe({
  next: (snapshot) => {
    // 自动持久化到聚合根
    journey.updateFromSnapshot(snapshot);
    repository.save(journey);
  }
});
```

### 4. 性能要求标准
```typescript
// 响应时间要求
const PERFORMANCE_REQUIREMENTS = {
  localQuery: 10,      // 本地查询<10ms
  stateTransition: 50, // 状态转换<50ms
  eventProcessing: 100 // 事件处理<100ms
};

// 数据量处理标准
const SCALABILITY_REQUIREMENTS = {
  batchSize: 1000,         // 批量操作≥1000条/秒
  memoryUsage: 20,         // 内存使用<20MB/1000条记录
  indexPerformance: 100    // 索引查询<100ms
};
```

---

## 🚀 开发环境标准

### Docker开发环境 (强制使用)
```yaml
# docker-compose.dev.yml (标准配置)
version: '3.8'
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"    # 主应用端口(固定)
      - "3001:3001"    # HMR WebSocket端口
    volumes:
      - .:/app
      - node_modules:/app/node_modules
    environment:
      - NODE_ENV=development
```

### Claude Code集成标准
```bash
# 必需的全局工具
npm install -g @anthropic/claude-code

# 标准开发命令模板
claude "基于履约驱动架构，实现[具体功能]，需要：
1. 遵循DDD聚合根设计
2. 集成XState状态机
3. 完整的事件记录
4. TypeScript严格类型
5. 90%测试覆盖率"
```

### 项目结构标准 (固定不变)
```
saas-project/
├── src/
│   ├── domain/                    # DDD领域层
│   │   ├── shared/base/          # 聚合根基类
│   │   ├── guests/aggregates/    # Guest聚合根
│   │   └── fulfillment/aggregates/ # FulfillmentJourney聚合根
│   ├── xstate/                   # 状态机层
│   │   ├── fulfillmentMachine.ts # 履约状态机
│   │   └── FulfillmentXStateService.ts # 状态机服务
│   ├── database/                 # 数据访问层
│   │   ├── schemas/             # RxDB Schema定义
│   │   └── repositories/        # 仓库实现
│   ├── components/              # UI组件层
│   └── utils/                   # 工具函数
├── tests/                       # 测试套件
│   ├── unit/                   # 单元测试
│   ├── integration/            # 集成测试
│   └── performance/            # 性能测试
└── construction/               # 架构文档
```

---

## 📊 质量保证标准

### 测试策略 (强制执行)
```typescript
// 1. 聚合根单元测试
describe('Guest Aggregate', () => {
  it('should advance fulfillment stage correctly', () => {
    const guest = new Guest(id, personalInfo);
    guest.advanceToStage(FulfillmentStage.EVALUATION);
    expect(guest.currentStage).toBe(FulfillmentStage.EVALUATION);
  });
});

// 2. 状态机路径测试
import { createTestMachine } from '@xstate/test';
const testPlans = fulfillmentMachine.getShortestPathPlans();
testPlans.forEach(plan => {
  describe(plan.description, () => {
    plan.paths.forEach(path => {
      it(path.description, async () => {
        await path.test({ /* 测试上下文 */ });
      });
    });
  });
});

// 3. 性能基准测试
describe('Performance Benchmarks', () => {
  it('should handle 1000 guests query in <100ms', async () => {
    const startTime = performance.now();
    await guestRepository.findWithPagination({ limit: 1000 });
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(100);
  });
});
```

### 代码审查清单
- ✅ 遵循DDD聚合边界
- ✅ 状态机集成正确
- ✅ 事件发布完整
- ✅ 类型安全100%
- ✅ 测试覆盖率达标
- ✅ 性能要求满足
- ✅ 业务规则封装

---

## 🎯 关键成功指标 (KSI)

### 业务指标
- **履约转化率**: 认知→预订 > 25%, 预订→入住 > 95%
- **客户满意度**: NPS > 70, 平均评分 > 4.2
- **复购率**: > 40%, 推荐率 > 30%
- **LTV增长**: 较传统模式提升 > 30%

### 技术指标  
- **响应性能**: 本地查询 < 10ms, 状态转换 < 50ms
- **系统可用性**: > 99.5%, 离线可用性 100%
- **数据一致性**: 多设备同步准确率 > 99.9%
- **代码质量**: 测试覆盖率 > 90%, 类型覆盖率 100%

---

## 💡 核心设计决策记录 (ADR)

### ADR-001: 履约驱动架构
**决策**: 采用以客人履约历程为核心的架构设计  
**理由**: 更符合酒店业务本质，便于数据分析和客户管理  
**影响**: 所有功能围绕履约流程展开，数据模型以客人为中心

### ADR-002: 厚客户端架构
**决策**: 业务逻辑主要在客户端，服务端专注同步和验证  
**理由**: 履约流程需要实时响应，离线场景必须支持  
**影响**: 复杂的本地计算能力，简化的服务端架构

### ADR-003: XState状态机
**决策**: 使用XState管理履约状态流转  
**理由**: 履约流程复杂，需要可视化和严格的状态管理  
**影响**: 学习成本增加，但状态管理更可靠和可维护

### ADR-004: RxDB离线存储
**决策**: 使用RxDB作为客户端主数据库  
**理由**: 离线优先，双向同步，支持复杂查询  
**影响**: 数据模型扁平化，索引策略复杂化

---

## 🎉 开发指导原则

### 永远记住的核心理念
1. **"我们不管理客房，我们管理客人"** - 一切以客人履约为中心
2. **客户端为王** - 业务逻辑优先在客户端实现
3. **实时响应** - 用户操作必须瞬时反馈，绝不等待网络
4. **数据驱动** - 每个决策都基于真实的履约数据
5. **质量内建** - 90%测试覆盖率不是目标而是底线

### Claude Code协作方式
```bash
# 标准提示词格式
claude "基于我们的履约驱动架构和DDD设计原则，实现[具体需求]：

【必须遵循】
- 五阶段履约流程逻辑
- Guest/FulfillmentJourney聚合根设计
- XState状态机集成
- TypeScript严格模式
- 90%测试覆盖率

【具体要求】
[详细的功能描述和约束条件]"
```

---

**🚨 重要提醒**: 本文档中的所有架构设计、技术选型、数据模型都是经过深度思考和验证的核心共识，在未来开发中必须严格遵循，不得随意修改。任何重大变更都需要充分论证和团队共识。**

💪 **让我们坚持履约驱动的理念，打造真正以客人为中心的酒店管理系统！**