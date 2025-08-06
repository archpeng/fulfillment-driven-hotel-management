/**
 * 履约驱动管理仪表板
 * "我们不管理客房，我们管理客人"
 */

import { rxdbManager } from '../database/RxDBManager';
import { RxDBSyncManager } from '../database/RxDBSyncManager';

export class FulfillmentDashboard {
  private container: HTMLElement;
  private syncManager?: RxDBSyncManager;
  private updateInterval?: number;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }
    this.container = container;
  }

  /**
   * 初始化仪表板
   */
  public async initialize(): Promise<void> {
    console.log('🏨 初始化履约驱动管理仪表板...');

    try {
      // 初始化数据库
      await rxdbManager.initialize();
      
      // 创建演示数据
      await rxdbManager.createDemoData();

      // 初始化同步管理器
      this.syncManager = new RxDBSyncManager(rxdbManager.getDatabase(), {
        backendUrl: 'https://fulfillment-driven-hotel-management-production.up.railway.app',
        collections: ['guests']
      });

      // 渲染界面
      await this.render();

      // 设置定时更新
      this.startAutoUpdate();

      console.log('✅ 履约驱动管理仪表板初始化完成');
    } catch (error) {
      console.error('❌ 仪表板初始化失败:', error);
      this.renderError(error);
    }
  }

  /**
   * 渲染主界面
   */
  private async render(): Promise<void> {
    const stats = await rxdbManager.getStats();
    const guestsCollection = rxdbManager.getGuestsCollection();
    
    // 获取最新的客人数据
    const recentGuests = await guestsCollection
      .find({
        sort: [{ createdAt: 'desc' }],
        limit: 5
      })
      .exec();

    this.container.innerHTML = `
      <div class="fulfillment-dashboard">
        <!-- 仪表板头部 -->
        <header class="dashboard-header">
          <div class="header-content">
            <div class="logo">
              <span class="logo-icon">🏨</span>
              <div class="logo-text">
                <h1>履约驱动管理系统</h1>
                <p>"我们不管理客房，我们管理客人"</p>
              </div>
            </div>
            
            <div class="sync-status" id="sync-status">
              <div class="sync-indicator loading">
                <span class="sync-icon">🔄</span>
                <span class="sync-text">检查同步状态...</span>
              </div>
            </div>
          </div>
        </header>

        <!-- 统计概览 -->
        <section class="stats-overview">
          <div class="stats-grid">
            <div class="stat-card primary">
              <div class="stat-icon">👥</div>
              <div class="stat-content">
                <div class="stat-number">${stats.total}</div>
                <div class="stat-label">总客人数</div>
              </div>
            </div>
            
            ${this.renderStageStats(stats.byStage)}
          </div>
        </section>

        <!-- 履约阶段流程图 -->
        <section class="fulfillment-flow">
          <h2>五阶段履约流程</h2>
          <div class="flow-diagram">
            ${this.renderFlowDiagram(stats.byStage)}
          </div>
        </section>

        <!-- 客人管理区域 -->
        <section class="guest-management">
          <div class="management-header">
            <h2>客人履约管理</h2>
            <div class="management-actions">
              <button class="btn-primary" onclick="fulfillmentDashboard.addNewGuest()">
                <span>➕</span> 新增客人
              </button>
              <button class="btn-secondary" onclick="fulfillmentDashboard.syncData()">
                <span>🔄</span> 同步数据
              </button>
            </div>
          </div>

          <!-- 筛选器 -->
          <div class="filters">
            <select id="stage-filter" onchange="fulfillmentDashboard.filterByStage(this.value)">
              <option value="">所有阶段</option>
              <option value="awareness">认知阶段</option>
              <option value="evaluation">评估阶段</option>
              <option value="booking">预订阶段</option>
              <option value="experiencing">体验阶段</option>
              <option value="feedback">反馈阶段</option>
            </select>
            
            <select id="loyalty-filter" onchange="fulfillmentDashboard.filterByLoyalty(this.value)">
              <option value="">所有等级</option>
              <option value="bronze">铜牌</option>
              <option value="silver">银牌</option>
              <option value="gold">金牌</option>
              <option value="platinum">白金</option>
            </select>
          </div>

          <!-- 客人列表 -->
          <div class="guests-list" id="guests-list">
            ${this.renderGuestsList(recentGuests)}
          </div>
        </section>

        <!-- 实时数据同步测试 -->
        <section class="sync-testing">
          <h2>实时数据同步测试</h2>
          <div class="sync-test-controls">
            <button class="btn-test" onclick="fulfillmentDashboard.testOfflineSync()">
              📱 测试离线模式
            </button>
            <button class="btn-test" onclick="fulfillmentDashboard.testConflictResolution()">
              ⚖️ 测试冲突解决
            </button>
            <button class="btn-test" onclick="fulfillmentDashboard.simulateMultiDevice()">
              💻 模拟多设备同步
            </button>
          </div>
          <div class="sync-log" id="sync-log">
            <div class="log-item">
              <span class="log-time">${new Date().toLocaleTimeString()}</span>
              <span class="log-message">📊 仪表板加载完成，共 ${stats.total} 位客人</span>
            </div>
          </div>
        </section>
      </div>
    `;

    // 初始化同步状态
    await this.updateSyncStatus();
  }

  /**
   * 渲染阶段统计
   */
  private renderStageStats(stageStats: any[]): string {
    const stageNames = {
      awareness: '认知',
      evaluation: '评估', 
      booking: '预订',
      experiencing: '体验',
      feedback: '反馈'
    };

    const stageIcons = {
      awareness: '👁️',
      evaluation: '🤔',
      booking: '📅',
      experiencing: '🏨',
      feedback: '💬'
    };

    return stageStats.map(({ stage, count }) => `
      <div class="stat-card ${stage}">
        <div class="stat-icon">${stageIcons[stage] || '📊'}</div>
        <div class="stat-content">
          <div class="stat-number">${count}</div>
          <div class="stat-label">${stageNames[stage] || stage}</div>
        </div>
      </div>
    `).join('');
  }

  /**
   * 渲染流程图
   */
  private renderFlowDiagram(stageStats: any[]): string {
    const stages = [
      { key: 'awareness', name: '认知阶段', icon: '👁️', color: '#3b82f6' },
      { key: 'evaluation', name: '评估阶段', icon: '🤔', color: '#8b5cf6' },
      { key: 'booking', name: '预订阶段', icon: '📅', color: '#10b981' },
      { key: 'experiencing', name: '体验阶段', icon: '🏨', color: '#f59e0b' },
      { key: 'feedback', name: '反馈阶段', icon: '💬', color: '#ef4444' }
    ];

    return stages.map((stage, index) => {
      const stat = stageStats.find(s => s.stage === stage.key);
      const count = stat ? stat.count : 0;
      const isLast = index === stages.length - 1;

      return `
        <div class="flow-stage" style="border-color: ${stage.color}">
          <div class="stage-header" style="background-color: ${stage.color}">
            <span class="stage-icon">${stage.icon}</span>
            <span class="stage-name">${stage.name}</span>
          </div>
          <div class="stage-count">${count} 位客人</div>
          <div class="stage-progress">
            <div class="progress-bar" style="width: ${count * 20}%; background-color: ${stage.color}"></div>
          </div>
        </div>
        ${!isLast ? '<div class="flow-arrow">→</div>' : ''}
      `;
    }).join('');
  }

  /**
   * 渲染客人列表
   */
  private renderGuestsList(guests: any[]): string {
    if (guests.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <div class="empty-message">暂无客人数据</div>
          <button class="btn-primary" onclick="fulfillmentDashboard.createDemoData()">
            创建演示数据
          </button>
        </div>
      `;
    }

    return `
      <div class="guests-table">
        <div class="table-header">
          <div class="col-name">客人姓名</div>
          <div class="col-phone">联系电话</div>
          <div class="col-stage">履约阶段</div>
          <div class="col-loyalty">忠诚度</div>
          <div class="col-value">生命价值</div>
          <div class="col-actions">操作</div>
        </div>
        ${guests.map(guest => this.renderGuestRow(guest)).join('')}
      </div>
    `;
  }

  /**
   * 渲染客人行
   */
  private renderGuestRow(guest: any): string {
    const stageNames = {
      awareness: '认知',
      evaluation: '评估',
      booking: '预订', 
      experiencing: '体验',
      feedback: '反馈'
    };

    const loyaltyNames = {
      bronze: '铜牌',
      silver: '银牌',
      gold: '金牌',
      platinum: '白金'
    };

    const loyaltyColors = {
      bronze: '#cd7f32',
      silver: '#c0c0c0', 
      gold: '#ffd700',
      platinum: '#e5e4e2'
    };

    return `
      <div class="table-row" onclick="fulfillmentDashboard.viewGuest('${guest.id}')">
        <div class="col-name">
          <div class="guest-name">${guest.personalInfo.name}</div>
          <div class="guest-id">${guest.id}</div>
        </div>
        <div class="col-phone">${guest.personalInfo.phone}</div>
        <div class="col-stage">
          <span class="stage-badge ${guest.fulfillmentHistory.currentStage}">
            ${stageNames[guest.fulfillmentHistory.currentStage] || guest.fulfillmentHistory.currentStage}
          </span>
        </div>
        <div class="col-loyalty">
          <span class="loyalty-badge" style="background-color: ${loyaltyColors[guest.tags.loyaltyLevel]}">
            ${loyaltyNames[guest.tags.loyaltyLevel] || guest.tags.loyaltyLevel}
          </span>
        </div>
        <div class="col-value">¥${guest.businessMetrics.lifetimeValue.toFixed(2)}</div>
        <div class="col-actions">
          <button class="btn-small" onclick="event.stopPropagation(); fulfillmentDashboard.advanceStage('${guest.id}')">
            进入下阶段
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 更新同步状态
   */
  private async updateSyncStatus(): Promise<void> {
    const statusElement = document.getElementById('sync-status');
    if (!statusElement || !this.syncManager) return;

    try {
      const health = await this.syncManager.checkSyncHealth();
      
      statusElement.innerHTML = `
        <div class="sync-indicator ${health.healthy ? 'healthy' : 'error'}">
          <span class="sync-icon">${health.healthy ? '✅' : '❌'}</span>
          <span class="sync-text">${health.message}</span>
        </div>
      `;
    } catch (error) {
      statusElement.innerHTML = `
        <div class="sync-indicator error">
          <span class="sync-icon">❌</span>
          <span class="sync-text">同步服务不可用</span>
        </div>
      `;
    }
  }

  /**
   * 开始自动更新
   */
  private startAutoUpdate(): void {
    this.updateInterval = window.setInterval(async () => {
      await this.updateSyncStatus();
      // 可以添加更多自动更新逻辑
    }, 30000); // 每30秒更新一次
  }

  /**
   * 停止自动更新
   */
  public stopAutoUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  /**
   * 渲染错误界面
   */
  private renderError(error: any): void {
    this.container.innerHTML = `
      <div class="error-container">
        <div class="error-icon">⚠️</div>
        <div class="error-title">初始化失败</div>
        <div class="error-message">${error.message}</div>
        <button class="btn-primary" onclick="location.reload()">
          重新加载
        </button>
      </div>
    `;
  }

  /**
   * 公共方法 - 添加新客人
   */
  public async addNewGuest(): Promise<void> {
    const name = prompt('请输入客人姓名:');
    const phone = prompt('请输入联系电话:');
    
    if (!name || !phone) return;

    try {
      const guestsCollection = rxdbManager.getGuestsCollection();
      const newGuest = {
        id: `guest-${Date.now()}`,
        personalInfo: {
          name,
          phone,
          email: '',
          idCard: '',
          address: ''
        },
        fulfillmentHistory: {
          currentStage: 'awareness',
          stageStartTime: new Date(),
          completedStages: [],
          journeyCount: 1
        },
        businessMetrics: {
          lifetimeValue: 0,
          totalBookings: 0,
          averageRating: 0,
          referralCount: 0
        },
        tags: {
          loyaltyLevel: 'bronze',
          riskLevel: 'low',
          valueSegment: 'standard'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'user',
        version: 1,
        isDeleted: false
      };

      await guestsCollection.insert(newGuest);
      this.addLogMessage(`✅ 新增客人: ${name} (${phone})`);
      await this.render(); // 刷新界面
    } catch (error) {
      console.error('添加客人失败:', error);
      this.addLogMessage(`❌ 添加客人失败: ${error.message}`);
    }
  }

  /**
   * 同步数据
   */
  public async syncData(): Promise<void> {
    if (!this.syncManager) return;

    try {
      this.addLogMessage('🔄 开始数据同步...');
      await this.syncManager.startAllSync();
      this.addLogMessage('✅ 数据同步已启动');
    } catch (error) {
      this.addLogMessage(`❌ 同步失败: ${error.message}`);
    }
  }

  /**
   * 添加日志消息
   */
  private addLogMessage(message: string): void {
    const logElement = document.getElementById('sync-log');
    if (!logElement) return;

    const logItem = document.createElement('div');
    logItem.className = 'log-item';
    logItem.innerHTML = `
      <span class="log-time">${new Date().toLocaleTimeString()}</span>
      <span class="log-message">${message}</span>
    `;

    logElement.insertBefore(logItem, logElement.firstChild);

    // 保持最多10条日志
    const logItems = logElement.querySelectorAll('.log-item');
    if (logItems.length > 10) {
      logItems[logItems.length - 1].remove();
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.stopAutoUpdate();
  }
}

// 全局实例
declare global {
  interface Window {
    fulfillmentDashboard: FulfillmentDashboard;
  }
}