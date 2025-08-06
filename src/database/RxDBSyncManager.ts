/**
 * RxDB 同步管理器
 * 负责管理与后端 PouchDB Server 的数据同步
 */

import { RxDatabase, RxCollection } from 'rxdb';
import { RxDBReplicationCouchDBPlugin } from 'rxdb/plugins/replication-couchdb';
import { addRxPlugin } from 'rxdb';

// 添加 CouchDB 同步插件
addRxPlugin(RxDBReplicationCouchDBPlugin);

export interface SyncConfig {
  backendUrl: string;
  collections: string[];
  batchSize?: number;
  live?: boolean;
  retry?: boolean;
}

export interface SyncStatus {
  collection: string;
  active: boolean;
  lastSync?: Date;
  pendingChanges: number;
  error?: string;
}

export class RxDBSyncManager {
  private database: RxDatabase;
  private syncHandlers: Map<string, any> = new Map();
  private syncConfig: SyncConfig;
  private authToken?: string;

  constructor(database: RxDatabase, config: SyncConfig) {
    this.database = database;
    this.syncConfig = {
      batchSize: 10,
      live: true,
      retry: true,
      ...config
    };
  }

  /**
   * 设置认证令牌
   */
  public setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * 启动指定集合的同步
   */
  public async startSync(collectionName: string): Promise<void> {
    const collection = this.database.collections[collectionName];
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    // 停止现有同步
    await this.stopSync(collectionName);

    // 构建同步 URL
    const syncUrl = `${this.syncConfig.backendUrl}/db/${collectionName}`;

    // 创建同步处理器
    const replicationState = await collection.syncCouchDB({
      remote: syncUrl,
      options: {
        live: this.syncConfig.live,
        retry: this.syncConfig.retry,
        batch_size: this.syncConfig.batchSize,
        headers: this.authToken ? {
          'Authorization': `Bearer ${this.authToken}`
        } : undefined
      }
    });

    // 监听同步事件
    replicationState.change$.subscribe(change => {
      console.log(`[Sync] ${collectionName} - 变更:`, change);
    });

    replicationState.docs$.subscribe(docData => {
      console.log(`[Sync] ${collectionName} - 文档同步:`, docData);
    });

    replicationState.denied$.subscribe(docData => {
      console.error(`[Sync] ${collectionName} - 同步被拒绝:`, docData);
    });

    replicationState.active$.subscribe(active => {
      console.log(`[Sync] ${collectionName} - 同步状态:`, active ? '活跃' : '空闲');
    });

    replicationState.complete$.subscribe(completed => {
      console.log(`[Sync] ${collectionName} - 同步完成:`, completed);
    });

    replicationState.error$.subscribe(error => {
      console.error(`[Sync] ${collectionName} - 同步错误:`, error);
    });

    // 保存同步处理器
    this.syncHandlers.set(collectionName, replicationState);

    console.log(`[Sync] 已启动 ${collectionName} 集合的同步`);
  }

  /**
   * 停止指定集合的同步
   */
  public async stopSync(collectionName: string): Promise<void> {
    const handler = this.syncHandlers.get(collectionName);
    if (handler) {
      await handler.cancel();
      this.syncHandlers.delete(collectionName);
      console.log(`[Sync] 已停止 ${collectionName} 集合的同步`);
    }
  }

  /**
   * 启动所有配置的集合同步
   */
  public async startAllSync(): Promise<void> {
    for (const collectionName of this.syncConfig.collections) {
      try {
        await this.startSync(collectionName);
      } catch (error) {
        console.error(`[Sync] 启动 ${collectionName} 同步失败:`, error);
      }
    }
  }

  /**
   * 停止所有同步
   */
  public async stopAllSync(): Promise<void> {
    for (const [collectionName, _] of this.syncHandlers) {
      await this.stopSync(collectionName);
    }
  }

  /**
   * 获取同步状态
   */
  public getSyncStatus(): SyncStatus[] {
    const statuses: SyncStatus[] = [];

    for (const collectionName of this.syncConfig.collections) {
      const handler = this.syncHandlers.get(collectionName);
      const collection = this.database.collections[collectionName];

      statuses.push({
        collection: collectionName,
        active: !!handler && handler.active,
        pendingChanges: collection ? collection.count.exec() : 0,
        lastSync: handler?.lastSync,
        error: handler?.error
      });
    }

    return statuses;
  }

  /**
   * 执行一次性同步（拉取）
   */
  public async pullOnce(collectionName: string): Promise<void> {
    const collection = this.database.collections[collectionName];
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    const syncUrl = `${this.syncConfig.backendUrl}/db/${collectionName}`;
    
    const replicationState = await collection.syncCouchDB({
      remote: syncUrl,
      options: {
        live: false,
        retry: false,
        headers: this.authToken ? {
          'Authorization': `Bearer ${this.authToken}`
        } : undefined
      },
      pull: {},
      push: undefined // 只拉取，不推送
    });

    return new Promise((resolve, reject) => {
      replicationState.complete$.subscribe({
        next: () => resolve(),
        error: (err) => reject(err)
      });
    });
  }

  /**
   * 执行一次性同步（推送）
   */
  public async pushOnce(collectionName: string): Promise<void> {
    const collection = this.database.collections[collectionName];
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    const syncUrl = `${this.syncConfig.backendUrl}/db/${collectionName}`;
    
    const replicationState = await collection.syncCouchDB({
      remote: syncUrl,
      options: {
        live: false,
        retry: false,
        headers: this.authToken ? {
          'Authorization': `Bearer ${this.authToken}`
        } : undefined
      },
      pull: undefined, // 不拉取，只推送
      push: {}
    });

    return new Promise((resolve, reject) => {
      replicationState.complete$.subscribe({
        next: () => resolve(),
        error: (err) => reject(err)
      });
    });
  }

  /**
   * 检查同步健康状态
   */
  public async checkSyncHealth(): Promise<{
    healthy: boolean;
    message: string;
    details: any;
  }> {
    try {
      const response = await fetch(`${this.syncConfig.backendUrl}/api/sync/status`, {
        headers: this.authToken ? {
          'Authorization': `Bearer ${this.authToken}`
        } : undefined
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      return {
        healthy: true,
        message: '同步服务正常',
        details: data
      };
    } catch (error) {
      return {
        healthy: false,
        message: '同步服务不可用',
        details: { error: error.message }
      };
    }
  }

  /**
   * 处理冲突解决
   */
  public setConflictHandler(
    collectionName: string, 
    handler: (conflict: any) => any
  ): void {
    const collection = this.database.collections[collectionName];
    if (collection) {
      // RxDB 会自动处理冲突，但我们可以添加自定义逻辑
      collection.conflictHandler = handler;
    }
  }
}