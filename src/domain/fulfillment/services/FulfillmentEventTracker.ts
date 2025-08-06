import { FulfillmentEvent, FulfillmentEventFactory, EventData, EventSource, EventMetadata } from '../value-objects/FulfillmentEvent';

/**
 * 履约事件追踪器
 * 负责收集、验证和分析履约过程中的事件
 */
export class FulfillmentEventTracker {
  private events: Map<string, FulfillmentEvent[]> = new Map(); // journeyId -> events[]
  private eventQueue: FulfillmentEvent[] = []; // 待处理事件队列
  private listeners: EventListener[] = [];
  private isProcessing: boolean = false;

  /**
   * 记录履约事件
   */
  public trackEvent(
    journeyId: string,
    guestId: string,
    eventType: string,
    stage: string,
    data: EventData = {},
    impact: number = 0,
    source?: EventSource,
    metadata?: Partial<EventMetadata>
  ): FulfillmentEvent {
    
    // 创建事件实例
    const event = new FulfillmentEvent(
      journeyId,
      guestId,
      eventType,
      stage,
      data,
      impact,
      source,
      metadata
    );

    // 验证事件
    this.validateEvent(event);

    // 存储事件
    this.storeEvent(event);

    // 加入处理队列
    this.eventQueue.push(event);

    // 异步处理事件
    this.processEventQueue();

    return event;
  }

  /**
   * 批量记录事件
   */
  public trackEvents(events: Array<{
    journeyId: string;
    guestId: string;
    eventType: string;
    stage: string;
    data?: EventData;
    impact?: number;
    source?: EventSource;
    metadata?: Partial<EventMetadata>;
  }>): FulfillmentEvent[] {
    
    const createdEvents: FulfillmentEvent[] = [];
    
    events.forEach(eventData => {
      try {
        const event = this.trackEvent(
          eventData.journeyId,
          eventData.guestId,
          eventData.eventType,
          eventData.stage,
          eventData.data,
          eventData.impact,
          eventData.source,
          eventData.metadata
        );
        createdEvents.push(event);
      } catch (error) {
        console.error(`Failed to track event for journey ${eventData.journeyId}:`, error);
      }
    });

    return createdEvents;
  }

  /**
   * 获取履约历程的所有事件
   */
  public getJourneyEvents(journeyId: string): FulfillmentEvent[] {
    return this.events.get(journeyId) || [];
  }

  /**
   * 获取特定类型的事件
   */
  public getEventsByType(journeyId: string, eventType: string): FulfillmentEvent[] {
    const journeyEvents = this.getJourneyEvents(journeyId);
    return journeyEvents.filter(event => event.type === eventType);
  }

  /**
   * 获取特定阶段的事件
   */
  public getEventsByStage(journeyId: string, stage: string): FulfillmentEvent[] {
    const journeyEvents = this.getJourneyEvents(journeyId);
    return journeyEvents.filter(event => event.stage === stage);
  }

