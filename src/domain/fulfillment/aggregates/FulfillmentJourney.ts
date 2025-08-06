import { AggregateRoot, DomainEvent } from '../../shared/base/AggregateRoot';
import { FulfillmentStage, StageProgress } from '../../shared/value-objects/FulfillmentStage';

/**
 * FulfillmentJourney 聚合根
 * 管理客人的完整履约历程，是履约驱动架构的核心业务实体
 */
export class FulfillmentJourney extends AggregateRoot<string> {
  private _guestId: string;
  private _currentStage: FulfillmentStage;
  private _stages: Map<string, StageProgress>;
  private _startTime: Date;
  private _endTime?: Date;
  private _overallScore: number;
  private _events: FulfillmentEvent[];
  private _milestones: Milestone[];
  private _isActive: boolean;
  private _journeyType: JourneyType;
  private _metadata: JourneyMetadata;
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(
    id: string,
    guestId: string,
    journeyType: JourneyType = 'first_visit',
    metadata?: Partial<JourneyMetadata>
  ) {
    super(id);
    this._guestId = guestId;
    this._currentStage = FulfillmentStage.AWARENESS;
    this._stages = new Map();
    this._startTime = new Date();
    this._overallScore = 0;
    this._events = [];
    this._milestones = [];
    this._isActive = true;
    this._journeyType = journeyType;
    this._metadata = {
      source: 'direct',
      channel: 'website',
      referrer: null,
      campaignId: null,
      expectedRevenue: 0,
      ...metadata
    };
    this._createdAt = new Date();
    this._updatedAt = new Date();

    // 初始化第一个阶段
    this.initializeStage(FulfillmentStage.AWARENESS);
    
    this.addDomainEvent(new FulfillmentJourneyStartedEvent(
      id,
      guestId,
      journeyType,
      this._metadata
    ));
  }

  // Getters
  get guestId(): string {
    return this._guestId;
  }

  get currentStage(): FulfillmentStage {
    return this._currentStage;
  }

  get stages(): ReadonlyMap<string, StageProgress> {
    return new Map(this._stages);
  }

  get startTime(): Date {
    return this._startTime;
  }

  get endTime(): Date | undefined {
    return this._endTime;
  }

  get overallScore(): number {
    return this._overallScore;
  }

  get events(): readonly FulfillmentEvent[] {
    return [...this._events];
  }

