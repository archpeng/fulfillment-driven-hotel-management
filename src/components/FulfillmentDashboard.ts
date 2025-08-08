/**
 * 履约驱动管理仪表板
 * "我们不管理客房，我们管理客人"
 */

import { rxdbManager } from '../database/RxDBManager';
import { RxDBSyncManager } from '../database/RxDBSyncManager';
import { RealtimeSyncService, type RealtimeSyncConfig, type SyncMetrics, type SyncEvent } from '../database/RealtimeSyncService';
import { fulfillmentMachine, type FulfillmentContext, type FulfillmentEvent } from '../xstate/FulfillmentStateMachine';
import { FulfillmentEventTracker, type EventPatternAnalysis, type EventAnomaly } from '../domain/fulfillment/services/FulfillmentEventTracker';
import { OfflineModeTestSuite, type OfflineTestReport } from '../services/OfflineModeTestSuite';
import { PerformanceMonitoringService, initializePerformanceMonitoring, type PerformanceReport, type SystemHealth } from '../services/PerformanceMonitoringService';
import { FulfillmentFunnelChart } from './FulfillmentFunnelChart';
import { createActor } from 'xstate';

export class FulfillmentDashboard {
  private container: HTMLElement;
  private syncManager?: RxDBSyncManager;
  private realtimeSyncService?: RealtimeSyncService;
  private eventTracker: FulfillmentEventTracker;
  private offlineTestSuite?: OfflineModeTestSuite;
  private performanceMonitor?: PerformanceMonitoringService;
  private updateInterval?: number;
  private fulfillmentActors: Map<string, any> = new Map(); // 存储每个客人的状态机Actor
  private syncMetrics: SyncMetrics | null = null;
  private performanceReport: PerformanceReport | null = null;
  private systemHealth: SystemHealth | null = null;
  private funnelChart?: FulfillmentFunnelChart;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }
    this.container = container;
    this.eventTracker = new FulfillmentEventTracker();
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

      // 初始化实时同步服务
      const realtimeSyncConfig: RealtimeSyncConfig = {
        backendUrl: 'https://fulfillment-driven-hotel-management-production.up.railway.app',
        collections: ['guests'],
        networkMonitoring: true,
        reconnectInterval: 5000,
        maxRetries: 3,
        syncThrottleMs: 1000,
        batchSizeAdaptive: true,
        conflictResolution: 'last-write-wins',
        offlineQueueEnabled: true,
        maxOfflineActions: 1000,
        batchSize: 10,
        live: true,
        retry: true
      };

      this.realtimeSyncService = new RealtimeSyncService(rxdbManager.getDatabase(), realtimeSyncConfig);
      
      // 初始化离线测试套件
      this.offlineTestSuite = new OfflineModeTestSuite(this.realtimeSyncService, this.eventTracker);
      
      // 初始化性能监控
      this.performanceMonitor = initializePerformanceMonitoring(this.eventTracker);
      this.subscribeToPerformanceEvents();
      
      // 订阅同步事件
      this.subscribeToSyncEvents();

      // 初始化履约状态机
      await this.initializeFulfillmentMachines();

      // 渲染界面
      await this.render();

      // 初始化漏斗图
      this.initializeFunnelChart();

      // 设置定时更新
      this.startAutoUpdate();

      console.log('✅ 履约驱动管理仪表板初始化完成');
    } catch (error) {
      console.error('❌ 仪表板初始化失败:', error);
      this.renderError(error);
    }
  }

  /**
   * 初始化履约漏斗图
   */
  private async initializeFunnelChart(): Promise<void> {
    try {
      // 创建漏斗图实例
      this.funnelChart = new FulfillmentFunnelChart('fulfillment-funnel-container', {
        width: 800,
        height: 500,
        showLabels: true,
        showConversionRates: true,
        showTrends: true,
        highlightBottlenecks: true
      });

      // 获取阶段数据
      const stats = await rxdbManager.getStats();
      const funnelData = stats.byStage.map(stage => ({
        stage: stage.stage,
        count: stage.count
      }));

      // 设置漏斗数据
      this.funnelChart.setData(funnelData);

      console.log('✅ 履约漏斗图初始化完成');
    } catch (error) {
      console.error('❌ 漏斗图初始化失败:', error);
    }
  }

  /**
   * 更新漏斗图数据
   */
  private async updateFunnelChart(): Promise<void> {
    if (!this.funnelChart) return;

    try {
      const stats = await rxdbManager.getStats();
      const funnelData = stats.byStage.map(stage => ({
        stage: stage.stage,
        count: stage.count
      }));

      this.funnelChart.updateData(funnelData);
    } catch (error) {
      console.error('❌ 更新漏斗图失败:', error);
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
            
            <div class="sync-metrics" id="sync-metrics">
              <!-- 同步指标将在这里显示 -->
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

        <!-- 履约转化漏斗图 -->
        <section class="fulfillment-funnel" style="margin-bottom: 32px;">
          <div id="fulfillment-funnel-container"></div>
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

        <!-- 履约状态机测试 -->
        <section class="sync-testing">
          <h2>履约状态机 & 数据同步测试</h2>
          <div class="sync-test-controls">
            <div class="control-group">
              <h3>状态机事件模拟</h3>
              <button class="btn-test" onclick="fulfillmentDashboard.simulateRandomEvent()">
                🎲 模拟随机事件
              </button>
              <button class="btn-test" onclick="fulfillmentDashboard.simulateAwarenessEvent()">
                👁️ 模拟认知事件
              </button>
              <button class="btn-test" onclick="fulfillmentDashboard.simulateBookingEvent()">
                📅 模拟预订事件
              </button>
              <button class="btn-test" onclick="fulfillmentDashboard.simulateComplaintEvent()">
                🚨 模拟投诉事件
              </button>
            </div>
            
            <div class="control-group">
              <h3>数据同步测试</h3>
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
            
            <div class="control-group">
              <h3>实时同步控制</h3>
              <button class="btn-test" onclick="fulfillmentDashboard.forceSyncAll()">
                💪 强制同步全部
              </button>
              <button class="btn-test" onclick="fulfillmentDashboard.showSyncMetricsDetail()">
                📊 查看同步指标
              </button>
              <select onchange="fulfillmentDashboard.switchConflictResolution(this.value)">
                <option value="last-write-wins">最后写入获胜</option>
                <option value="merge">智能合并</option>
                <option value="manual">手动处理</option>
              </select>
            </div>

            <div class="control-group">
              <h3>履约事件追踪</h3>
              <button class="btn-test" onclick="fulfillmentDashboard.showEventOverview()">
                📈 事件总览
              </button>
              <button class="btn-test" onclick="fulfillmentDashboard.detectSystemAnomalies()">
                🚨 异常检测
              </button>
              <button class="btn-test" onclick="fulfillmentDashboard.exportEventData()">
                📋 导出数据
              </button>
            </div>
          </div>
          <div class="sync-log" id="sync-log">
            <div class="log-item">
              <span class="log-time">${new Date().toLocaleTimeString()}</span>
              <span class="log-message">📊 仪表板加载完成，共 ${stats.total} 位客人</span>
            </div>
          </div>
        </section>

        <!-- 性能监控仪表板 -->
        <section class="performance-monitoring">
          <h2>系统性能监控</h2>
          <div class="performance-overview">
            <!-- 系统健康状态 -->
            <div class="health-status" id="health-status">
              <div class="health-indicator healthy">
                <span class="health-icon">✅</span>
                <div class="health-content">
                  <div class="health-score">100</div>
                  <div class="health-label">系统健康度</div>
                </div>
              </div>
            </div>

            <!-- 性能指标网格 -->
            <div class="performance-metrics" id="performance-metrics">
              <!-- 性能指标将在这里显示 -->
            </div>
          </div>

          <!-- 性能控制区域 -->
          <div class="performance-controls">
            <div class="control-group">
              <h3>性能分析</h3>
              <button class="btn-test" onclick="fulfillmentDashboard.generatePerformanceReport()">
                📊 生成性能报告
              </button>
              <button class="btn-test" onclick="fulfillmentDashboard.showBenchmarkData()">
                🏁 查看基准测试
              </button>
              <button class="btn-test" onclick="fulfillmentDashboard.runPerformanceTest()">
                🧪 运行性能测试
              </button>
            </div>

            <div class="control-group">
              <h3>监控控制</h3>
              <button class="btn-test" onclick="fulfillmentDashboard.resetPerformanceData()">
                🔄 重置监控数据
              </button>
              <button class="btn-test" onclick="fulfillmentDashboard.showSystemHealth()">
                💚 系统健康检查
              </button>
              <button class="btn-test" onclick="fulfillmentDashboard.exportPerformanceData()">
                📤 导出性能数据
              </button>
            </div>
          </div>

          <!-- 性能图表区域 -->
          <div class="performance-charts" id="performance-charts">
            <!-- 性能图表将在这里显示 -->
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
          <button class="btn-small secondary" onclick="event.stopPropagation(); fulfillmentDashboard.viewStateMachine('${guest.id}')">
            状态机
          </button>
          <button class="btn-small tertiary" onclick="event.stopPropagation(); fulfillmentDashboard.analyzeGuestPattern('${guest.id}')">
            模式分析
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 订阅同步事件
   */
  private subscribeToSyncEvents(): void {
    if (!this.realtimeSyncService) return;

    // 监听同步事件
    this.realtimeSyncService.getSyncEvents$().subscribe((event: SyncEvent) => {
      this.handleSyncEvent(event);
    });

    // 监听网络状态变化
    this.realtimeSyncService.getNetworkStatus$().subscribe((isOnline: boolean) => {
      this.updateNetworkStatus(isOnline);
    });

    // 监听同步状态变化
    this.realtimeSyncService.getSyncStatus$().subscribe((status) => {
      this.updateSyncStatusDisplay(status);
    });
  }

  /**
   * 订阅性能监控事件
   */
  private subscribeToPerformanceEvents(): void {
    if (!this.performanceMonitor) return;

    // 监听性能指标更新
    this.performanceMonitor.getMetricsStream().subscribe((metric) => {
      console.log(`📊 性能指标更新: ${metric.name} = ${metric.value}${metric.unit}`);
    });

    // 监听系统健康状态变化
    this.performanceMonitor.getSystemHealthStream().subscribe((health: SystemHealth) => {
      this.systemHealth = health;
      this.updateHealthStatusDisplay();
    });

    // 定期生成性能报告
    setInterval(() => {
      if (this.performanceMonitor) {
        this.performanceReport = this.performanceMonitor.generatePerformanceReport(1); // 1小时报告
        this.updatePerformanceDisplay();
      }
    }, 30000); // 每30秒更新一次
  }

  /**
   * 处理同步事件
   */
  private handleSyncEvent(event: SyncEvent): void {
    const eventMessages = {
      'sync-start': '🔄 开始同步',
      'sync-complete': '✅ 同步完成',
      'sync-error': '❌ 同步失败',
      'conflict-resolved': '⚖️ 冲突已解决',
      'network-change': '🌐 网络状态变化',
      'offline-queue-action': '📥 离线操作入队'
    };

    const message = eventMessages[event.type] || '📊 同步事件';
    const details = event.collectionName ? ` - ${event.collectionName}` : '';
    const errorInfo = event.error ? ` (${event.error})` : '';
    
    this.addLogMessage(`${message}${details}${errorInfo}`);

    // 更新同步指标
    if (event.metrics) {
      this.syncMetrics = event.metrics as SyncMetrics;
      this.updateSyncMetricsDisplay();
    }
  }

  /**
   * 更新网络状态显示
   */
  private updateNetworkStatus(isOnline: boolean): void {
    const networkStatusElements = document.querySelectorAll('.network-status');
    networkStatusElements.forEach(element => {
      element.className = `network-status ${isOnline ? 'online' : 'offline'}`;
      element.textContent = isOnline ? '在线' : '离线';
    });

    this.addLogMessage(`🌐 网络状态: ${isOnline ? '在线' : '离线'}`);
  }

  /**
   * 更新同步状态显示
   */
  private updateSyncStatusDisplay(status: 'idle' | 'syncing' | 'error' | 'offline'): void {
    const statusElement = document.getElementById('sync-status');
    if (!statusElement) return;

    const statusConfig = {
      idle: { icon: '✅', text: '同步空闲', class: 'healthy' },
      syncing: { icon: '🔄', text: '正在同步', class: 'syncing' },
      error: { icon: '❌', text: '同步错误', class: 'error' },
      offline: { icon: '📱', text: '离线模式', class: 'offline' }
    };

    const config = statusConfig[status];
    statusElement.innerHTML = `
      <div class="sync-indicator ${config.class}">
        <span class="sync-icon">${config.icon}</span>
        <span class="sync-text">${config.text}</span>
      </div>
    `;
  }

  /**
   * 更新同步指标显示
   */
  private updateSyncMetricsDisplay(): void {
    if (!this.syncMetrics) return;

    const metricsElement = document.getElementById('sync-metrics');
    if (!metricsElement) return;

    const offlineQueueStatus = this.realtimeSyncService?.getOfflineQueueStatus();

    metricsElement.innerHTML = `
      <div class="metrics-grid">
        <div class="metric">
          <span class="metric-label">同步次数</span>
          <span class="metric-value">${this.syncMetrics.totalSyncs}</span>
        </div>
        <div class="metric">
          <span class="metric-label">成功率</span>
          <span class="metric-value">${this.syncMetrics.successRate.toFixed(1)}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">平均延迟</span>
          <span class="metric-value">${this.syncMetrics.averageLatency.toFixed(0)}ms</span>
        </div>
        <div class="metric">
          <span class="metric-label">冲突解决</span>
          <span class="metric-value">${this.syncMetrics.conflictsResolved}</span>
        </div>
        <div class="metric">
          <span class="metric-label">离线队列</span>
          <span class="metric-value">${offlineQueueStatus?.queueLength || 0}</span>
        </div>
        <div class="metric">
          <span class="metric-label">网络状态</span>
          <span class="metric-value network-status ${this.syncMetrics.networkStatus}">${this.syncMetrics.networkStatus}</span>
        </div>
      </div>
    `;
  }

  /**
   * 更新同步状态（兼容旧版本）
   */
  private async updateSyncStatus(): Promise<void> {
    const statusElement = document.getElementById('sync-status');
    if (!statusElement) return;

    if (this.realtimeSyncService) {
      // 使用新的实时同步服务
      const metrics = this.realtimeSyncService.getSyncMetrics();
      this.syncMetrics = metrics;
      this.updateSyncMetricsDisplay();
      return;
    }

    // 兼容旧的同步管理器
    if (!this.syncManager) return;

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
   * 更新系统健康状态显示
   */
  private updateHealthStatusDisplay(): void {
    if (!this.systemHealth) return;

    const healthElement = document.getElementById('health-status');
    if (!healthElement) return;

    const healthClass = this.systemHealth.overall;
    const healthIcon = this.systemHealth.overall === 'healthy' ? '✅' : 
                      this.systemHealth.overall === 'warning' ? '⚠️' : '❌';

    healthElement.innerHTML = `
      <div class="health-indicator ${healthClass}">
        <span class="health-icon">${healthIcon}</span>
        <div class="health-content">
          <div class="health-score">${this.systemHealth.score}</div>
          <div class="health-label">系统健康度</div>
        </div>
      </div>
      ${this.systemHealth.issues.length > 0 ? `
        <div class="health-issues">
          <h4>发现的问题:</h4>
          <ul>
            ${this.systemHealth.issues.map(issue => `<li>⚠️ ${issue}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      ${this.systemHealth.recommendations.length > 0 ? `
        <div class="health-recommendations">
          <h4>建议:</h4>
          <ul>
            ${this.systemHealth.recommendations.map(rec => `<li>💡 ${rec}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;
  }

  /**
   * 更新性能指标显示
   */
  private updatePerformanceDisplay(): void {
    if (!this.performanceReport) return;

    const metricsElement = document.getElementById('performance-metrics');
    if (!metricsElement) return;

    const { summary } = this.performanceReport;
    
    metricsElement.innerHTML = `
      <div class="performance-grid">
        <div class="performance-metric">
          <span class="metric-icon">⚡</span>
          <div class="metric-content">
            <div class="metric-value">${summary.averageResponseTime.toFixed(1)}ms</div>
            <div class="metric-label">平均响应时间</div>
          </div>
        </div>
        
        <div class="performance-metric">
          <span class="metric-icon">🔄</span>
          <div class="metric-content">
            <div class="metric-value">${summary.totalOperations}</div>
            <div class="metric-label">总操作次数</div>
          </div>
        </div>
        
        <div class="performance-metric">
          <span class="metric-icon">📊</span>
          <div class="metric-content">
            <div class="metric-value">${summary.throughput.toFixed(1)}/s</div>
            <div class="metric-label">吞吐量</div>
          </div>
        </div>
        
        <div class="performance-metric ${summary.errorRate > 0.05 ? 'warning' : ''}">
          <span class="metric-icon">${summary.errorRate > 0.05 ? '⚠️' : '✅'}</span>
          <div class="metric-content">
            <div class="metric-value">${(summary.errorRate * 100).toFixed(1)}%</div>
            <div class="metric-label">错误率</div>
          </div>
        </div>
      </div>
    `;

    this.updatePerformanceCharts();
  }

  /**
   * 更新性能图表
   */
  private updatePerformanceCharts(): void {
    if (!this.performanceReport) return;

    const chartsElement = document.getElementById('performance-charts');
    if (!chartsElement) return;

    const { topSlowOperations, trends } = this.performanceReport;

    chartsElement.innerHTML = `
      <div class="charts-grid">
        <!-- 最慢操作排行 -->
        <div class="chart-container">
          <h4>最慢操作排行</h4>
          <div class="slow-operations">
            ${topSlowOperations.map((op, index) => `
              <div class="slow-operation">
                <span class="operation-rank">#${index + 1}</span>
                <span class="operation-name">${op.operation}</span>
                <span class="operation-time">${op.avgTime.toFixed(1)}ms</span>
                <span class="operation-count">${op.count} 次</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 性能趋势图 -->
        <div class="chart-container">
          <h4>响应时间趋势</h4>
          <div class="trend-chart">
            ${this.renderTrendChart(trends.responseTime, 'ms')}
          </div>
        </div>

        <!-- 吞吐量趋势 -->
        <div class="chart-container">
          <h4>吞吐量趋势</h4>
          <div class="trend-chart">
            ${this.renderTrendChart(trends.throughput, 'ops/s')}
          </div>
        </div>

        <!-- 错误率趋势 -->
        <div class="chart-container">
          <h4>错误率趋势</h4>
          <div class="trend-chart">
            ${this.renderTrendChart(trends.errorRate.map(p => ({ ...p, value: p.value * 100 })), '%')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染趋势图表（简化的文本版本）
   */
  private renderTrendChart(data: Array<{ timestamp: Date; value: number }>, unit: string): string {
    if (data.length === 0) return '<div class="no-data">暂无数据</div>';

    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue || 1;

    return `
      <div class="simple-chart">
        ${data.map((point, index) => {
          const height = ((point.value - minValue) / range) * 100;
          const time = point.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
          return `
            <div class="chart-bar" style="height: ${Math.max(5, height)}%" title="${time}: ${point.value.toFixed(2)}${unit}">
              <span class="bar-value">${point.value.toFixed(1)}</span>
            </div>
          `;
        }).join('')}
      </div>
      <div class="chart-labels">
        <span class="label-min">${minValue.toFixed(1)}${unit}</span>
        <span class="label-max">${maxValue.toFixed(1)}${unit}</span>
      </div>
    `;
  }

  /**
   * 开始自动更新
   */
  private startAutoUpdate(): void {
    this.updateInterval = window.setInterval(async () => {
      await this.updateSyncStatus();
      await this.updateFunnelChart(); // 更新漏斗图
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
      
      // 为新客人创建状态机Actor
      await this.createFulfillmentActor(newGuest);
      
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
    try {
      this.addLogMessage('🔄 开始数据同步...');
      
      if (this.realtimeSyncService) {
        await this.realtimeSyncService.startRealtimeSync();
        this.addLogMessage('✅ 实时同步已启动');
      } else if (this.syncManager) {
        await this.syncManager.startAllSync();
        this.addLogMessage('✅ 数据同步已启动');
      }
    } catch (error) {
      this.addLogMessage(`❌ 同步失败: ${error.message}`);
    }
  }

  /**
   * 强制同步所有数据
   */
  public async forceSyncAll(): Promise<void> {
    if (!this.realtimeSyncService) {
      this.addLogMessage('❌ 实时同步服务未初始化');
      return;
    }

    try {
      this.addLogMessage('💪 开始强制同步所有数据...');
      await this.realtimeSyncService.forceSyncAll();
      this.addLogMessage('✅ 强制同步完成');
    } catch (error) {
      this.addLogMessage(`❌ 强制同步失败: ${error.message}`);
    }
  }

  /**
   * 切换冲突解决策略
   */
  public switchConflictResolution(strategy: 'last-write-wins' | 'manual' | 'merge'): void {
    if (!this.realtimeSyncService) {
      this.addLogMessage('❌ 实时同步服务未初始化');
      return;
    }

    this.realtimeSyncService.setConflictResolution(strategy);
    this.addLogMessage(`⚖️ 冲突解决策略已切换: ${strategy}`);
  }

  /**
   * 查看同步指标详情
   */
  public showSyncMetricsDetail(): void {
    if (!this.syncMetrics) {
      alert('暂无同步指标数据');
      return;
    }

    const offlineQueue = this.realtimeSyncService?.getOfflineQueueStatus();
    
    const metricsInfo = `
同步指标详情:
━━━━━━━━━━━━━━━━━━━━
📊 总同步次数: ${this.syncMetrics.totalSyncs}
✅ 成功率: ${this.syncMetrics.successRate.toFixed(1)}%
⚡ 平均延迟: ${this.syncMetrics.averageLatency.toFixed(0)}ms
⚖️ 冲突解决: ${this.syncMetrics.conflictsResolved} 次
📈 传输字节: ${(this.syncMetrics.bytesTransferred / 1024).toFixed(1)}KB
🕐 最后同步: ${this.syncMetrics.lastSyncTimestamp.toLocaleString()}
🌐 网络状态: ${this.syncMetrics.networkStatus}

📥 离线队列状态:
━━━━━━━━━━━━━━━━━━━━
队列长度: ${offlineQueue?.queueLength || 0}
最大队列: ${offlineQueue?.maxQueueSize || 0}
最早操作: ${offlineQueue?.oldestAction?.toLocaleString() || '无'}
最新操作: ${offlineQueue?.newestAction?.toLocaleString() || '无'}
    `;

    alert(metricsInfo);
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
   * 初始化履约状态机
   */
  private async initializeFulfillmentMachines(): Promise<void> {
    try {
      const guestsCollection = rxdbManager.getGuestsCollection();
      const allGuests = await guestsCollection.find().exec();

      for (const guest of allGuests) {
        await this.createFulfillmentActor(guest);
      }

      this.addLogMessage(`🤖 初始化 ${allGuests.length} 个履约状态机`);
    } catch (error) {
      console.error('状态机初始化失败:', error);
      this.addLogMessage(`❌ 状态机初始化失败: ${error.message}`);
    }
  }

  /**
   * 为客人创建履约状态机Actor
   */
  private async createFulfillmentActor(guest: any): Promise<void> {
    try {
      // 创建状态机Actor
      const actor = createActor(fulfillmentMachine, {
        input: {
          guest: guest,
          currentStage: guest.fulfillmentHistory.currentStage,
          stageStartTime: new Date(guest.fulfillmentHistory.stageStartTime),
          completedStages: guest.fulfillmentHistory.completedStages || [],
          qualityScore: guest.businessMetrics.lifetimeValue / 10, // 简化评分计算
          errors: [],
          eventHistory: []
        }
      });

      // 订阅状态变化
      actor.subscribe({
        next: (snapshot) => {
          this.handleFulfillmentStateChange(guest.id, snapshot);
        },
        error: (error) => {
          console.error(`客人 ${guest.id} 状态机错误:`, error);
          this.addLogMessage(`❌ 客人 ${guest.personalInfo.name} 状态机错误`);
        }
      });

      // 启动状态机
      actor.start();
      
      // 发送启动历程事件
      actor.send({
        type: 'START_JOURNEY',
        guest: guest
      });

      // 存储Actor引用
      this.fulfillmentActors.set(guest.id, actor);

      console.log(`✅ 为客人 ${guest.personalInfo.name} 创建履约状态机`);
    } catch (error) {
      console.error(`创建状态机失败 (客人: ${guest.id}):`, error);
    }
  }

  /**
   * 处理履约状态变化
   */
  private handleFulfillmentStateChange(guestId: string, snapshot: any): void {
    console.log(`🔄 客人 ${guestId} 状态机更新:`, {
      state: snapshot.value,
      context: snapshot.context
    });

    // 更新数据库中的客人信息
    this.updateGuestFromStateMachine(guestId, snapshot);
    
    // 实时更新UI
    this.refreshGuestRow(guestId);
  }

  /**
   * 从状态机快照更新客人数据
   */
  private async updateGuestFromStateMachine(guestId: string, snapshot: any): Promise<void> {
    try {
      const guestsCollection = rxdbManager.getGuestsCollection();
      const guestDoc = await guestsCollection.findOne(guestId).exec();
      
      if (guestDoc) {
        await guestDoc.patch({
          fulfillmentHistory: {
            ...guestDoc.fulfillmentHistory,
            currentStage: snapshot.context.currentStage,
            stageStartTime: snapshot.context.stageStartTime
          },
          businessMetrics: {
            ...guestDoc.businessMetrics,
            lifetimeValue: snapshot.context.qualityScore * 10 // 评分转换为价值
          },
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('更新客人数据失败:', error);
    }
  }

  /**
   * 推进客人履约阶段
   */
  public async advanceStage(guestId: string): Promise<void> {
    const actor = this.fulfillmentActors.get(guestId);
    if (!actor) {
      this.addLogMessage(`❌ 未找到客人 ${guestId} 的状态机`);
      return;
    }

    try {
      // 发送推进阶段事件
      actor.send({ type: 'ADVANCE_STAGE' });
      
      const guestsCollection = rxdbManager.getGuestsCollection();
      const guest = await guestsCollection.findOne(guestId).exec();
      
      if (guest) {
        this.addLogMessage(`🎯 推进客人 ${guest.personalInfo.name} 履约阶段`);
      }
    } catch (error) {
      console.error('推进阶段失败:', error);
      this.addLogMessage(`❌ 推进阶段失败: ${error.message}`);
    }
  }

  /**
   * 记录履约事件
   */
  public async recordFulfillmentEvent(guestId: string, eventType: string, data?: any): Promise<void> {
    const actor = this.fulfillmentActors.get(guestId);
    if (!actor) {
      console.error(`未找到客人 ${guestId} 的状态机`);
      return;
    }

    try {
      // 发送到XState状态机
      actor.send({
        type: 'RECORD_EVENT',
        eventType,
        data
      });

      // 同时记录到事件追踪器
      const journeyId = `journey-${guestId}-${Date.now()}`;
      const currentSnapshot = actor.getSnapshot();
      const currentStage = currentSnapshot.context.currentStage;
      
      // 计算事件影响分数（基于事件类型）
      const eventImpactScores: { [key: string]: number } = {
        'PAGE_VIEW': 5, 'AD_CLICK': 10, 'SEARCH_QUERY': 15,
        'DETAILS_VIEW': 20, 'INQUIRY_SUBMIT': 25, 'LIVE_CHAT': 30,
        'BOOKING_START': 40, 'PAYMENT_INFO': 35, 'PAYMENT_SUCCESS': 50,
        'BOOKING_CONFIRMED': 60, 'CHECK_IN': 50, 'SERVICE_REQUEST': 30,
        'POSITIVE_FEEDBACK': 40, 'NEGATIVE_FEEDBACK': -40,
        'COMPLAINT': -60, 'HIGH_RATING': 45, 'REVIEW_SUBMIT': 35,
        'REFERRAL': 50, 'REPEAT_BOOKING': 80
      };
      
      const impact = eventImpactScores[eventType] || 0;
      
      this.eventTracker.trackEvent(
        journeyId,
        guestId,
        eventType,
        currentStage,
        data || {},
        impact,
        'user'
      );

      const guestsCollection = rxdbManager.getGuestsCollection();
      const guest = await guestsCollection.findOne(guestId).exec();
      
      if (guest) {
        this.addLogMessage(`📊 记录事件: ${guest.personalInfo.name} - ${eventType} (影响: ${impact > 0 ? '+' : ''}${impact})`);
      }
    } catch (error) {
      console.error('记录事件失败:', error);
      this.addLogMessage(`❌ 记录事件失败: ${error.message}`);
    }
  }

  /**
   * 查看状态机状态
   */
  public viewStateMachine(guestId: string): void {
    const actor = this.fulfillmentActors.get(guestId);
    if (!actor) {
      alert('未找到客人的状态机');
      return;
    }

    const snapshot = actor.getSnapshot();
    const stateInfo = {
      当前状态: snapshot.value,
      质量评分: snapshot.context.qualityScore,
      事件历史: snapshot.context.eventHistory.length,
      错误列表: snapshot.context.errors
    };

    alert(`状态机信息：\n${JSON.stringify(stateInfo, null, 2)}`);
    
    // 记录日志
    console.log('🤖 状态机详情:', snapshot);
  }

  /**
   * 刷新客人行显示
   */
  private async refreshGuestRow(guestId: string): Promise<void> {
    // 这里可以只刷新特定客人的行，而不是整个列表
    // 为了简化，先刷新整个客人列表
    const guestsCollection = rxdbManager.getGuestsCollection();
    const guests = await guestsCollection
      .find({
        sort: [{ updatedAt: 'desc' }],
        limit: 10
      })
      .exec();

    const guestsList = document.getElementById('guests-list');
    if (guestsList) {
      guestsList.innerHTML = this.renderGuestsList(guests);
    }
  }

  /**
   * 模拟履约事件
   */
  public async simulateEvent(guestId: string, eventType: string): Promise<void> {
    await this.recordFulfillmentEvent(guestId, eventType, {
      timestamp: new Date().toISOString(),
      source: 'dashboard-simulation'
    });
  }

  /**
   * 分析客人履约模式
   */
  public async analyzeGuestPattern(guestId: string): Promise<void> {
    try {
      const guest = await rxdbManager.getGuestsCollection().findOne(guestId).exec();
      if (!guest) {
        alert('客人不存在');
        return;
      }

      const journeyId = `journey-${guestId}`;
      const analysis = this.eventTracker.analyzeEventPatterns(journeyId);
      const qualityScore = this.eventTracker.calculateQualityScore(journeyId);
      const anomalies = this.eventTracker.identifyAnomalies(journeyId);

      const analysisInfo = `
客人履约模式分析: ${guest.personalInfo.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 基础统计:
- 总事件数: ${analysis.totalEvents}
- 参与度评分: ${analysis.engagementScore.toFixed(1)}
- 质量评分: ${qualityScore.toFixed(1)}

📈 事件类型分布:
${Object.entries(analysis.eventTypes)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5)
  .map(([type, count]) => `- ${type}: ${count}次`)
  .join('\n')}

🎯 阶段分布:
${Object.entries(analysis.stageDistribution)
  .map(([stage, count]) => `- ${stage}: ${count}次`)
  .join('\n')}

💫 影响分析:
- 正面影响: +${analysis.impactAnalysis.positive}
- 负面影响: -${analysis.impactAnalysis.negative}
- 总影响: ${analysis.impactAnalysis.total > 0 ? '+' : ''}${analysis.impactAnalysis.total}

⚠️ 风险指标: ${analysis.riskIndicators.length > 0 ? analysis.riskIndicators.join(', ') : '无'}

🚨 异常检测: ${anomalies.length > 0 ? 
  anomalies.map(a => `${a.type}(${a.severity}): ${a.description}`).join('\n') 
  : '无异常'}
      `;

      alert(analysisInfo);
      this.addLogMessage(`📊 完成客人模式分析: ${guest.personalInfo.name}`);
    } catch (error) {
      console.error('分析客人模式失败:', error);
      this.addLogMessage(`❌ 分析失败: ${error.message}`);
    }
  }

  /**
   * 查看所有客人的事件总览
   */
  public async showEventOverview(): Promise<void> {
    try {
      const allEvents = this.eventTracker.exportEvents();
      const eventsByGuest = new Map<string, any[]>();
      
      allEvents.forEach(event => {
        if (!eventsByGuest.has(event.guestId)) {
          eventsByGuest.set(event.guestId, []);
        }
        eventsByGuest.get(event.guestId)?.push(event);
      });

      let overview = `
履约事件总览
━━━━━━━━━━━━━━━━━━━━━━

📊 总体统计:
- 总事件数: ${allEvents.length}
- 活跃客人数: ${eventsByGuest.size}
- 平均每客人事件: ${eventsByGuest.size > 0 ? (allEvents.length / eventsByGuest.size).toFixed(1) : 0}

👥 客人活跃度排行:
`;

      // 按事件数排序客人
      const guestActivity = Array.from(eventsByGuest.entries())
        .map(([guestId, events]) => ({
          guestId,
          eventCount: events.length,
          totalImpact: events.reduce((sum, e) => sum + e.impact, 0),
          latestEvent: events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
        }))
        .sort((a, b) => b.eventCount - a.eventCount)
        .slice(0, 10);

      for (const guest of guestActivity) {
        const guestDoc = await rxdbManager.getGuestsCollection().findOne(guest.guestId).exec();
        const guestName = guestDoc?.personalInfo.name || guest.guestId;
        overview += `${guestActivity.indexOf(guest) + 1}. ${guestName}: ${guest.eventCount}事件 (影响: ${guest.totalImpact > 0 ? '+' : ''}${guest.totalImpact})\n`;
      }

      alert(overview);
      this.addLogMessage('📊 显示事件总览');
    } catch (error) {
      console.error('获取事件总览失败:', error);
      this.addLogMessage(`❌ 获取总览失败: ${error.message}`);
    }
  }

  /**
   * 检测系统异常
   */
  public async detectSystemAnomalies(): Promise<void> {
    try {
      const allGuests = await this.getAllGuests();
      const anomaliesFound: any[] = [];

      for (const guest of allGuests) {
        const journeyId = `journey-${guest.id}`;
        const anomalies = this.eventTracker.identifyAnomalies(journeyId);
        
        if (anomalies.length > 0) {
          anomaliesFound.push({
            guestName: guest.personalInfo.name,
            guestId: guest.id,
            anomalies
          });
        }
      }

      if (anomaliesFound.length === 0) {
        alert('🎉 系统运行正常，未发现异常');
        this.addLogMessage('✅ 系统异常检测完成 - 无异常');
        return;
      }

      let anomalyReport = `
🚨 系统异常检测报告
━━━━━━━━━━━━━━━━━━━━━━

发现 ${anomaliesFound.length} 位客人存在异常:

`;

      anomaliesFound.forEach((item, index) => {
        anomalyReport += `${index + 1}. ${item.guestName}:\n`;
        item.anomalies.forEach((anomaly: any) => {
          const severityIcon = {
            low: '🟢',
            medium: '🟡', 
            high: '🔴'
          }[anomaly.severity];
          anomalyReport += `   ${severityIcon} ${anomaly.type}: ${anomaly.description}\n`;
        });
        anomalyReport += '\n';
      });

      alert(anomalyReport);
      this.addLogMessage(`🚨 检测到 ${anomaliesFound.length} 个异常客人`);
    } catch (error) {
      console.error('异常检测失败:', error);
      this.addLogMessage(`❌ 异常检测失败: ${error.message}`);
    }
  }

  /**
   * 模拟随机事件
   */
  public async simulateRandomEvent(): Promise<void> {
    const eventTypes = [
      'PAGE_VIEW', 'AD_CLICK', 'SEARCH_QUERY', 'DETAILS_VIEW', 
      'INQUIRY_SUBMIT', 'BOOKING_START', 'PAYMENT_SUCCESS', 
      'CHECK_IN', 'SERVICE_REQUEST', 'POSITIVE_FEEDBACK', 'REVIEW_SUBMIT'
    ];
    
    const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const guests = await this.getAllGuests();
    
    if (guests.length === 0) {
      this.addLogMessage('❌ 没有客人可以模拟事件');
      return;
    }
    
    const randomGuest = guests[Math.floor(Math.random() * guests.length)];
    await this.simulateEvent(randomGuest.id, randomEvent);
  }

  /**
   * 模拟认知阶段事件
   */
  public async simulateAwarenessEvent(): Promise<void> {
    const awarenessEvents = ['PAGE_VIEW', 'AD_CLICK', 'SEARCH_QUERY', 'SOCIAL_SHARE'];
    const randomEvent = awarenessEvents[Math.floor(Math.random() * awarenessEvents.length)];
    
    const guests = await this.getGuestsByStage('awareness');
    if (guests.length === 0) {
      this.addLogMessage('❌ 没有处于认知阶段的客人');
      return;
    }
    
    const randomGuest = guests[Math.floor(Math.random() * guests.length)];
    await this.simulateEvent(randomGuest.id, randomEvent);
  }

  /**
   * 模拟预订阶段事件
   */
  public async simulateBookingEvent(): Promise<void> {
    const bookingEvents = ['BOOKING_START', 'PAYMENT_INFO', 'PAYMENT_SUCCESS', 'BOOKING_CONFIRMED'];
    const randomEvent = bookingEvents[Math.floor(Math.random() * bookingEvents.length)];
    
    const guests = await this.getGuestsByStage('booking');
    if (guests.length === 0) {
      // 如果没有预订阶段的客人，创建一个演示客人
      await this.createDemoGuest('booking');
      const newGuests = await this.getGuestsByStage('booking');
      if (newGuests.length > 0) {
        await this.simulateEvent(newGuests[0].id, randomEvent);
      }
      return;
    }
    
    const randomGuest = guests[Math.floor(Math.random() * guests.length)];
    await this.simulateEvent(randomGuest.id, randomEvent);
  }

  /**
   * 模拟投诉事件
   */
  public async simulateComplaintEvent(): Promise<void> {
    const guests = await this.getGuestsByStage('experiencing');
    if (guests.length === 0) {
      this.addLogMessage('❌ 没有处于体验阶段的客人可以投诉');
      return;
    }
    
    const randomGuest = guests[Math.floor(Math.random() * guests.length)];
    await this.simulateEvent(randomGuest.id, 'COMPLAINT');
    
    // 同时触发投诉处理事件
    const actor = this.fulfillmentActors.get(randomGuest.id);
    if (actor) {
      actor.send({ type: 'COMPLAINT' });
    }
  }

  /**
   * 获取所有客人
   */
  private async getAllGuests(): Promise<any[]> {
    const guestsCollection = rxdbManager.getGuestsCollection();
    return await guestsCollection.find().exec();
  }

  /**
   * 按阶段获取客人
   */
  private async getGuestsByStage(stage: string): Promise<any[]> {
    const guestsCollection = rxdbManager.getGuestsCollection();
    return await guestsCollection.find({
      selector: {
        'fulfillmentHistory.currentStage': stage
      }
    }).exec();
  }

  /**
   * 创建演示客人
   */
  private async createDemoGuest(stage: string): Promise<void> {
    const guestsCollection = rxdbManager.getGuestsCollection();
    const stageNames = {
      awareness: '认知测试客人',
      evaluation: '评估测试客人', 
      booking: '预订测试客人',
      experiencing: '体验测试客人',
      feedback: '反馈测试客人'
    };
    
    const demoGuest = {
      id: `demo-${stage}-${Date.now()}`,
      personalInfo: {
        name: stageNames[stage] || `测试客人-${stage}`,
        phone: `138${String(Date.now()).slice(-8)}`,
        email: `demo-${stage}@example.com`,
        idCard: '',
        address: ''
      },
      fulfillmentHistory: {
        currentStage: stage,
        stageStartTime: new Date(),
        completedStages: [],
        journeyCount: 1
      },
      businessMetrics: {
        lifetimeValue: Math.random() * 1000,
        totalBookings: 0,
        averageRating: 0,
        referralCount: 0
      },
      tags: {
        loyaltyLevel: 'bronze',
        riskLevel: 'low',
        valueSegment: 'demo'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'demo-system',
      version: 1,
      isDeleted: false
    };

    await guestsCollection.insert(demoGuest);
    
    // 为新客人创建状态机
    await this.createFulfillmentActor(demoGuest);
    
    this.addLogMessage(`✅ 创建演示客人: ${demoGuest.personalInfo.name} (${stage}阶段)`);
    
    // 刷新界面
    await this.render();
  }

  /**
   * 筛选客人 - 按阶段
   */
  public async filterByStage(stage: string): Promise<void> {
    const guestsCollection = rxdbManager.getGuestsCollection();
    let guests;
    
    if (stage === '') {
      guests = await guestsCollection
        .find({ sort: [{ updatedAt: 'desc' }], limit: 20 })
        .exec();
    } else {
      guests = await guestsCollection
        .find({
          selector: { 'fulfillmentHistory.currentStage': stage },
          sort: [{ updatedAt: 'desc' }]
        })
        .exec();
    }
    
    const guestsList = document.getElementById('guests-list');
    if (guestsList) {
      guestsList.innerHTML = this.renderGuestsList(guests);
    }
    
    this.addLogMessage(`🔍 按阶段筛选: ${stage || '全部'} (${guests.length}位客人)`);
  }

  /**
   * 筛选客人 - 按忠诚度
   */
  public async filterByLoyalty(loyalty: string): Promise<void> {
    const guestsCollection = rxdbManager.getGuestsCollection();
    let guests;
    
    if (loyalty === '') {
      guests = await guestsCollection
        .find({ sort: [{ updatedAt: 'desc' }], limit: 20 })
        .exec();
    } else {
      guests = await guestsCollection
        .find({
          selector: { 'tags.loyaltyLevel': loyalty },
          sort: [{ updatedAt: 'desc' }]
        })
        .exec();
    }
    
    const guestsList = document.getElementById('guests-list');
    if (guestsList) {
      guestsList.innerHTML = this.renderGuestsList(guests);
    }
    
    this.addLogMessage(`🏆 按忠诚度筛选: ${loyalty || '全部'} (${guests.length}位客人)`);
  }

  /**
   * 查看客人详情
   */
  public async viewGuest(guestId: string): Promise<void> {
    try {
      const guestsCollection = rxdbManager.getGuestsCollection();
      const guest = await guestsCollection.findOne(guestId).exec();
      
      if (!guest) {
        alert('未找到客人信息');
        return;
      }
      
      const actor = this.fulfillmentActors.get(guestId);
      let stateInfo = '状态机未初始化';
      
      if (actor) {
        const snapshot = actor.getSnapshot();
        stateInfo = `当前状态: ${snapshot.value}\n质量评分: ${snapshot.context.qualityScore}\n事件历史: ${snapshot.context.eventHistory.length}条`;
      }
      
      const guestInfo = `
客人详情:
姓名: ${guest.personalInfo.name}
电话: ${guest.personalInfo.phone}
履约阶段: ${guest.fulfillmentHistory.currentStage}
忠诚度: ${guest.tags.loyaltyLevel}
生命价值: ¥${guest.businessMetrics.lifetimeValue.toFixed(2)}

状态机信息:
${stateInfo}
      `;
      
      alert(guestInfo);
      this.addLogMessage(`👁️ 查看客人详情: ${guest.personalInfo.name}`);
    } catch (error) {
      console.error('查看客人详情失败:', error);
      alert(`查看详情失败: ${error.message}`);
    }
  }

  /**
   * 创建演示数据
   */
  public async createDemoData(): Promise<void> {
    try {
      await rxdbManager.createDemoData();
      
      // 重新初始化状态机
      await this.initializeFulfillmentMachines();
      
      // 刷新界面
      await this.render();
      
      this.addLogMessage('✅ 演示数据创建完成');
    } catch (error) {
      console.error('创建演示数据失败:', error);
      this.addLogMessage(`❌ 创建演示数据失败: ${error.message}`);
    }
  }

  /**
   * 测试离线同步 - 使用完整的测试套件
   */
  public async testOfflineSync(): Promise<void> {
    if (!this.offlineTestSuite) {
      this.addLogMessage('❌ 离线测试套件未初始化');
      return;
    }

    this.addLogMessage('🧪 开始完整离线模式测试套件...');
    
    try {
      const testReport = await this.offlineTestSuite.runCompleteTestSuite();
      
      // 显示详细测试报告
      this.showOfflineTestReport(testReport);
      
      // 添加简要日志
      this.addLogMessage(`✅ 离线测试完成: ${testReport.passedTests}/${testReport.totalTests} 通过 (${((testReport.passedTests/testReport.totalTests)*100).toFixed(1)}%)`);
      
    } catch (error) {
      console.error('离线测试套件执行失败:', error);
      this.addLogMessage(`❌ 离线测试套件失败: ${error.message}`);
    }
  }

  /**
   * 显示离线测试报告
   */
  private showOfflineTestReport(report: OfflineTestReport): void {
    const successRate = ((report.passedTests / report.totalTests) * 100).toFixed(1);
    const averageTime = (report.duration / report.totalTests).toFixed(1);
    
    let reportText = `
🧪 离线模式测试报告
━━━━━━━━━━━━━━━━━━━━━━━━

📊 总体概况:
- 测试总数: ${report.totalTests}
- 通过测试: ${report.passedTests} ✅
- 失败测试: ${report.failedTests} ❌
- 成功率: ${successRate}%
- 总耗时: ${(report.duration/1000).toFixed(1)}秒
- 平均耗时: ${averageTime}ms/测试

📋 测试详情:
`;

    // 按成功/失败分组显示结果
    const passedTests = report.results.filter(r => r.success);
    const failedTests = report.results.filter(r => !r.success);

    if (passedTests.length > 0) {
      reportText += '\n✅ 通过的测试:\n';
      passedTests.forEach(test => {
        reportText += `• ${test.testName}: ${test.message} (${test.duration.toFixed(1)}ms)\n`;
      });
    }

    if (failedTests.length > 0) {
      reportText += '\n❌ 失败的测试:\n';
      failedTests.forEach(test => {
        reportText += `• ${test.testName}: ${test.message}\n`;
      });
    }

    if (report.recommendations.length > 0) {
      reportText += '\n💡 建议:\n';
      report.recommendations.forEach(rec => {
        reportText += `• ${rec}\n`;
      });
    }

    reportText += `\n📈 ${report.summary}`;

    alert(reportText);
  }

  /**
   * 测试冲突解决
   */
  public async testConflictResolution(): Promise<void> {
    this.addLogMessage('⚖️ 开始冲突解决测试...');
    
    try {
      const guests = await this.getAllGuests();
      if (guests.length === 0) {
        this.addLogMessage('❌ 没有客人可以测试冲突解决');
        return;
      }
      
      const testGuest = guests[0];
      
      // 模拟并发修改
      const guestsCollection = rxdbManager.getGuestsCollection();
      const guestDoc1 = await guestsCollection.findOne(testGuest.id).exec();
      const guestDoc2 = await guestsCollection.findOne(testGuest.id).exec();
      
      if (guestDoc1 && guestDoc2) {
        // 模拟两个不同的修改
        await guestDoc1.patch({
          businessMetrics: {
            ...guestDoc1.businessMetrics,
            lifetimeValue: guestDoc1.businessMetrics.lifetimeValue + 100
          }
        });
        
        await guestDoc2.patch({
          businessMetrics: {
            ...guestDoc2.businessMetrics,
            totalBookings: guestDoc2.businessMetrics.totalBookings + 1
          }
        });
        
        this.addLogMessage('✅ 模拟冲突修改完成，RxDB会自动处理冲突');
      }
      
    } catch (error) {
      this.addLogMessage(`❌ 冲突测试失败: ${error.message}`);
    }
  }

  /**
   * 模拟多设备同步
   */
  public async simulateMultiDevice(): Promise<void> {
    this.addLogMessage('💻 开始多设备同步测试...');
    
    try {
      // 模拟来自另一个设备的数据变更
      const guests = await this.getAllGuests();
      if (guests.length === 0) {
        this.addLogMessage('❌ 没有客人可以测试多设备同步');
        return;
      }
      
      const testGuest = guests[Math.floor(Math.random() * guests.length)];
      
      // 模拟外部设备的数据修改
      const guestsCollection = rxdbManager.getGuestsCollection();
      await guestsCollection.findOne(testGuest.id).exec().then(doc => {
        if (doc) {
          return doc.patch({
            businessMetrics: {
              ...doc.businessMetrics,
              lifetimeValue: doc.businessMetrics.lifetimeValue + Math.random() * 50,
              totalBookings: doc.businessMetrics.totalBookings + 1
            },
            updatedAt: new Date().toISOString()
          });
        }
      });
      
      this.addLogMessage(`✅ 模拟设备B修改客人数据: ${testGuest.personalInfo.name}`);
      
      // 触发UI更新
      await this.render();
      
    } catch (error) {
      this.addLogMessage(`❌ 多设备同步测试失败: ${error.message}`);
    }
  }

  /**
   * 导出事件数据
   */
  public async exportEventData(): Promise<void> {
    try {
      const allEvents = this.eventTracker.exportEvents();
      
      if (allEvents.length === 0) {
        alert('暂无事件数据可导出');
        return;
      }

      // 生成CSV格式的数据
      const csvHeaders = ['事件ID', '客人ID', '事件类型', '阶段', '时间戳', '影响分数', '来源'];
      const csvRows = allEvents.map(event => [
        event.id,
        event.guestId,
        event.type,
        event.stage,
        event.timestamp.toISOString(),
        event.impact.toString(),
        event.source || 'unknown'
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      // 创建下载链接
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `履约事件数据_${new Date().toISOString().split('T')[0]}.csv`;
      
      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.addLogMessage(`📋 导出 ${allEvents.length} 条事件数据到CSV文件`);
    } catch (error) {
      console.error('导出事件数据失败:', error);
      this.addLogMessage(`❌ 导出失败: ${error.message}`);
    }
  }

  /**
   * 生成性能报告
   */
  public async generatePerformanceReport(): Promise<void> {
    if (!this.performanceMonitor) {
      this.addLogMessage('❌ 性能监控服务未初始化');
      return;
    }

    try {
      const report = this.performanceMonitor.generatePerformanceReport(24); // 24小时报告
      this.performanceReport = report;
      this.updatePerformanceDisplay();

      const reportSummary = `
📊 性能报告摘要 (24小时):
━━━━━━━━━━━━━━━━━━━━━
⚡ 平均响应时间: ${report.summary.averageResponseTime.toFixed(1)}ms
🔄 总操作数: ${report.summary.totalOperations}
📈 吞吐量: ${report.summary.throughput.toFixed(1)} ops/s
❌ 错误率: ${(report.summary.errorRate * 100).toFixed(2)}%

🏆 最慢操作前3名:
${report.topSlowOperations.slice(0, 3).map((op, i) => 
  `${i + 1}. ${op.operation}: ${op.avgTime.toFixed(1)}ms (${op.count}次)`
).join('\n')}

💚 系统健康: ${report.health.overall} (${report.health.score}分)
━━━━━━━━━━━━━━━━━━━━━
      `;

      alert(reportSummary);
      this.addLogMessage('📊 性能报告已生成');
    } catch (error) {
      console.error('生成性能报告失败:', error);
      this.addLogMessage(`❌ 生成性能报告失败: ${error.message}`);
    }
  }

  /**
   * 查看基准测试数据
   */
  public async showBenchmarkData(): Promise<void> {
    if (!this.performanceMonitor) {
      this.addLogMessage('❌ 性能监控服务未初始化');
      return;
    }

    try {
      const benchmarks = this.performanceMonitor.getCurrentBenchmarks();
      
      if (benchmarks.length === 0) {
        alert('暂无基准测试数据');
        return;
      }

      const benchmarkData = benchmarks
        .sort((a, b) => b.averageTime - a.averageTime)
        .slice(0, 10) // 显示前10个
        .map((benchmark, index) => 
          `${index + 1}. ${benchmark.operation}\n` +
          `   平均时间: ${benchmark.averageTime.toFixed(2)}ms\n` +
          `   最小/最大: ${benchmark.minTime.toFixed(2)}/${benchmark.maxTime.toFixed(2)}ms\n` +
          `   执行次数: ${benchmark.count}\n` +
          `   错误率: ${(benchmark.errorRate * 100).toFixed(2)}%\n`
        ).join('\n');

      const benchmarkReport = `
🏁 基准测试数据 (前10个最慢操作):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${benchmarkData}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `;

      alert(benchmarkReport);
      this.addLogMessage('🏁 基准测试数据已显示');
    } catch (error) {
      console.error('显示基准测试数据失败:', error);
      this.addLogMessage(`❌ 显示基准测试数据失败: ${error.message}`);
    }
  }

  /**
   * 运行性能测试
   */
  public async runPerformanceTest(): Promise<void> {
    if (!this.performanceMonitor) {
      this.addLogMessage('❌ 性能监控服务未初始化');
      return;
    }

    this.addLogMessage('🧪 开始运行性能测试...');

    try {
      const guestsCollection = rxdbManager.getGuestsCollection();
      const testResults = [];

      // 测试1: 数据库查询性能
      this.performanceMonitor.startMeasurement('perf-test-query', 'database', 'performance-test-query');
      const queryStart = performance.now();
      await guestsCollection.find({ limit: 100 }).exec();
      const queryTime = performance.now() - queryStart;
      this.performanceMonitor.endMeasurement('perf-test-query', true);
      testResults.push(`查询100条记录: ${queryTime.toFixed(2)}ms`);

      // 测试2: 批量插入性能
      this.performanceMonitor.startMeasurement('perf-test-insert', 'database', 'performance-test-insert');
      const insertStart = performance.now();
      
      const testGuests = [];
      for (let i = 0; i < 10; i++) {
        const guest = {
          id: `perf-test-${Date.now()}-${i}`,
          personalInfo: {
            name: `性能测试客人${i}`,
            phone: `1380000000${i}`,
            email: `perftest${i}@example.com`,
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
            lifetimeValue: Math.random() * 1000,
            totalBookings: Math.floor(Math.random() * 5),
            averageRating: 3 + Math.random() * 2,
            referralCount: 0
          },
          tags: {
            loyaltyLevel: 'bronze',
            riskLevel: 'low',
            valueSegment: 'test'
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'performance-test',
          version: 1,
          isDeleted: false
        };
        
        await guestsCollection.insert(guest);
        testGuests.push(guest);
      }
      
      const insertTime = performance.now() - insertStart;
      this.performanceMonitor.endMeasurement('perf-test-insert', true);
      testResults.push(`插入10条记录: ${insertTime.toFixed(2)}ms (${(insertTime/10).toFixed(2)}ms/条)`);

      // 测试3: 事件处理性能
      this.performanceMonitor.startMeasurement('perf-test-events', 'fulfillment', 'performance-test-events');
      const eventStart = performance.now();
      
      for (const guest of testGuests.slice(0, 5)) {
        await this.recordFulfillmentEvent(guest.id, 'PAGE_VIEW', { performance: 'test' });
      }
      
      const eventTime = performance.now() - eventStart;
      this.performanceMonitor.endMeasurement('perf-test-events', true);
      testResults.push(`处理5个事件: ${eventTime.toFixed(2)}ms (${(eventTime/5).toFixed(2)}ms/个)`);

      // 清理测试数据
      for (const guest of testGuests) {
        const doc = await guestsCollection.findOne(guest.id).exec();
        if (doc) await doc.remove();
      }

      const testReport = `
🧪 性能测试结果:
━━━━━━━━━━━━━━━━━━━━━━
${testResults.map((result, index) => `${index + 1}. ${result}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━

✅ 性能测试完成，已清理测试数据
      `;

      alert(testReport);
      this.addLogMessage('✅ 性能测试完成');
    } catch (error) {
      console.error('运行性能测试失败:', error);
      this.addLogMessage(`❌ 性能测试失败: ${error.message}`);
    }
  }

  /**
   * 重置性能监控数据
   */
  public async resetPerformanceData(): Promise<void> {
    if (!this.performanceMonitor) {
      this.addLogMessage('❌ 性能监控服务未初始化');
      return;
    }

    try {
      this.performanceMonitor.resetPerformanceData();
      this.performanceReport = null;
      this.systemHealth = null;
      
      // 清空显示
      const metricsElement = document.getElementById('performance-metrics');
      if (metricsElement) {
        metricsElement.innerHTML = '<div class="no-data">性能数据已重置</div>';
      }
      
      const chartsElement = document.getElementById('performance-charts');
      if (chartsElement) {
        chartsElement.innerHTML = '<div class="no-data">图表数据已清空</div>';
      }

      alert('📊 性能监控数据已重置');
      this.addLogMessage('📊 性能监控数据已重置');
    } catch (error) {
      console.error('重置性能数据失败:', error);
      this.addLogMessage(`❌ 重置性能数据失败: ${error.message}`);
    }
  }

  /**
   * 显示系统健康检查
   */
  public async showSystemHealth(): Promise<void> {
    if (!this.systemHealth) {
      this.addLogMessage('⏳ 系统健康数据尚未加载，请稍等...');
      return;
    }

    try {
      const healthReport = `
💚 系统健康检查报告:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 总体状况: ${this.systemHealth.overall} (${this.systemHealth.score}/100分)
⏰ 运行时间: ${Math.floor(this.systemHealth.uptime / 1000 / 60)} 分钟
🕒 最后检查: ${this.systemHealth.lastCheck.toLocaleString()}

${this.systemHealth.issues.length > 0 ? `
⚠️ 发现的问题:
${this.systemHealth.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}
` : '✅ 未发现问题'}

💡 建议:
${this.systemHealth.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `;

      alert(healthReport);
      this.addLogMessage('💚 系统健康检查已显示');
    } catch (error) {
      console.error('显示系统健康检查失败:', error);
      this.addLogMessage(`❌ 显示系统健康检查失败: ${error.message}`);
    }
  }

  /**
   * 导出性能数据
   */
  public async exportPerformanceData(): Promise<void> {
    if (!this.performanceReport || !this.performanceMonitor) {
      this.addLogMessage('❌ 暂无性能数据可导出');
      return;
    }

    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        report: this.performanceReport,
        benchmarks: this.performanceMonitor.getCurrentBenchmarks(),
        systemHealth: this.systemHealth
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `performance-data-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.addLogMessage('📤 性能数据已导出');
    } catch (error) {
      console.error('导出性能数据失败:', error);
      this.addLogMessage(`❌ 导出性能数据失败: ${error.message}`);
    }
  }

  /**
   * 清理资源
   */
  public async cleanup(): Promise<void> {
    this.stopAutoUpdate();
    
    // 清理性能监控服务
    if (this.performanceMonitor) {
      try {
        this.performanceMonitor.cleanup();
        this.addLogMessage('🧹 性能监控服务已清理');
      } catch (error) {
        console.warn('清理性能监控服务失败:', error);
      }
    }
    
    // 清理实时同步服务
    if (this.realtimeSyncService) {
      try {
        await this.realtimeSyncService.cleanup();
        this.addLogMessage('🧹 实时同步服务已清理');
      } catch (error) {
        console.warn('清理实时同步服务失败:', error);
      }
    }
    
    // 清理同步管理器
    if (this.syncManager) {
      try {
        await this.syncManager.stopAllSync();
        this.addLogMessage('🧹 同步管理器已清理');
      } catch (error) {
        console.warn('清理同步管理器失败:', error);
      }
    }
    
    // 清理所有状态机Actor
    for (const [guestId, actor] of this.fulfillmentActors) {
      try {
        actor.stop();
      } catch (error) {
        console.warn(`清理状态机失败 (${guestId}):`, error);
      }
    }
    
    this.fulfillmentActors.clear();
    this.addLogMessage('🧹 所有资源清理完成');
  }
}

// 全局实例
declare global {
  interface Window {
    fulfillmentDashboard: FulfillmentDashboard;
  }
}