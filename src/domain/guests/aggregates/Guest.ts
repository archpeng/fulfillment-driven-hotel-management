import { AggregateRoot, DomainEvent } from '../../shared/base/AggregateRoot';
import { FulfillmentStage, StageProgress } from '../../shared/value-objects/FulfillmentStage';
import { LoyaltyLevel } from '../../shared/value-objects/LoyaltyLevel';

/**
 * Guest 聚合根
 * 履约驱动架构的核心实体 - 代表系统中的客人
 */
export class Guest extends AggregateRoot<string> {
  private _personalInfo: PersonalInfo;
  private _fulfillmentHistory: FulfillmentHistory;
  private _businessMetrics: BusinessMetrics;
  private _preferences: GuestPreferences;
  private _tags: GuestTags;
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(
    id: string,
    personalInfo: PersonalInfo,
    preferences?: Partial<GuestPreferences>
  ) {
    super(id);
    this._personalInfo = personalInfo;
    this._fulfillmentHistory = {
      currentStage: FulfillmentStage.AWARENESS,
      stageStartTime: new Date(),
      completedStages: [],
      journeyCount: 0,
      totalJourneyTime: 0
    };
    this._businessMetrics = {
      lifetimeValue: 0,
      totalBookings: 0,
      totalNights: 0,
      averageRating: 0,
      referralCount: 0,
      lastVisitDate: null
    };
    this._preferences = {
      roomTypes: [],
      priceRange: [0, 10000],
      specialRequests: [],
      communicationPreference: 'phone',
      ...preferences
    };
    this._tags = {
      loyaltyLevel: LoyaltyLevel.BRONZE,
      riskLevel: 'low',
      valueSegment: 'budget',
      behaviorPatterns: []
    };
    this._createdAt = new Date();
    this._updatedAt = new Date();

    this.addDomainEvent(new GuestCreatedEvent(id, personalInfo));
  }

  // Getters
  get personalInfo(): PersonalInfo {
    return { ...this._personalInfo };
  }

  get fulfillmentHistory(): FulfillmentHistory {
    return { ...this._fulfillmentHistory };
  }

  get businessMetrics(): BusinessMetrics {
    return { ...this._businessMetrics };
  }

  get preferences(): GuestPreferences {
    return { ...this._preferences };
  }

  get tags(): GuestTags {
    return { ...this._tags };
  }