  /**
   * 获取时间范围内的事件
   */
  public getEventsInTimeRange(
    journeyId: string, 
    startTime: Date, 
    endTime: Date
  ): FulfillmentEvent[] {
    const journeyEvents = this.getJourneyEvents(journeyId);
    return journeyEvents.filter(event => 
      event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  /**
   * 分析履约事件模式
   */
  public analyzeEventPatterns(journeyId: string): EventPatternAnalysis {
    const events = this.getJourneyEvents(journeyId);
    
    if (events.length === 0) {
      return {
        totalEvents: 0,
        eventTypes: {},
        stageDistribution: {},
        impactAnalysis: { positive: 0, negative: 0, neutral: 0, total: 0 },
        timelineAnalysis: { averageGap: 0, longestGap: 0, shortestGap: 0 },
        engagementScore: 0,
        riskIndicators: []
      };
    }

    return {
      totalEvents: events.length,
      eventTypes: this.analyzeEventTypes(events),
      stageDistribution: this.analyzeStageDistribution(events),
      impactAnalysis: this.analyzeImpact(events),
      timelineAnalysis: this.analyzeTimeline(events),
      engagementScore: this.calculateEngagementScore(events),
      riskIndicators: this.identifyRiskIndicators(events)
    };
  }

  /**
   * 计算履约质量评分
   */
  public calculateQualityScore(journeyId: string): number {
    const events = this.getJourneyEvents(journeyId);
    
    if (events.length === 0) return 80; // 默认评分

    const totalImpact = events.reduce((sum, event) => sum + event.impact, 0);
    const baseScore = 80;
    const impactWeight = 0.2; // 影响权重
    
    // 基于事件影响计算分数调整
    const scoreAdjustment = totalImpact * impactWeight;
    
    return Math.max(0, Math.min(100, baseScore + scoreAdjustment));
  }

  /**
   * 识别异常事件
   */
  public identifyAnomalies(journeyId: string): EventAnomaly[] {
    const events = this.getJourneyEvents(journeyId);
    const anomalies: EventAnomaly[] = [];

    // 识别高频事件
    const eventCounts = new Map<string, number>();
    events.forEach(event => {
      eventCounts.set(event.type, (eventCounts.get(event.type) || 0) + 1);
    });

    eventCounts.forEach((count, eventType) => {
      if (count > 10) { // 同类型事件超过10次
        anomalies.push({
          type: 'high_frequency',
          description: `Event type ${eventType} occurred ${count} times`,
          severity: count > 20 ? 'high' : 'medium',
          events: events.filter(e => e.type === eventType)
        });
      }
    });

    // 识别高影响负面事件
    const negativeEvents = events.filter(e => e.impact < -10);
    if (negativeEvents.length > 0) {
      anomalies.push({
        type: 'negative_impact',
        description: `Found ${negativeEvents.length} high negative impact events`,
        severity: negativeEvents.length > 3 ? 'high' : 'medium',
        events: negativeEvents
      });
    }

    // 识别时间异常（长时间无事件）
    if (events.length > 1) {
      const timeGaps = this.calculateTimeGaps(events);
      const longGaps = timeGaps.filter(gap => gap > 24 * 60 * 60 * 1000); // 超过24小时
      
      if (longGaps.length > 0) {
        anomalies.push({
          type: 'long_silence',
          description: `Found ${longGaps.length} periods of inactivity longer than 24 hours`,
          severity: 'medium',
          events: []
        });
      }
    }

    return anomalies;
  }

  /**
   * 添加事件监听器
   */
  public addListener(listener: EventListener): void {
    this.listeners.push(listener);
  }

  /**
   * 移除事件监听器
   */
  public removeListener(listener: EventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 清理履约历程的事件
   */
  public clearJourneyEvents(journeyId: string): void {
    this.events.delete(journeyId);
  }

  /**
   * 导出事件数据
   */
  public exportEvents(journeyId?: string): FulfillmentEvent[] {
    if (journeyId) {
      return this.getJourneyEvents(journeyId);
    }
    
    const allEvents: FulfillmentEvent[] = [];
    for (const events of this.events.values()) {
      allEvents.push(...events);
    }
    
    return allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * 验证事件
   */
  private validateEvent(event: FulfillmentEvent): void {
    if (!event.journeyId || !event.guestId) {
      throw new Error('Event must have valid journeyId and guestId');
    }
    
    if (!event.type || !event.stage) {
      throw new Error('Event must have valid type and stage');
    }
    
    if (Math.abs(event.impact) > 100) {
      throw new Error('Event impact must be between -100 and 100');
    }
  }

  /**
   * 存储事件
   */
  private storeEvent(event: FulfillmentEvent): void {
    const journeyEvents = this.events.get(event.journeyId) || [];
    journeyEvents.push(event);
    this.events.set(event.journeyId, journeyEvents);
  }

  /**
   * 处理事件队列
   */
  private async processEventQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        await this.processEvent(event);
      }
    } catch (error) {
      console.error('Error processing event queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 处理单个事件
   */
  private async processEvent(event: FulfillmentEvent): Promise<void> {
    // 通知所有监听器
    for (const listener of this.listeners) {
      try {
        await listener.onEvent(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    }

    // 可以在这里添加其他处理逻辑，如持久化、发送到分析服务等
    console.log(`Processed event: ${event.type} for journey ${event.journeyId}`);
  }

  /**
   * 分析事件类型分布
   */
  private analyzeEventTypes(events: FulfillmentEvent[]): Record<string, number> {
    const types: Record<string, number> = {};
    events.forEach(event => {
      types[event.type] = (types[event.type] || 0) + 1;
    });
    return types;
  }

  /**
   * 分析阶段分布
   */
  private analyzeStageDistribution(events: FulfillmentEvent[]): Record<string, number> {
    const stages: Record<string, number> = {};
    events.forEach(event => {
      stages[event.stage] = (stages[event.stage] || 0) + 1;
    });
    return stages;
  }

  /**
   * 分析影响分布
   */
  private analyzeImpact(events: FulfillmentEvent[]): ImpactAnalysis {
    const analysis: ImpactAnalysis = {
      positive: 0,
      negative: 0,
      neutral: 0,
      total: 0
    };

    events.forEach(event => {
      if (event.impact > 0) {
        analysis.positive += event.impact;
      } else if (event.impact < 0) {
        analysis.negative += Math.abs(event.impact);
      } else {
        analysis.neutral++;
      }
      analysis.total += event.impact;
    });

    return analysis;
  }

  /**
   * 分析时间线
   */
  private analyzeTimeline(events: FulfillmentEvent[]): TimelineAnalysis {
    if (events.length < 2) {
      return { averageGap: 0, longestGap: 0, shortestGap: 0 };
    }

    const sortedEvents = events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const gaps = this.calculateTimeGaps(sortedEvents);

    return {
      averageGap: gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length,
      longestGap: Math.max(...gaps),
      shortestGap: Math.min(...gaps)
    };
  }

  /**
   * 计算时间间隔
   */
  private calculateTimeGaps(sortedEvents: FulfillmentEvent[]): number[] {
    const gaps: number[] = [];
    for (let i = 1; i < sortedEvents.length; i++) {
      const gap = sortedEvents[i].timestamp.getTime() - sortedEvents[i - 1].timestamp.getTime();
      gaps.push(gap);
    }
    return gaps;
  }

  /**
   * 计算参与度评分
   */
  private calculateEngagementScore(events: FulfillmentEvent[]): number {
    if (events.length === 0) return 0;

    const userInitiatedEvents = events.filter(e => e.isUserInitiated());
    const engagementRatio = userInitiatedEvents.length / events.length;
    const eventFrequency = events.length / 7; // 假设7天的观察期
    
    return Math.min(100, (engagementRatio * 50) + (eventFrequency * 10));
  }

  /**
   * 识别风险指标
   */
  private identifyRiskIndicators(events: FulfillmentEvent[]): string[] {
    const indicators: string[] = [];
    
    const complaints = events.filter(e => e.type === FulfillmentEvent.EVENT_TYPES.COMPLAINT);
    if (complaints.length > 2) {
      indicators.push('Multiple complaints');
    }
    
    const negativeEvents = events.filter(e => e.impact < -5);
    if (negativeEvents.length > events.length * 0.3) {
      indicators.push('High negative impact ratio');
    }
    
    const recentEvents = events.filter(e => 
      Date.now() - e.timestamp.getTime() < 24 * 60 * 60 * 1000
    );
    if (recentEvents.length === 0 && events.length > 0) {
      indicators.push('No recent activity');
    }

    return indicators;
  }
}

/**
 * 事件模式分析结果
 */
export interface EventPatternAnalysis {
  totalEvents: number;
  eventTypes: Record<string, number>;
  stageDistribution: Record<string, number>;
  impactAnalysis: ImpactAnalysis;
  timelineAnalysis: TimelineAnalysis;
  engagementScore: number;
  riskIndicators: string[];
}

/**
 * 影响分析
 */
export interface ImpactAnalysis {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

/**
 * 时间线分析
 */
export interface TimelineAnalysis {
  averageGap: number; // 平均时间间隔（毫秒）
  longestGap: number; // 最长时间间隔
  shortestGap: number; // 最短时间间隔
}

/**
 * 事件异常
 */
export interface EventAnomaly {
  type: 'high_frequency' | 'negative_impact' | 'long_silence' | 'unusual_pattern';
  description: string;
  severity: 'low' | 'medium' | 'high';
  events: FulfillmentEvent[];
}

/**
 * 事件监听器接口
 */
export interface EventListener {
  onEvent(event: FulfillmentEvent): Promise<void> | void;
}

/**
 * 全局事件追踪器实例
 */
export const globalEventTracker = new FulfillmentEventTracker();