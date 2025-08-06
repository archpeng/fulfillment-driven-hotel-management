import { 
  GuestRepository, 
  StageStatistics, 
  LoyaltyDistribution, 
  PaginationOptions, 
  PaginatedResult 
} from '../../domain/guests/repositories/GuestRepository';
import { Guest, PersonalInfo, BusinessMetrics, GuestPreferences } from '../../domain/guests/aggregates/Guest';
import { FulfillmentStage } from '../../domain/shared/value-objects/FulfillmentStage';
import { LoyaltyLevel } from '../../domain/shared/value-objects/LoyaltyLevel';
import { GuestCollection, GuestDocType } from '../schemas/guest.schema';

/**
 * Guest仓库的RxDB实现
 * 提供Guest聚合根的完整数据访问功能
 */
export class RxDBGuestRepository implements GuestRepository {
  constructor(private readonly collection: GuestCollection) {}

  /**
   * 保存客人聚合根
   */
  async save(guest: Guest): Promise<void> {
    const doc = this.mapToDocument(guest);
    
    try {
      const existingDoc = await this.collection.findOne(guest.id).exec();
      
      if (existingDoc) {
        await existingDoc.update({
          $set: {
            ...doc,
            updatedAt: new Date().toISOString(),
            version: guest.version
          }
        });
      } else {
        await this.collection.insert(doc);
      }
      
      // 清空领域事件（在实际应用中，这里应该发布事件到事件总线）
      guest.clearDomainEvents();
    } catch (error) {
      throw new Error(`Failed to save guest: ${error.message}`);
    }
  }

  /**
   * 根据ID查找客人
   */
  async findById(id: string): Promise<Guest | null> {
    try {
      const doc = await this.collection
        .findOne()
        .where('id').eq(id)
        .where('isDeleted').eq(false)
        .exec();
      
      return doc ? this.mapToDomain(doc.toJSON()) : null;
    } catch (error) {
      throw new Error(`Failed to find guest by id: ${error.message}`);
    }
  }

  /**
   * 根据电话号码查找客人
   */
  async findByPhone(phone: string): Promise<Guest | null> {
    try {
      const doc = await this.collection
        .findOne()
        .where('personalInfo.phone').eq(phone)
        .where('isDeleted').eq(false)
        .exec();
      
      return doc ? this.mapToDomain(doc.toJSON()) : null;
    } catch (error) {
      throw new Error(`Failed to find guest by phone: ${error.message}`);
    }
  }

  /**
   * 根据履约阶段查找客人
   */
  async findByCurrentStage(stage: FulfillmentStage): Promise<Guest[]> {
    try {
      const docs = await this.collection
        .find()
        .where('fulfillmentHistory.currentStage').eq(stage.value)
        .where('isDeleted').eq(false)
        .sort('updatedAt')
        .exec();
      
      return docs.map(doc => this.mapToDomain(doc.toJSON()));
    } catch (error) {
      throw new Error(`Failed to find guests by stage: ${error.message}`);
    }
  }

  /**
   * 根据忠诚度等级查找客人
   */
  async findByLoyaltyLevel(level: LoyaltyLevel): Promise<Guest[]> {
    try {
      const docs = await this.collection
        .find()
        .where('tags.loyaltyLevel').eq(level.value)
        .where('isDeleted').eq(false)
        .sort('businessMetrics.lifetimeValue')
        .exec();
      
      return docs.map(doc => this.mapToDomain(doc.toJSON()));
    } catch (error) {
      throw new Error(`Failed to find guests by loyalty level: ${error.message}`);
    }
  }

  /**
   * 查找风险客人
   */
  async findRiskCustomers(riskLevel?: 'low' | 'medium' | 'high'): Promise<Guest[]> {
    try {
      let query = this.collection
        .find()
        .where('isDeleted').eq(false);
      
      if (riskLevel) {
        query = query.where('tags.riskLevel').eq(riskLevel);
      } else {
        query = query.where('tags.riskLevel').in(['medium', 'high']);
      }
      
      const docs = await query
        .sort('updatedAt')
        .exec();
      
      return docs.map(doc => this.mapToDomain(doc.toJSON()));
    } catch (error) {
      throw new Error(`Failed to find risk customers: ${error.message}`);
    }
  }

