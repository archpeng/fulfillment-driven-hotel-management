/**
 * 实时数据同步服务
 * 基于履约驱动架构的智能同步管理
 */

import { RxDatabase } from 'rxdb';
import { RxDBSyncManager, SyncConfig } from './RxDBSyncManager';
import { Subject, BehaviorSubject, timer, fromEvent, from } from 'rxjs';
import { debounceTime, distinctUntilChanged, retry, catchError } from 'rxjs/operators';

export interface RealtimeSyncConfig extends SyncConfig {
  // 网络监控配置
  networkMonitoring: boolean;
  reconnectInterval: number; // 重连间隔(ms)
  maxRetries: number;
  
  // 性能配置
  syncThrottleMs: number; // 同步节流时间
  batchSizeAdaptive: boolean; // 自适应批量大小
  
  // 冲突解决策略
  conflictResolution: 'last-write-wins' | 'manual' | 'merge';
  
  // 离线支持
  offlineQueueEnabled: boolean;
  maxOfflineActions: number;
}

export interface SyncMetrics {
  totalSyncs: number;
  successRate: number;
  averageLatency: number;
  conflictsResolved: number;
  bytesTransferred: number;
  lastSyncTimestamp: Date;
  networkStatus: 'online' | 'offline' | 'unstable';
}

export interface SyncEvent {
  type: 'sync-start' | 'sync-complete' | 'sync-error' | 'conflict-resolved' | 'network-change' | 'offline-queue-action';
  timestamp: Date;
  collectionName?: string;
  data?: any;
  error?: string;
  metrics?: Partial<SyncMetrics>;
}

export class RealtimeSyncService {
  private database: RxDatabase;
  private syncManager: RxDBSyncManager;
  private config: RealtimeSyncConfig;
  
  // 状态管理
  private isOnline$ = new BehaviorSubject<boolean>(navigator.onLine);
  private syncStatus$ = new BehaviorSubject<'idle' | 'syncing' | 'error' | 'offline'>('idle');
  private syncEvents$ = new Subject<SyncEvent>();
  
  // 同步指标
  private metrics: SyncMetrics = {
    totalSyncs: 0,
    successRate: 100,
    averageLatency: 0,
    conflictsResolved: 0,
    bytesTransferred: 0,
    lastSyncTimestamp: new Date(),
    networkStatus: 'online'
  };
  
  // 离线队列
  private offlineQueue: Array<{
    id: string;
    action: 'create' | 'update' | 'delete';
    collection: string;
    data: any;
    timestamp: Date;
  }> = [];
  
  // 性能监控
  private latencyHistory: number[] = [];
  private syncStartTime: number = 0;
  
  constructor(database: RxDatabase, config: RealtimeSyncConfig) {
    this.database = database;
    this.config = {
      networkMonitoring: true,
      reconnectInterval: 5000,
      maxRetries: 3,
      syncThrottleMs: 1000,
      batchSizeAdaptive: true,
      conflictResolution: 'last-write-wins',
      offlineQueueEnabled: true,
      maxOfflineActions: 1000,
      ...config
    };
    
    this.syncManager = new RxDBSyncManager(database, config);
    
    this.initializeNetworkMonitoring();
    this.initializeAdaptiveSync();
    this.initializeOfflineQueue();
  }

  /**
   * 初始化网络监控
   */
  private initializeNetworkMonitoring(): void {
    if (!this.config.networkMonitoring) return;
    
    // 监听网络状态变化
    fromEvent(window, 'online').subscribe(() => {
      this.isOnline$.next(true);
      this.metrics.networkStatus = 'online';
      this.handleNetworkStateChange('online');
    });
    
    fromEvent(window, 'offline').subscribe(() => {
      this.isOnline$.next(false);
      this.metrics.networkStatus = 'offline';
      this.handleNetworkStateChange('offline');
    });
    
    // 定期检测网络质量
    timer(0, 30000).subscribe(async () => {
      await this.checkNetworkQuality();
    });
  }

  /**
   * 处理网络状态变化
   */
  private handleNetworkStateChange(status: 'online' | 'offline'): void {
    const event: SyncEvent = {
      type: 'network-change',
      timestamp: new Date(),
      data: { status, previousStatus: this.metrics.networkStatus }
    };
    
    this.syncEvents$.next(event);
    
    if (status === 'online') {
      // 网络恢复，开始同步离线队列
      this.processOfflineQueue();
      this.startRealtimeSync();
    } else {
      // 网络断开，停止同步
      this.syncStatus$.next('offline');
    }
    
    console.log(`🌐 网络状态变化: ${status}`);
  }

