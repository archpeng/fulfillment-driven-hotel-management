# 🤝 贡献指南

欢迎为履约驱动酒店管理系统贡献代码！本指南将帮助您了解如何参与项目开发。

## 🎯 项目理念

在开始贡献之前，请务必理解我们的核心理念：

> **"我们不管理客房，我们管理客人"**

这意味着所有功能开发都应该：
- 以客人履约历程为中心
- 遵循五阶段履约流程
- 注重客人价值的积累和分析
- 保证履约过程的顺畅执行

## 📋 准备工作

### 环境要求
- Node.js ≥ 18.0.0
- Docker Desktop
- Git
- Claude Code CLI (推荐)

### 获取代码
```bash
# Fork项目到你的GitHub账户，然后克隆
git clone https://github.com/YOUR_USERNAME/fulfillment-driven-hotel-management.git
cd fulfillment-driven-hotel-management

# 添加上游远程仓库
git remote add upstream https://github.com/original-owner/fulfillment-driven-hotel-management.git
```

### 安装依赖
```bash
# 安装项目依赖
npm install

# 启动Docker开发环境
npm run docker:up

# 验证环境
npm run test
npm run lint
npm run typecheck
```

## 🛠️ 开发流程

### 1. 选择或创建Issue

在开始开发之前，请：
- 查看现有的 [Issues](https://github.com/original-owner/fulfillment-driven-hotel-management/issues)
- 选择一个未被分配的Issue，或创建新的Issue描述你想要实现的功能
- 在Issue中表达你的实现意图，等待维护者确认

### 2. 创建功能分支

```bash
# 确保main分支是最新的
git checkout main
git pull upstream main

# 创建功能分支，使用有意义的命名
git checkout -b feature/guest-preference-analysis
# 或者
git checkout -b fix/fulfillment-stage-transition-bug
```

### 3. 开发实现

#### 严格遵循架构规范
请确保你的实现符合 [CLAUDE.md](./CLAUDE.md) 中定义的所有架构要求：

- **DDD聚合根设计**: 所有业务逻辑必须封装在聚合根中
- **XState状态机集成**: 状态变更必须通过状态机管理
- **事件驱动**: 重要的状态变更必须发布领域事件
- **TypeScript严格模式**: 禁止使用any类型，保证100%类型安全
- **性能要求**: 本地查询<10ms，状态转换<50ms

#### 推荐的开发方式
使用Claude Code进行AI辅助开发：

```bash
# 进入Docker开发容器
npm run docker:shell

# 使用标准提示词格式
claude "基于我们的履约驱动架构和DDD设计原则，实现[你的功能描述]：

【必须遵循】
- 五阶段履约流程逻辑
- Guest/FulfillmentJourney聚合根设计
- XState状态机集成
- TypeScript严格模式
- 90%测试覆盖率

【具体要求】
[详细描述你要实现的功能和约束条件]"
```

### 4. 编写测试

所有新功能都必须包含完整的测试：

```bash
# 单元测试 - 聚合根业务逻辑
# 文件位置: tests/unit/domain/[domain]/[AggregateRoot].test.ts

# 状态机测试 - XState状态转换
# 文件位置: tests/unit/xstate/[stateMachine].test.ts

# 集成测试 - 仓库和数据库
# 文件位置: tests/integration/database/[Repository].test.ts

# 性能测试 - 关键路径性能
# 文件位置: tests/performance/[feature].benchmarks.test.ts
```

#### 测试要求
- **覆盖率**: 新代码必须达到≥90%测试覆盖率
- **性能测试**: 关键功能必须包含性能基准测试
- **边界情况**: 必须测试异常情况和边界条件
- **状态机测试**: 使用`@xstate/test`测试所有状态路径

### 5. 本地验证

提交前务必进行完整验证：

```bash
# 运行所有测试
npm run test:coverage

# 类型检查
npm run typecheck

# 代码质量检查
npm run lint

# 构建验证
npm run build

# 在Docker环境中测试
npm run docker:shell
# 在容器内运行测试和验证
```

期望的验证结果：
```bash
✅ 测试覆盖率 ≥ 90%
✅ TypeScript检查通过
✅ ESLint检查通过
✅ 构建成功
✅ 性能基准测试通过
```

### 6. 提交变更

#### Commit消息规范
使用 [约定式提交](https://www.conventionalcommits.org/zh-hans/v1.0.0/) 格式：

```bash
# 功能实现
git commit -m "feat: 实现客人偏好分析引擎

✨ 新功能:
- 基于履约历史的偏好学习算法
- 千人千面的个性化推荐
- 偏好权重动态调整机制

🧪 测试:
- 新增23个单元测试用例
- 覆盖率提升至94%
- 性能测试显示<5ms响应时间

📚 影响:
- 增强Guest聚合根偏好管理能力
- 集成XState偏好学习状态机
- 扩展FulfillmentEvent偏好事件类型"

# Bug修复
git commit -m "fix: 修复履约阶段转换验证逻辑

🐛 问题:
- 某些无效阶段转换未被正确拒绝
- 导致数据不一致和状态机错误

🔧 修复:
- 强化FulfillmentStage.canTransitionTo()验证
- 添加状态转换前置条件检查
- 改进错误消息的可读性

✅ 验证:
- 所有现有测试继续通过
- 新增边界条件测试用例
- 手动测试确认修复有效"
```

#### 提交最佳实践
- 每个提交只关注一个逻辑变更
- 提交消息清晰描述变更内容和原因
- 包含足够的上下文信息
- 遵循项目的提交消息模板

### 7. 推送和创建PR

```bash
# 推送功能分支
git push origin feature/guest-preference-analysis

# 在GitHub上创建Pull Request
```

#### PR要求
- 使用项目提供的 [PR模板](.github/pull_request_template.md)
- 详细描述功能实现和测试情况
- 确保所有CI检查通过
- 添加相关的截图或演示（如适用）
- 关联相关的Issue

## 📝 代码规范

### TypeScript规范
```typescript
// ✅ 良好的类型定义
interface GuestPreferences {
  roomType: RoomType;
  bedType: BedType;
  smokingPreference: 'smoking' | 'non-smoking';
  floorPreference?: 'low' | 'medium' | 'high';
}

// ✅ 严格的函数签名
public updatePreferences(preferences: Partial<GuestPreferences>): void {
  this.validatePreferences(preferences);
  this._preferences = { ...this._preferences, ...preferences };
  this.incrementVersion();
}

// ❌ 避免使用any
function processData(data: any): any { // 不推荐
  return data.someProperty;
}
```

### DDD实现规范
```typescript
// ✅ 正确的聚合根实现
export class Guest extends AggregateRoot<string> {
  private _personalInfo: PersonalInfo;
  private _fulfillmentHistory: FulfillmentHistory;
  
  public advanceToStage(stage: FulfillmentStage): void {
    // 1. 验证业务规则
    if (!this._fulfillmentHistory.currentStage.canTransitionTo(stage)) {
      throw new Error('Invalid stage transition');
    }
    
    // 2. 执行状态更新
    const previousStage = this._fulfillmentHistory.currentStage;
    this._fulfillmentHistory.currentStage = stage;
    
    // 3. 发布领域事件
    this.addDomainEvent(new StageAdvancedEvent(
      this._id, 
      previousStage, 
      stage
    ));
    
    // 4. 递增版本
    this.incrementVersion();
  }
}
```

### 状态机集成规范
```typescript
// ✅ 正确的状态机服务实现
export class FulfillmentXStateService {
  async sendEventToJourney(
    journeyId: string, 
    event: FulfillmentEvent
  ): Promise<void> {
    // 1. 获取当前状态
    const journey = await this.repository.findById(journeyId);
    if (!journey) throw new Error('Journey not found');
    
    // 2. 发送状态机事件
    const actor = this.getActor(journeyId);
    actor.send(event);
    
    // 3. 持久化状态变更
    const snapshot = actor.getSnapshot();
    journey.updateFromSnapshot(snapshot);
    await this.repository.save(journey);
    
    // 4. 处理副作用
    await this.processSideEffects(event, snapshot);
  }
}
```

### 测试编写规范
```typescript
// ✅ 完整的测试用例
describe('Guest履约阶段管理', () => {
  let guest: Guest;
  
  beforeEach(() => {
    guest = new Guest('guest-123', mockPersonalInfo);
  });
  
  it('应该能够推进到下一个履约阶段', () => {
    // Arrange
    expect(guest.currentStage).toBe(FulfillmentStage.AWARENESS.value);
    
    // Act
    guest.advanceToStage(FulfillmentStage.EVALUATION);
    
    // Assert
    expect(guest.currentStage).toBe(FulfillmentStage.EVALUATION.value);
    expect(guest.version).toBe(2);
    
    const events = guest.getUncommittedEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('StageAdvancedEvent');
  });
  
  it('应该在无效阶段转换时抛出错误', () => {
    expect(() => {
      guest.advanceToStage(FulfillmentStage.FEEDBACK);
    }).toThrow('Invalid stage transition');
  });
});
```

## 🔍 代码审查流程

### 审查标准
所有PR都将从以下维度进行审查：

1. **架构一致性**: 是否遵循履约驱动架构原则
2. **DDD实现**: 聚合根、值对象、领域服务的正确使用
3. **状态机集成**: XState的正确集成和使用
4. **类型安全**: TypeScript严格模式的遵循
5. **测试质量**: 测试覆盖率和测试有效性
6. **性能影响**: 是否满足性能要求
7. **文档更新**: 相关文档是否同步更新

### 审查流程
1. **自动检查**: CI流水线自动进行代码质量检查
2. **人工审查**: 维护者进行功能和架构审查
3. **讨论**: 在PR中进行技术讨论和改进建议
4. **修订**: 根据反馈修改代码
5. **批准**: 获得至少1个维护者的批准
6. **合并**: 维护者合并PR到main分支

## 🚀 发布流程

### 版本发布
项目遵循 [语义版本控制](https://semver.org/)：
- `MAJOR`: 重大架构变更或破坏性更新
- `MINOR`: 新功能添加，向后兼容
- `PATCH`: Bug修复，性能优化

### 发布周期
- **每周发布**: 小的功能改进和bug修复
- **每月发布**: 重要功能版本
- **季度发布**: 重大架构升级

## 🏆 贡献者认可

### 贡献类型
我们欢迎各种形式的贡献：
- 🔧 **代码贡献**: 新功能、bug修复、性能优化
- 📚 **文档改进**: README、CLAUDE.md、API文档
- 🧪 **测试增强**: 测试用例、测试工具、质量保障
- 🎨 **UI/UX改进**: 界面设计、用户体验优化
- 🛠️ **工具开发**: 开发工具、CI/CD改进
- 💡 **想法建议**: 功能建议、架构改进想法

### 认可方式
- 在CHANGELOG.md中列出贡献者
- GitHub Contributors页面显示
- 项目README中的贡献者展示
- 重大贡献者的特别感谢

## 📞 获取帮助

### 沟通渠道
- **GitHub Issues**: 功能建议、bug报告
- **GitHub Discussions**: 技术讨论、架构设计讨论
- **Pull Request**: 代码审查和技术交流

### 常见问题

**Q: 我应该从哪里开始贡献？**
A: 建议先查看标记为 `good first issue` 的问题，或者改进文档和测试。

**Q: 如何理解履约驱动架构？**
A: 请仔细阅读 [CLAUDE.md](./CLAUDE.md)，这是我们的架构宪法。也可以先运行现有代码，理解五阶段履约流程。

**Q: 测试覆盖率不够怎么办？**
A: 运行 `npm run test:coverage` 查看详细报告，重点关注未覆盖的分支和函数。

**Q: 如何调试性能问题？**
A: 使用项目内置的 `PerformanceTimer` 类，参考 `tests/performance/` 下的性能测试示例。

**Q: 我的PR被拒绝了，怎么办？**
A: 不要气馁！根据反馈意见修改代码，或者在PR中继续讨论。维护者会提供详细的改进建议。

---

## 🎉 最后

感谢您对履约驱动酒店管理系统的兴趣和贡献！

记住我们的核心理念：**"我们不管理客房，我们管理客人"**。让我们一起打造真正以客人为中心的酒店管理系统！

每一行代码都应该服务于提升客人的履约体验和价值实现。

💪 **让我们一起用技术改变酒店行业！**