  /**
   * 查找高价值客人
   */
  async findHighValueCustomers(minValue: number): Promise<Guest[]> {
    try {
      const docs = await this.collection
        .find()
        .where('businessMetrics.lifetimeValue').gte(minValue)
        .where('isDeleted').eq(false)
        .sort('-businessMetrics.lifetimeValue') // 按价值降序
        .exec();
      
      return docs.map(doc => this.mapToDomain(doc.toJSON()));
    } catch (error) {
      throw new Error(`Failed to find high value customers: ${error.message}`);
    }
  }

  /**
   * 获取履约阶段统计
   */
  async getStageStatistics(): Promise<StageStatistics> {
    try {
      // RxDB不支持聚合查询，需要手动计算
      const allDocs = await this.collection
        .find()
        .where('isDeleted').eq(false)
        .exec();
      
      const stats: StageStatistics = {
        awareness: 0,
        evaluation: 0,
        booking: 0,
        experiencing: 0,
        feedback: 0,
        total: 0
      };
      
      allDocs.forEach(doc => {
        const stage = doc.toJSON().fulfillmentHistory.currentStage;
        if (stats.hasOwnProperty(stage)) {
          stats[stage as keyof StageStatistics]++;
        }
        stats.total++;
      });
      
      return stats;
    } catch (error) {
      throw new Error(`Failed to get stage statistics: ${error.message}`);
    }
  }

  /**
   * 获取忠诚度分布统计
   */
  async getLoyaltyDistribution(): Promise<LoyaltyDistribution> {
    try {
      const allDocs = await this.collection
        .find()
        .where('isDeleted').eq(false)
        .exec();
      
      const distribution: LoyaltyDistribution = {
        bronze: 0,
        silver: 0,
        gold: 0,
        platinum: 0,
        total: 0
      };
      
      allDocs.forEach(doc => {
        const level = doc.toJSON().tags.loyaltyLevel;
        if (distribution.hasOwnProperty(level)) {
          distribution[level as keyof LoyaltyDistribution]++;
        }
        distribution.total++;
      });
      
      return distribution;
    } catch (error) {
      throw new Error(`Failed to get loyalty distribution: ${error.message}`);
    }
  }

  /**
   * 分页查询客人
   */
  async findWithPagination(options: PaginationOptions): Promise<PaginatedResult<Guest>> {
    try {
      let query = this.collection
        .find()
        .where('isDeleted').eq(false);
      
      // 应用过滤器
      if (options.filters) {
        const filters = options.filters;
        
        if (filters.currentStage) {
          query = query.where('fulfillmentHistory.currentStage').eq(filters.currentStage);
        }
        
        if (filters.loyaltyLevel) {
          query = query.where('tags.loyaltyLevel').eq(filters.loyaltyLevel);
        }
        
        if (filters.riskLevel) {
          query = query.where('tags.riskLevel').eq(filters.riskLevel);
        }
        
        if (filters.valueSegment) {
          query = query.where('tags.valueSegment').eq(filters.valueSegment);
        }
        
        if (filters.minLifetimeValue !== undefined) {
          query = query.where('businessMetrics.lifetimeValue').gte(filters.minLifetimeValue);
        }
        
        if (filters.maxLifetimeValue !== undefined) {
          query = query.where('businessMetrics.lifetimeValue').lte(filters.maxLifetimeValue);
        }
        
        if (filters.createdAfter) {
          query = query.where('createdAt').gte(filters.createdAfter.toISOString());
        }
        
        if (filters.createdBefore) {
          query = query.where('createdAt').lte(filters.createdBefore.toISOString());
        }
      }
      
      // 应用排序
      const sortBy = options.sortBy || 'updatedAt';
      const sortOrder = options.sortOrder === 'asc' ? sortBy : `-${sortBy}`;
      query = query.sort(sortOrder);
      
      // 计算总数
      const allDocs = await query.exec();
      const total = allDocs.length;
      
      // 分页
      const skip = (options.page - 1) * options.limit;
      const paginatedDocs = allDocs.slice(skip, skip + options.limit);
      
      const guests = paginatedDocs.map(doc => this.mapToDomain(doc.toJSON()));
      
      return {
        data: guests,
        total,
        page: options.page,
        limit: options.limit,
        totalPages: Math.ceil(total / options.limit)
      };
    } catch (error) {
      throw new Error(`Failed to find guests with pagination: ${error.message}`);
    }
  }