  get milestones(): readonly Milestone[] {
    return [...this._milestones];
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get journeyType(): JourneyType {
    return this._journeyType;
  }

  get metadata(): JourneyMetadata {
    return { ...this._metadata };
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
  public progressToStage(targetStage: FulfillmentStage, context?: StageTransitionContext): void {
    if (!this._isActive) {
      throw new Error('Cannot progress inactive journey');
    }

    if (!this._currentStage.canTransitionTo(targetStage)) {
      throw new Error(
        `Cannot transition from ${this._currentStage.value} to ${targetStage.value}`
      );
    }

    // 完成当前阶段
    this.completeCurrentStage(context?.currentStageScore || 80);

    // 开始新阶段
    this._currentStage = targetStage;
    this.initializeStage(targetStage);
    
    this._updatedAt = new Date();
    this.incrementVersion();

    // 记录里程碑
    this.recordMilestone({
      type: 'stage_transition',
      stage: targetStage.value,
      timestamp: new Date(),
      description: `Progressed to ${targetStage.displayName}`,
      metadata: context || {}
    });

    this.addDomainEvent(new FulfillmentStageProgressedEvent(
      this._id,
      this._guestId,
      targetStage,
      context
    ));

    // 检查是否完成整个履约历程
    if (targetStage.isFinalStage()) {
      this.checkJourneyCompletion();
    }
  }

  /**
   * 记录履约事件
   */
  public recordEvent(event: FulfillmentEventData): void {
    if (!this._isActive) {
      throw new Error('Cannot record event in inactive journey');
    }

    const fulfillmentEvent: FulfillmentEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      journeyId: this._id,
      guestId: this._guestId,
      type: event.type,
      stage: this._currentStage.value,
      timestamp: new Date(),
      data: event.data,
      impact: event.impact,
      source: event.source || 'system'
    };

    this._events.push(fulfillmentEvent);
    
    // 更新当前阶段的事件记录
    const currentStageProgress = this._stages.get(this._currentStage.value);
    if (currentStageProgress) {
      currentStageProgress.events.push({
        eventType: event.type,
        timestamp: fulfillmentEvent.timestamp.toISOString(),
        impact: event.impact
      });
      
      // 更新阶段质量评分
      this.updateStageQualityScore(event.impact);
    }

    this._updatedAt = new Date();
    this.incrementVersion();

    this.addDomainEvent(new FulfillmentEventRecordedEvent(
      this._id,
      this._guestId,
      fulfillmentEvent
    ));
  }

  /**
   * 计算阶段成功率
   */
  public calculateStageSuccess(): number {
    const completedStages = Array.from(this._stages.values()).filter(s => s.isCompleted);
    
    if (completedStages.length === 0) {
      return 0;
    }

    const totalScore = completedStages.reduce((sum, stage) => sum + stage.qualityScore, 0);
    return totalScore / completedStages.length;
  }

  /**
   * 获取履约历程持续时间（分钟）
   */
  public getDurationMinutes(): number {
    const endTime = this._endTime || new Date();
    return Math.floor((endTime.getTime() - this._startTime.getTime()) / (1000 * 60));
  }

  /**
   * 获取当前阶段持续时间（分钟）
   */
  public getCurrentStageDurationMinutes(): number {
    const currentStage = this._stages.get(this._currentStage.value);
    if (!currentStage) return 0;
    
    const startTime = new Date(currentStage.startTime);
    const endTime = currentStage.endTime ? new Date(currentStage.endTime) : new Date();
    
    return Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
  }

  /**
   * 检查是否存在阶段瓶颈
   */
  public hasStageBottleneck(thresholdMinutes: number = 1440): boolean { // 24小时
    return this.getCurrentStageDurationMinutes() > thresholdMinutes;
  }

  /**
   * 获取履约历程摘要
   */
  public getSummary(): JourneySummary {
    const completedStages = Array.from(this._stages.values()).filter(s => s.isCompleted);
    
    return {
      journeyId: this._id,
      guestId: this._guestId,
      journeyType: this._journeyType,
      startTime: this._startTime,
      endTime: this._endTime,
      currentStage: this._currentStage.value,
      totalStages: this._stages.size,
      completedStages: completedStages.length,
      overallScore: this._overallScore,
      duration: this.getDurationMinutes(),
      eventCount: this._events.length,
      milestoneCount: this._milestones.length,
      isActive: this._isActive,
      hasBottleneck: this.hasStageBottleneck()
    };
  }

  /**
   * 暂停履约历程
   */
  public pause(reason: string): void {
    if (!this._isActive) {
      throw new Error('Journey is already inactive');
    }

    this._isActive = false;
    this._updatedAt = new Date();
    this.incrementVersion();

    this.recordMilestone({
      type: 'journey_paused',
      stage: this._currentStage.value,
      timestamp: new Date(),
      description: reason,
      metadata: { reason }
    });

    this.addDomainEvent(new FulfillmentJourneyPausedEvent(
      this._id,
      this._guestId,
      reason
    ));
  }

  /**
   * 恢复履约历程
   */
  public resume(): void {
    if (this._isActive) {
      throw new Error('Journey is already active');
    }

    this._isActive = true;
    this._updatedAt = new Date();
    this.incrementVersion();

    this.recordMilestone({
      type: 'journey_resumed',
      stage: this._currentStage.value,
      timestamp: new Date(),
      description: 'Journey resumed',
      metadata: {}
    });

    this.addDomainEvent(new FulfillmentJourneyResumedEvent(
      this._id,
      this._guestId
    ));
  }

  /**
   * 初始化阶段
   */
  private initializeStage(stage: FulfillmentStage): void {
    const stageProgress: StageProgress = {
      stage,
      startTime: new Date().toISOString(),
      endTime: undefined,
      qualityScore: 80, // 默认评分
      isCompleted: false,
      events: []
    };

    this._stages.set(stage.value, stageProgress);
  }

  /**
   * 完成当前阶段
   */
  private completeCurrentStage(qualityScore: number): void {
    const currentStageProgress = this._stages.get(this._currentStage.value);
    if (currentStageProgress) {
      currentStageProgress.endTime = new Date().toISOString();
      currentStageProgress.qualityScore = qualityScore;
      currentStageProgress.isCompleted = true;
    }
  }

  /**
   * 更新阶段质量评分
   */
  private updateStageQualityScore(impact: number): void {
    const currentStageProgress = this._stages.get(this._currentStage.value);
    if (currentStageProgress) {
      // 影响评分计算：正面影响提升评分，负面影响降低评分
      const newScore = Math.max(0, Math.min(100, 
        currentStageProgress.qualityScore + (impact * 0.1)
      ));
      currentStageProgress.qualityScore = newScore;
      
      // 重新计算整体评分
      this.recalculateOverallScore();
    }
  }

  /**
   * 重新计算整体评分
   */
  private recalculateOverallScore(): void {
    const stages = Array.from(this._stages.values());
    const totalScore = stages.reduce((sum, stage) => sum + stage.qualityScore, 0);
    this._overallScore = stages.length > 0 ? totalScore / stages.length : 0;
  }

  /**
   * 记录里程碑
   */
  private recordMilestone(milestone: Milestone): void {
    this._milestones.push(milestone);
  }

  /**
   * 检查履约历程是否完成
   */
  private checkJourneyCompletion(): void {
    if (this._currentStage.isFinalStage()) {
      this._endTime = new Date();
      this._isActive = false;
      
      this.recordMilestone({
        type: 'journey_completed',
        stage: this._currentStage.value,
        timestamp: new Date(),
        description: 'Fulfillment journey completed successfully',
        metadata: {
          duration: this.getDurationMinutes(),
          overallScore: this._overallScore
        }
      });

      this.addDomainEvent(new FulfillmentJourneyCompletedEvent(
        this._id,
        this._guestId,
        this.getDurationMinutes(),
        this._overallScore
      ));
    }
  }
}

/**
 * 履约事件数据
 */
export interface FulfillmentEventData {
  type: string;
  data: Record<string, any>;
  impact: number; // -100 到 100，对质量评分的影响
  source?: string;
}

/**
 * 履约事件
 */
export interface FulfillmentEvent {
  id: string;
  journeyId: string;
  guestId: string;
  type: string;
  stage: string;
  timestamp: Date;
  data: Record<string, any>;
  impact: number;
  source: string;
}

/**
 * 里程碑
 */
export interface Milestone {
  type: string;
  stage: string;
  timestamp: Date;
  description: string;
  metadata: Record<string, any>;
}

/**
 * 履约历程类型
 */
export type JourneyType = 
  | 'first_visit'     // 首次访问
  | 'repeat_visit'    // 回访
  | 'referral'        // 推荐来访
  | 'campaign'        // 营销活动
  | 'upgrade';        // 升级体验

/**
 * 履约历程元数据
 */
export interface JourneyMetadata {
  source: string;         // 流量来源
  channel: string;        // 渠道
  referrer?: string;      // 推荐人
  campaignId?: string;    // 营销活动ID
  expectedRevenue: number; // 预期收益
}

/**
 * 阶段转换上下文
 */
export interface StageTransitionContext {
  currentStageScore?: number;
  transitionReason?: string;
  userAction?: string;
  systemTrigger?: boolean;
  metadata?: Record<string, any>;
}

/**
 * 履约历程摘要
 */
export interface JourneySummary {
  journeyId: string;
  guestId: string;
  journeyType: JourneyType;
  startTime: Date;
  endTime?: Date;
  currentStage: string;
  totalStages: number;
  completedStages: number;
  overallScore: number;
  duration: number;
  eventCount: number;
  milestoneCount: number;
  isActive: boolean;
  hasBottleneck: boolean;
}

// 领域事件定义
export class FulfillmentJourneyStartedEvent implements DomainEvent {
  readonly eventId = `journey-started-${Date.now()}`;
  readonly eventType = 'FulfillmentJourneyStarted';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    public readonly guestId: string,
    public readonly journeyType: JourneyType,
    readonly eventData: JourneyMetadata
  ) {}
}

