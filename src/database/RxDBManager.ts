/**
 * RxDB 数据库管理器
 * 初始化和管理 RxDB 数据库实例
 */

import { createRxDatabase, addRxPlugin, RxDatabase } from 'rxdb';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';

// 导入 Schema
import { guestSchema } from './schemas/guest.schema';
import type { GuestDocType } from './schemas/guest.schema';

// 添加必需插件
if (import.meta.env.DEV) {
  addRxPlugin(RxDBDevModePlugin);
}
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBQueryBuilderPlugin);

export interface DatabaseCollections {
  guests: any;
  fulfillment_journeys: any;
}

export class RxDBManager {
  private database: RxDatabase<DatabaseCollections> | null = null;
  private initialized: boolean = false;

  /**
   * 初始化数据库
   */
  public async initialize(): Promise<RxDatabase<DatabaseCollections>> {
    if (this.database && this.initialized) {
      return this.database;
    }

    console.log('🏨 初始化履约驱动酒店管理系统数据库...');

    try {
      // 创建数据库
      this.database = await createRxDatabase<DatabaseCollections>({
        name: 'fulfillment_driven_hotel_pms',
        storage: wrappedValidateAjvStorage({ 
          storage: getRxStorageDexie() 
        }),
        multiInstance: true,      // 支持多标签页
        eventReduce: true,        // 性能优化
        cleanupPolicy: {          // 数据清理策略
          minimumDeletedTime: 1000 * 60 * 60 * 24 * 30,  // 30天
          minimumCollectionAge: 1000 * 60 * 60 * 24 * 7,  // 7天
          runEach: 1000 * 60 * 10                         // 10分钟
        }
      });

      // 添加集合
      await this.database.addCollections({
        guests: {
          schema: guestSchema,
          methods: {
            // 实例方法
            getCurrentStage() {
              return this.fulfillmentHistory.currentStage;
            },
            
            getLoyaltyLevel() {
              return this.tags.loyaltyLevel;
            },
            
            getLifetimeValue() {
              return this.businessMetrics.lifetimeValue;
            }
          },
          statics: {
            // 静态方法
            findByPhone(phone: string) {
              return this.findOne({
                selector: {
                  'personalInfo.phone': phone
                }
              });
            },
            
            findByStage(stage: string) {
              return this.find({
                selector: {
                  'fulfillmentHistory.currentStage': stage
                }
              });
            },
            
            findByLoyaltyLevel(level: string) {
              return this.find({
                selector: {
                  'tags.loyaltyLevel': level
                }
              });
            }
          }
        }
      });

      this.initialized = true;
      console.log('✅ RxDB 数据库初始化完成');
      console.log('📊 可用集合:', Object.keys(this.database.collections));

      // 添加数据库事件监听
      this.setupEventListeners();

      return this.database;
    } catch (error) {
      console.error('❌ RxDB 数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.database) return;

    // 监听数据变化
    this.database.collections.guests.$.subscribe(changeEvent => {
      console.log('💫 Guest数据变化:', changeEvent);
    });

    // 监听数据库错误
    this.database.$.subscribe(event => {
      if (event.operation === 'error') {
        console.error('🚨 数据库错误:', event);
      }
    });
  }

  /**
   * 获取数据库实例
   */
  public getDatabase(): RxDatabase<DatabaseCollections> {
    if (!this.database || !this.initialized) {
      throw new Error('数据库未初始化，请先调用 initialize()');
    }
    return this.database;
  }

  /**
   * 获取客人集合
   */
  public getGuestsCollection() {
    return this.getDatabase().collections.guests;
  }

  /**
   * 创建演示数据
   */
  public async createDemoData(): Promise<void> {
    const guestsCollection = this.getGuestsCollection();

    // 检查是否已有数据
    const existingGuests = await guestsCollection.count().exec();
    if (existingGuests > 0) {
      console.log('📊 数据库中已有客人数据，跳过演示数据创建');
      return;
    }

    console.log('🎭 创建演示数据...');

    const demoGuests: GuestDocType[] = [
      {
        id: 'guest-001',
        personalInfo: {
          name: '张三',
          phone: '13800138001',
          email: 'zhang.san@example.com',
          idCard: '110101199001011234',
          address: '北京市朝阳区'
        },
        fulfillmentHistory: {
          currentStage: 'evaluation',
          stageStartTime: new Date(),
          completedStages: [
            {
              stage: 'awareness',
              completedAt: new Date(Date.now() - 1000 * 60 * 30), // 30分钟前
              duration: 1000 * 60 * 15, // 15分钟
              score: 85,
              events: ['PAGE_VIEW', 'AD_CLICK']
            }
          ],
          journeyCount: 1
        },
        businessMetrics: {
          lifetimeValue: 1200.50,
          totalBookings: 2,
          averageRating: 4.5,
          referralCount: 1
        },
        tags: {
          loyaltyLevel: 'silver',
          riskLevel: 'low',
          valueSegment: 'standard'
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        version: 1,
        isDeleted: false
      },
      {
        id: 'guest-002',
        personalInfo: {
          name: '李四',
          phone: '13800138002',
          email: 'li.si@example.com',
          idCard: '110101199002021234',
          address: '上海市浦东新区'
        },
        fulfillmentHistory: {
          currentStage: 'experiencing',
          stageStartTime: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2小时前
          completedStages: [
            {
              stage: 'awareness',
              completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
              duration: 1000 * 60 * 10,
              score: 90,
              events: ['SEARCH_QUERY', 'DETAILS_VIEW']
            },
            {
              stage: 'evaluation',
              completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
              duration: 1000 * 60 * 45,
              score: 92,
              events: ['INQUIRY_SUBMIT', 'LIVE_CHAT']
            },
            {
              stage: 'booking',
              completedAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
              duration: 1000 * 60 * 20,
              score: 95,
              events: ['BOOKING_START', 'PAYMENT_SUCCESS', 'BOOKING_CONFIRMED']
            }
          ],
          journeyCount: 3
        },
        businessMetrics: {
          lifetimeValue: 3450.80,
          totalBookings: 5,
          averageRating: 4.8,
          referralCount: 3
        },
        tags: {
          loyaltyLevel: 'gold',
          riskLevel: 'low',
          valueSegment: 'premium'
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        version: 1,
        isDeleted: false
      }
    ];

    // 插入演示数据
    for (const guest of demoGuests) {
      await guestsCollection.insert(guest);
    }

    console.log('✅ 演示数据创建完成');
  }

  /**
   * 获取统计信息
   */
  public async getStats() {
    const guestsCollection = this.getGuestsCollection();
    
    const total = await guestsCollection.count().exec();
    
    // 按阶段统计
    const stages = ['awareness', 'evaluation', 'booking', 'experiencing', 'feedback'];
    const stageCounts = await Promise.all(
      stages.map(async stage => ({
        stage,
        count: await guestsCollection.count({
          selector: {
            'fulfillmentHistory.currentStage': stage
          }
        }).exec()
      }))
    );

    // 按忠诚度统计
    const loyaltyLevels = ['bronze', 'silver', 'gold', 'platinum'];
    const loyaltyCounts = await Promise.all(
      loyaltyLevels.map(async level => ({
        level,
        count: await guestsCollection.count({
          selector: {
            'tags.loyaltyLevel': level
          }
        }).exec()
      }))
    );

    return {
      total,
      byStage: stageCounts,
      byLoyalty: loyaltyCounts,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 清理数据库
   */
  public async cleanup(): Promise<void> {
    if (this.database) {
      await this.database.destroy();
      this.database = null;
      this.initialized = false;
      console.log('🧹 数据库已清理');
    }
  }
}

// 单例实例
export const rxdbManager = new RxDBManager();