  /**
   * 删除客人（软删除）
   */
  async delete(id: string): Promise<void> {
    try {
      const doc = await this.collection.findOne(id).exec();
      if (doc) {
        await doc.update({
          $set: {
            isDeleted: true,
            updatedAt: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      throw new Error(`Failed to delete guest: ${error.message}`);
    }
  }

  /**
   * 批量操作
   */
  async bulkSave(guests: Guest[]): Promise<void> {
    try {
      const docs = guests.map(guest => this.mapToDocument(guest));
      await this.collection.bulkInsert(docs);
      
      // 清空所有领域事件
      guests.forEach(guest => guest.clearDomainEvents());
    } catch (error) {
      throw new Error(`Failed to bulk save guests: ${error.message}`);
    }
  }

  /**
   * 将Guest聚合根映射为数据库文档
   */
  private mapToDocument(guest: Guest): GuestDocType {
    return {
      id: guest.id,
      personalInfo: guest.personalInfo,
      fulfillmentHistory: {
        ...guest.fulfillmentHistory,
        currentStage: guest.fulfillmentHistory.currentStage.value,
        stageStartTime: guest.fulfillmentHistory.stageStartTime.toISOString(),
        completedStages: guest.fulfillmentHistory.completedStages.map(stage => ({
          ...stage,
          stage: stage.stage.value,
        }))
      },
      businessMetrics: {
        ...guest.businessMetrics,
        lastVisitDate: guest.businessMetrics.lastVisitDate?.toISOString()
      },
      preferences: guest.preferences,
      tags: {
        ...guest.tags,
        loyaltyLevel: guest.tags.loyaltyLevel.value
      },
      createdAt: guest.createdAt.toISOString(),
      updatedAt: guest.updatedAt.toISOString(),
      version: guest.version,
      isDeleted: false
    };
  }

  /**
   * 将数据库文档映射为Guest聚合根
   */
  private mapToDomain(doc: GuestDocType): Guest {
    // 重新构建Guest聚合根需要使用工厂方法或者反序列化逻辑
    // 这里简化实现，在实际项目中应该有专门的映射器
    const guest = new Guest(doc.id, doc.personalInfo, doc.preferences);
    
    // 通过反射或者其他方式恢复聚合根的内部状态
    // 注意：这违反了聚合根的封装性，实际项目中应该提供专门的重建方法
    (guest as any)._fulfillmentHistory = {
      ...doc.fulfillmentHistory,
      currentStage: FulfillmentStage.fromValue(doc.fulfillmentHistory.currentStage),
      stageStartTime: new Date(doc.fulfillmentHistory.stageStartTime),
      completedStages: doc.fulfillmentHistory.completedStages.map(stage => ({
        ...stage,
        stage: FulfillmentStage.fromValue(stage.stage),
      }))
    };
    
    (guest as any)._businessMetrics = {
      ...doc.businessMetrics,
      lastVisitDate: doc.businessMetrics.lastVisitDate ? new Date(doc.businessMetrics.lastVisitDate) : null
    };
    
    (guest as any)._tags = {
      ...doc.tags,
      loyaltyLevel: LoyaltyLevel.fromValue(doc.tags.loyaltyLevel)
    };
    
    (guest as any)._createdAt = new Date(doc.createdAt);
    (guest as any)._updatedAt = new Date(doc.updatedAt);
    (guest as any)._version = doc.version;
    
    return guest;
  }
}