  /**
   * 检查网络质量
   */
  private async checkNetworkQuality(): Promise<void> {
    if (!navigator.onLine) return;
    
    try {
      const startTime = performance.now();
      const response = await fetch(`${this.config.backendUrl}/health?t=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store'
      });
      const latency = performance.now() - startTime;
      
      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > 10) {
        this.latencyHistory.shift();
      }
      
      this.metrics.averageLatency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
      
      // 判断网络质量
      if (latency > 5000 || !response.ok) {
        this.metrics.networkStatus = 'unstable';
      } else {
        this.metrics.networkStatus = 'online';
      }
      
    } catch (error) {
      this.metrics.networkStatus = 'unstable';
      console.warn('网络质量检测失败:', error);
    }
  }

  /**
   * 初始化自适应同步
   */
  private initializeAdaptiveSync(): void {
    // 监听数据变化，节流处理同步
    this.database.collections.guests?.$.pipe(
      debounceTime(this.config.syncThrottleMs),
      distinctUntilChanged()
    ).subscribe(() => {
      if (this.isOnline$.value && this.syncStatus$.value !== 'syncing') {
        this.triggerSmartSync('guests');
      }
    });
  }

  /**
   * 智能同步触发
   */
  private async triggerSmartSync(collectionName: string): Promise<void> {
    if (this.syncStatus$.value === 'syncing') {
      return; // 避免重复同步
    }
    
    this.syncStatus$.next('syncing');
    this.syncStartTime = performance.now();
    
    const event: SyncEvent = {
      type: 'sync-start',
      timestamp: new Date(),
      collectionName
    };
    this.syncEvents$.next(event);
    
    try {
      // 自适应批量大小
      if (this.config.batchSizeAdaptive) {
        this.adaptBatchSize();
      }
      
      // 执行同步
      await this.syncManager.startSync(collectionName);
      
      // 更新指标
      this.updateSyncMetrics(true);
      
      const completeEvent: SyncEvent = {
        type: 'sync-complete',
        timestamp: new Date(),
        collectionName,
        metrics: { ...this.metrics }
      };
      this.syncEvents$.next(completeEvent);
      
      this.syncStatus$.next('idle');
      
    } catch (error) {
      this.updateSyncMetrics(false);
      
      const errorEvent: SyncEvent = {
        type: 'sync-error',
        timestamp: new Date(),
        collectionName,
        error: error.message
      };
      this.syncEvents$.next(errorEvent);
      
      this.syncStatus$.next('error');
      
      // 自动重试
      await this.scheduleRetry(collectionName);
    }
  }

  /**
   * 自适应批量大小
   */
  private adaptBatchSize(): void {
    const avgLatency = this.metrics.averageLatency;
    let optimalBatchSize = this.config.batchSize || 10;
    
    if (avgLatency < 100) {
      // 网络良好，增加批量大小
      optimalBatchSize = Math.min(50, optimalBatchSize * 2);
    } else if (avgLatency > 1000) {
      // 网络较差，减少批量大小
      optimalBatchSize = Math.max(5, Math.floor(optimalBatchSize / 2));
    }
    
    // 更新配置
    this.syncManager = new RxDBSyncManager(this.database, {
      ...this.config,
      batchSize: optimalBatchSize
    });
    
    console.log(`📊 自适应批量大小调整: ${optimalBatchSize} (延迟: ${avgLatency.toFixed(0)}ms)`);
  }

  /**
   * 更新同步指标
   */
  private updateSyncMetrics(success: boolean): void {
    const latency = performance.now() - this.syncStartTime;
    
    this.metrics.totalSyncs++;
    this.metrics.lastSyncTimestamp = new Date();
    
    if (success) {
      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > 20) {
        this.latencyHistory.shift();
      }
      this.metrics.averageLatency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
    }
    
    // 计算成功率
    const recentSyncs = Math.min(this.metrics.totalSyncs, 10);
    this.metrics.successRate = (this.metrics.successRate * (recentSyncs - 1) + (success ? 100 : 0)) / recentSyncs;
  }

  /**
   * 计划重试
   */
  private async scheduleRetry(collectionName: string, retryCount: number = 0): Promise<void> {
    if (retryCount >= this.config.maxRetries) {
      console.error(`❌ 同步重试次数超限: ${collectionName}`);
      return;
    }
    
    const delay = this.config.reconnectInterval * Math.pow(2, retryCount); // 指数退避
    
    setTimeout(async () => {
      console.log(`🔄 重试同步: ${collectionName} (第${retryCount + 1}次)`);
      try {
        await this.triggerSmartSync(collectionName);
      } catch (error) {
        await this.scheduleRetry(collectionName, retryCount + 1);
      }
    }, delay);
  }

  /**
   * 初始化离线队列
   */
  private initializeOfflineQueue(): void {
    if (!this.config.offlineQueueEnabled) return;
    
    // 监听数据变化，离线时加入队列
    this.database.collections.guests?.$.subscribe((changeEvent) => {
      if (!this.isOnline$.value && changeEvent.operation !== 'FIND') {
        this.addToOfflineQueue(changeEvent);
      }
    });
  }

  /**
   * 添加到离线队列
   */
  private addToOfflineQueue(changeEvent: any): void {
    if (this.offlineQueue.length >= this.config.maxOfflineActions) {
      this.offlineQueue.shift(); // 移除最老的操作
    }
    
    const action = {
      id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action: changeEvent.operation.toLowerCase() as 'create' | 'update' | 'delete',
      collection: changeEvent.collectionName,
      data: changeEvent.documentData,
      timestamp: new Date()
    };
    
    this.offlineQueue.push(action);
    
    const event: SyncEvent = {
      type: 'offline-queue-action',
      timestamp: new Date(),
      data: action
    };
    this.syncEvents$.next(event);
    
    console.log(`📥 离线操作入队: ${action.action} - ${action.collection}`);
  }

  /**
   * 处理离线队列
   */
  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;
    
    console.log(`🔄 开始处理离线队列 (${this.offlineQueue.length} 个操作)`);
    
    const processingQueue = [...this.offlineQueue];
    this.offlineQueue = [];
    
    for (const action of processingQueue) {
      try {
        await this.syncManager.pushOnce(action.collection);
        console.log(`✅ 离线操作同步成功: ${action.id}`);
      } catch (error) {
        console.error(`❌ 离线操作同步失败: ${action.id}`, error);
        // 重新加入队列
        this.offlineQueue.push(action);
      }
    }
  }

  /**
   * 启动实时同步
   */
  public async startRealtimeSync(): Promise<void> {
    try {
      await this.syncManager.startAllSync();
      console.log('🚀 实时同步已启动');
    } catch (error) {
      console.error('❌ 启动实时同步失败:', error);
      throw error;
    }
  }

  /**
   * 停止实时同步
   */
  public async stopRealtimeSync(): Promise<void> {
    await this.syncManager.stopAllSync();
    console.log('⏹️ 实时同步已停止');
  }

  /**
   * 强制同步所有数据
   */
  public async forceSyncAll(): Promise<void> {
    this.syncStatus$.next('syncing');
    
    try {
      for (const collection of this.config.collections) {
        await this.triggerSmartSync(collection);
      }
      console.log('✅ 强制同步完成');
    } catch (error) {
      console.error('❌ 强制同步失败:', error);
      throw error;
    }
  }

  /**
   * 获取实时同步指标
   */
  public getSyncMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取同步状态流
   */
  public getSyncStatus$() {
    return this.syncStatus$.asObservable();
  }

  /**
   * 获取同步事件流
   */
  public getSyncEvents$() {
    return this.syncEvents$.asObservable();
  }

  /**
   * 获取网络状态流
   */
  public getNetworkStatus$() {
    return this.isOnline$.asObservable();
  }

  /**
   * 获取离线队列状态
   */
  public getOfflineQueueStatus() {
    return {
      queueLength: this.offlineQueue.length,
      maxQueueSize: this.config.maxOfflineActions,
      oldestAction: this.offlineQueue[0]?.timestamp,
      newestAction: this.offlineQueue[this.offlineQueue.length - 1]?.timestamp
    };
  }

  /**
   * 设置冲突解决策略
   */
  public setConflictResolution(strategy: 'last-write-wins' | 'manual' | 'merge'): void {
    this.config.conflictResolution = strategy;
    
    // 为所有集合设置冲突处理器
    for (const collectionName of this.config.collections) {
      this.syncManager.setConflictHandler(collectionName, (conflict) => {
        return this.resolveConflict(conflict, strategy);
      });
    }
  }

  /**
   * 解决冲突
   */
  private resolveConflict(conflict: any, strategy: string): any {
    this.metrics.conflictsResolved++;
    
    const event: SyncEvent = {
      type: 'conflict-resolved',
      timestamp: new Date(),
      data: { strategy, conflict: conflict.id }
    };
    this.syncEvents$.next(event);
    
    switch (strategy) {
      case 'last-write-wins':
        return conflict.newDocumentState;
      
      case 'merge':
        // 简单合并策略：合并非冲突字段
        return {
          ...conflict.oldDocumentState,
          ...conflict.newDocumentState,
          updatedAt: new Date().toISOString(),
          version: (conflict.oldDocumentState.version || 0) + 1
        };
      
      case 'manual':
      default:
        // 手动处理，这里返回新状态，实际应用中可以弹出UI让用户选择
        console.warn('需要手动解决冲突:', conflict);
        return conflict.newDocumentState;
    }
  }

  /**
   * 清理资源
   */
  public async cleanup(): Promise<void> {
    await this.stopRealtimeSync();
    this.syncEvents$.complete();
    this.syncStatus$.complete();
    this.isOnline$.complete();
  }
}