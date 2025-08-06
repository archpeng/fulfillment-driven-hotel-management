import { Guest } from '../aggregates/Guest';
import { FulfillmentStage } from '../../shared/value-objects/FulfillmentStage';
import { LoyaltyLevel } from '../../shared/value-objects/LoyaltyLevel';

/**
 * Guest仓库接口
 * 定义Guest聚合根的数据访问契约
 */
export interface GuestRepository {
  /**
   * 保存客人聚合根
   */
  save(guest: Guest): Promise<void>;

  /**
   * 根据ID查找客人
   */
  findById(id: string): Promise<Guest | null>;

  /**
   * 根据电话号码查找客人
   */
  findByPhone(phone: string): Promise<Guest | null>;

  /**
   * 根据履约阶段查找客人
   */
  findByCurrentStage(stage: FulfillmentStage): Promise<Guest[]>;

  /**
   * 根据忠诚度等级查找客人
   */
  findByLoyaltyLevel(level: LoyaltyLevel): Promise<Guest[]>;

  /**
   * 查找风险客人
   */
  findRiskCustomers(riskLevel?: 'low' | 'medium' | 'high'): Promise<Guest[]>;

  /**
   * 查找高价值客人
   */
  findHighValueCustomers(minValue: number): Promise<Guest[]>;

  /**
   * 获取履约阶段统计
   */
  getStageStatistics(): Promise<StageStatistics>;

  /**
   * 获取忠诚度分布统计
   */
  getLoyaltyDistribution(): Promise<LoyaltyDistribution>;

  /**
   * 分页查询客人
   */
  findWithPagination(options: PaginationOptions): Promise<PaginatedResult<Guest>>;

  /**
   * 删除客人（软删除）
   */
  delete(id: string): Promise<void>;

  /**
   * 批量操作
   */
  bulkSave(guests: Guest[]): Promise<void>;
}

/**
 * 阶段统计
 */
export interface StageStatistics {
  awareness: number;
  evaluation: number;
  booking: number;
  experiencing: number;
  feedback: number;
  total: number;
}

/**
 * 忠诚度分布
 */
export interface LoyaltyDistribution {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
  total: number;
}

/**
 * 分页选项
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: {
    currentStage?: string;
    loyaltyLevel?: string;
    riskLevel?: string;
    valueSegment?: string;
    minLifetimeValue?: number;
    maxLifetimeValue?: number;
    createdAfter?: Date;
    createdBefore?: Date;
  };
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}