export class FulfillmentStageProgressedEvent implements DomainEvent {
  readonly eventId = `stage-progressed-${Date.now()}`;
  readonly eventType = 'FulfillmentStageProgressed';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    public readonly guestId: string,
    public readonly newStage: FulfillmentStage,
    public readonly context?: StageTransitionContext
  ) {
    this.eventData = {
      guestId,
      newStage: newStage.value,
      context
    };
  }

  readonly eventData: Record<string, any>;
}

export class FulfillmentEventRecordedEvent implements DomainEvent {
  readonly eventId = `event-recorded-${Date.now()}`;
  readonly eventType = 'FulfillmentEventRecorded';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    public readonly guestId: string,
    readonly eventData: FulfillmentEvent
  ) {}
}

export class FulfillmentJourneyCompletedEvent implements DomainEvent {
  readonly eventId = `journey-completed-${Date.now()}`;
  readonly eventType = 'FulfillmentJourneyCompleted';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    public readonly guestId: string,
    public readonly duration: number,
    public readonly overallScore: number
  ) {
    this.eventData = {
      guestId,
      duration,
      overallScore
    };
  }

  readonly eventData: Record<string, any>;
}

export class FulfillmentJourneyPausedEvent implements DomainEvent {
  readonly eventId = `journey-paused-${Date.now()}`;
  readonly eventType = 'FulfillmentJourneyPaused';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    public readonly guestId: string,
    public readonly reason: string
  ) {
    this.eventData = {
      guestId,
      reason
    };
  }

  readonly eventData: Record<string, any>;
}

export class FulfillmentJourneyResumedEvent implements DomainEvent {
  readonly eventId = `journey-resumed-${Date.now()}`;
  readonly eventType = 'FulfillmentJourneyResumed';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    public readonly guestId: string
  ) {
    this.eventData = {
      guestId
    };
  }

  readonly eventData: Record<string, any>;
}