  get currentStage(): FulfillmentStage {
    return this._fulfillmentHistory.currentStage;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * 推进到下一个履约阶段
   */
  public advanceToStage(targetStage: FulfillmentStage, qualityScore: number = 80): void {
    if (!this._fulfillmentHistory.currentStage.canTransitionTo(targetStage)) {
      throw new Error(
        `Cannot transition from ${this._fulfillmentHistory.currentStage.value} to ${targetStage.value}`
      );
    }

    const currentStageProgress: StageProgress = {
      stage: this._fulfillmentHistory.currentStage,
      startTime: this._fulfillmentHistory.stageStartTime.toISOString(),
      endTime: new Date().toISOString(),
      qualityScore,
      isCompleted: true,
      events: []
    };

    this._fulfillmentHistory.completedStages.push(currentStageProgress);
    this._fulfillmentHistory.currentStage = targetStage;
    this._fulfillmentHistory.stageStartTime = new Date();
    this._updatedAt = new Date();

    this.incrementVersion();
    this.addDomainEvent(new GuestStageAdvancedEvent(this._id, targetStage, qualityScore));
  }

  /**
   * 完成一次完整的履约历程
   */
  public completeJourney(finalQualityScore: number): void {
    if (this._fulfillmentHistory.currentStage.value !== 'feedback') {
      throw new Error('Cannot complete journey before reaching feedback stage');
    }

    this._fulfillmentHistory.journeyCount++;
    const journeyDuration = this.calculateCurrentJourneyDuration();
    this._fulfillmentHistory.totalJourneyTime += journeyDuration;
    
    this.addDomainEvent(new GuestJourneyCompletedEvent(
      this._id, 
      this._fulfillmentHistory.journeyCount,
      journeyDuration,
      finalQualityScore
    ));
  }

  /**
   * 更新商业指标
   */
  public updateBusinessMetrics(update: Partial<BusinessMetrics>): void {
    this._businessMetrics = {
      ...this._businessMetrics,
      ...update,
      lastVisitDate: update.lastVisitDate || this._businessMetrics.lastVisitDate
    };

    // 重新计算忠诚度等级
    this.recalculateLoyaltyLevel();
    this._updatedAt = new Date();
    this.incrementVersion();

    this.addDomainEvent(new GuestBusinessMetricsUpdatedEvent(this._id, this._businessMetrics));
  }

  /**
   * 更新客人偏好
   */
  public updatePreferences(preferences: Partial<GuestPreferences>): void {
    this._preferences = {
      ...this._preferences,
      ...preferences
    };
    this._updatedAt = new Date();
    this.incrementVersion();

    this.addDomainEvent(new GuestPreferencesUpdatedEvent(this._id, preferences));
  }

  /**
   * 添加行为标签
   */
  public addBehaviorPattern(pattern: string): void {
    if (!this._tags.behaviorPatterns.includes(pattern)) {
      this._tags.behaviorPatterns.push(pattern);
      this._updatedAt = new Date();
      this.incrementVersion();

      this.addDomainEvent(new GuestBehaviorPatternAddedEvent(this._id, pattern));
    }
  }

  /**
   * 计算客户生命周期价值 (LTV)
   */
  public calculateLifetimeValue(): number {
    if (this._businessMetrics.totalBookings === 0) {
      return 0;
    }

    const avgOrderValue = this._businessMetrics.lifetimeValue / this._businessMetrics.totalBookings;
    const avgJourneyDays = this._fulfillmentHistory.journeyCount > 0 
      ? this._fulfillmentHistory.totalJourneyTime / this._fulfillmentHistory.journeyCount 
      : 30;
    
    // 基于历史数据预测未来价值
    const predictedFutureBookings = Math.max(1, this._businessMetrics.totalBookings * 0.5);
    
    return avgOrderValue * (this._businessMetrics.totalBookings + predictedFutureBookings);
  }

  /**
   * 检查是否为风险客人
   */
  public isRiskCustomer(): boolean {
    // 检查多个风险指标
    const hasLowRating = this._businessMetrics.averageRating < 3;
    const hasLongCurrentStage = this.getDaysInCurrentStage() > 30;
    const hasNoRecentActivity = this.getDaysSinceLastVisit() > 365;
    
    return hasLowRating || hasLongCurrentStage || hasNoRecentActivity;
  }

  /**
   * 获取个性化推荐权重
   */
  public getRecommendationWeight(): number {
    let weight = 1.0;
    
    // 忠诚度加权
    weight += this._tags.loyaltyLevel.tier * 0.5;
    
    // 商业价值加权
    if (this._businessMetrics.lifetimeValue > 5000) weight += 1.0;
    if (this._businessMetrics.totalBookings > 5) weight += 0.5;
    
    // 满意度加权
    weight += (this._businessMetrics.averageRating - 3) * 0.3;
    
    return Math.max(0.5, Math.min(5.0, weight));
  }

  /**
   * 重新计算忠诚度等级
   */
  private recalculateLoyaltyLevel(): void {
    const monthsSinceFirstVisit = this._createdAt 
      ? Math.floor((Date.now() - this._createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30))
      : 0;

    const newLevel = LoyaltyLevel.calculateLevel({
      totalValue: this._businessMetrics.lifetimeValue,
      visitCount: this._businessMetrics.totalBookings,
      averageRating: this._businessMetrics.averageRating,
      referralCount: this._businessMetrics.referralCount,
      monthsSinceFirstVisit
    });

    if (!newLevel.equals(this._tags.loyaltyLevel)) {
      const oldLevel = this._tags.loyaltyLevel;
      this._tags.loyaltyLevel = newLevel;
      
      this.addDomainEvent(new GuestLoyaltyLevelChangedEvent(
        this._id, 
        oldLevel.value, 
        newLevel.value
      ));
    }
  }

  /**
   * 计算当前履约历程已用时间（天）
   */
  private calculateCurrentJourneyDuration(): number {
    return Math.floor(
      (Date.now() - this._fulfillmentHistory.stageStartTime.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  /**
   * 获取在当前阶段停留的天数
   */
  private getDaysInCurrentStage(): number {
    return Math.floor(
      (Date.now() - this._fulfillmentHistory.stageStartTime.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  /**
   * 获取距离上次访问的天数
   */
  private getDaysSinceLastVisit(): number {
    if (!this._businessMetrics.lastVisitDate) {
      return Infinity;
    }
    
    return Math.floor(
      (Date.now() - this._businessMetrics.lastVisitDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }
}

/**
 * 客人个人信息
 */
export interface PersonalInfo {
  name: string;
  phone: string;
  email?: string;
  idCard?: string;
  avatar?: string;
}

/**
 * 履约历史
 */
export interface FulfillmentHistory {
  currentStage: FulfillmentStage;
  stageStartTime: Date;
  completedStages: StageProgress[];
  journeyCount: number; // 完成的完整履约历程次数
  totalJourneyTime: number; // 总的履约用时（天）
}

/**
 * 商业指标
 */
export interface BusinessMetrics {
  lifetimeValue: number; // 生命周期价值
  totalBookings: number; // 总预订次数
  totalNights: number; // 总住宿夜数
  averageRating: number; // 平均评分
  referralCount: number; // 推荐人数
  lastVisitDate: Date | null; // 最后访问日期
}

/**
 * 客人偏好
 */
export interface GuestPreferences {
  roomTypes: string[]; // 偏好房型
  priceRange: [number, number]; // 价格区间
  specialRequests: string[]; // 特殊需求
  communicationPreference: 'phone' | 'wechat' | 'email'; // 沟通偏好
}

/**
 * 客人标签
 */
export interface GuestTags {
  loyaltyLevel: LoyaltyLevel; // 忠诚度等级
  riskLevel: 'low' | 'medium' | 'high'; // 风险等级
  valueSegment: 'budget' | 'mid-range' | 'luxury'; // 价值分段
  behaviorPatterns: string[]; // 行为模式标签
}

// 领域事件定义
export class GuestCreatedEvent implements DomainEvent {
  readonly eventId = `guest-created-${Date.now()}`;
  readonly eventType = 'GuestCreated';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    readonly eventData: PersonalInfo
  ) {}
}

export class GuestStageAdvancedEvent implements DomainEvent {
  readonly eventId = `guest-stage-advanced-${Date.now()}`;
  readonly eventType = 'GuestStageAdvanced';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    public readonly newStage: FulfillmentStage,
    public readonly qualityScore: number
  ) {
    this.eventData = {
      newStage: newStage.value,
      qualityScore
    };
  }

  readonly eventData: Record<string, any>;
}

export class GuestJourneyCompletedEvent implements DomainEvent {
  readonly eventId = `guest-journey-completed-${Date.now()}`;
  readonly eventType = 'GuestJourneyCompleted';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    public readonly journeyCount: number,
    public readonly duration: number,
    public readonly finalScore: number
  ) {
    this.eventData = {
      journeyCount,
      duration,
      finalScore
    };
  }

  readonly eventData: Record<string, any>;
}

export class GuestBusinessMetricsUpdatedEvent implements DomainEvent {
  readonly eventId = `guest-metrics-updated-${Date.now()}`;
  readonly eventType = 'GuestBusinessMetricsUpdated';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    readonly eventData: BusinessMetrics
  ) {}
}

export class GuestPreferencesUpdatedEvent implements DomainEvent {
  readonly eventId = `guest-preferences-updated-${Date.now()}`;
  readonly eventType = 'GuestPreferencesUpdated';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    readonly eventData: Partial<GuestPreferences>
  ) {}
}

export class GuestBehaviorPatternAddedEvent implements DomainEvent {
  readonly eventId = `guest-behavior-added-${Date.now()}`;
  readonly eventType = 'GuestBehaviorPatternAdded';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    public readonly pattern: string
  ) {
    this.eventData = { pattern };
  }

  readonly eventData: Record<string, any>;
}

export class GuestLoyaltyLevelChangedEvent implements DomainEvent {
  readonly eventId = `guest-loyalty-changed-${Date.now()}`;
  readonly eventType = 'GuestLoyaltyLevelChanged';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    public readonly oldLevel: string,
    public readonly newLevel: string
  ) {
    this.eventData = { oldLevel, newLevel };
  }

  readonly eventData: Record<string, any>;
}