import { createActor, Actor } from 'xstate';
import { fulfillmentMachine, FulfillmentContext, FulfillmentEvent, fulfillmentMachineHelpers } from './fulfillmentMachine';
import { FulfillmentJourney } from '../domain/fulfillment/aggregates/FulfillmentJourney';
import { Guest } from '../domain/guests/aggregates/Guest';

/**
 * 履约状态机服务
 * 管理XState状态机的生命周期，提供业务层面的状态管理接口
 */
export class FulfillmentXStateService {
  private actors: Map<string, Actor<typeof fulfillmentMachine>> = new Map();
  private snapshots: Map<string, any> = new Map();

  /**
   * 为客人创建新的履约状态机实例
   */
  public createJourneyActor(
    guestId: string, 
    journeyId: string, 
    metadata?: any
  ): Actor<typeof fulfillmentMachine> {
    const initialContext = fulfillmentMachineHelpers.createInitialContext(
      guestId, 
      journeyId, 
      metadata
    );

    const actor = createActor(fulfillmentMachine, {
      input: initialContext
    });

    // 监听状态变化
    actor.subscribe({
      next: (snapshot) => {
        this.handleStateChange(journeyId, snapshot);
      },
      error: (error) => {
        console.error(`Journey ${journeyId} actor error:`, error);
      },
      complete: () => {
        console.log(`Journey ${journeyId} completed`);
        this.cleanup(journeyId);
      }
    });

    // 启动状态机
    actor.start();
    
    // 存储状态机实例
    this.actors.set(journeyId, actor);
    
    return actor;
  }

  /**
   * 获取履约历程的状态机实例
   */
  public getJourneyActor(journeyId: string): Actor<typeof fulfillmentMachine> | undefined {
    return this.actors.get(journeyId);
  }

  /**
   * 发送事件到指定的履约历程
   */
  public sendEventToJourney(journeyId: string, event: FulfillmentEvent): boolean {
    const actor = this.actors.get(journeyId);
    if (!actor) {
      console.warn(`No actor found for journey ${journeyId}`);
      return false;
    }

    try {
      actor.send(event);
      return true;
    } catch (error) {
      console.error(`Error sending event to journey ${journeyId}:`, error);
      return false;
    }
  }

  /**
   * 获取履约历程的当前状态
   */
  public getJourneyState(journeyId: string): any {
    const actor = this.actors.get(journeyId);
    if (!actor) {
      return this.snapshots.get(journeyId) || null;
    }

    return actor.getSnapshot();
  }

  /**
   * 获取所有活跃的履约历程
   */
  public getActiveJourneys(): { journeyId: string; state: any }[] {
    const activeJourneys: { journeyId: string; state: any }[] = [];

    for (const [journeyId, actor] of this.actors.entries()) {
      const snapshot = actor.getSnapshot();
      if (!fulfillmentMachineHelpers.isFinalState(snapshot.value as string)) {
        activeJourneys.push({
          journeyId,
          state: snapshot
        });
      }
    }

    return activeJourneys;
  }

  /**
   * 获取按阶段分组的履约历程统计
   */
  public getJourneyStatistics(): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const [journeyId, actor] of this.actors.entries()) {
      const snapshot = actor.getSnapshot();
      const stage = snapshot.value as string;
      stats[stage] = (stats[stage] || 0) + 1;
    }

    // 添加快照中的数据
    for (const [journeyId, snapshot] of this.snapshots.entries()) {
      if (!this.actors.has(journeyId)) {
        const stage = snapshot.value as string;
        stats[stage] = (stats[stage] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * 停止指定的履约历程状态机
   */
  public stopJourney(journeyId: string): void {
    const actor = this.actors.get(journeyId);
    if (actor) {
      actor.stop();
      this.cleanup(journeyId);
    }
  }

  /**
   * 暂停履约历程（保存当前状态但停止状态机）
   */
  public pauseJourney(journeyId: string): void {
    const actor = this.actors.get(journeyId);
    if (actor) {
      const snapshot = actor.getSnapshot();
      this.snapshots.set(journeyId, snapshot);
      actor.stop();
      this.actors.delete(journeyId);
    }
  }

  /**
   * 恢复暂停的履约历程
   */
  public resumeJourney(journeyId: string): Actor<typeof fulfillmentMachine> | null {
    const savedSnapshot = this.snapshots.get(journeyId);
    if (!savedSnapshot) {
      console.warn(`No saved snapshot found for journey ${journeyId}`);
      return null;
    }

    // 使用保存的状态创建新的状态机实例
    const actor = createActor(fulfillmentMachine, {
      snapshot: savedSnapshot
    });

    // 重新订阅状态变化
    actor.subscribe({
      next: (snapshot) => {
        this.handleStateChange(journeyId, snapshot);
      },
      error: (error) => {
        console.error(`Resumed journey ${journeyId} actor error:`, error);
      },
      complete: () => {
        console.log(`Resumed journey ${journeyId} completed`);
        this.cleanup(journeyId);
      }
    });

    actor.start();
    this.actors.set(journeyId, actor);
    this.snapshots.delete(journeyId); // 清除快照

    return actor;
  }

  /**
   * 批量处理事件
   */
  public batchSendEvents(events: Array<{ journeyId: string; event: FulfillmentEvent }>): void {
    events.forEach(({ journeyId, event }) => {
      this.sendEventToJourney(journeyId, event);
    });
  }

  /**
   * 获取停滞的履约历程（在同一阶段停留过长时间）
   */
  public getStalledJourneys(thresholdMinutes: number = 1440): Array<{ journeyId: string; state: any; duration: number }> {
    const stalledJourneys: Array<{ journeyId: string; state: any; duration: number }> = [];

    for (const [journeyId, actor] of this.actors.entries()) {
      const snapshot = actor.getSnapshot();
      const context = snapshot.context;
      const duration = fulfillmentMachineHelpers.getStageDuration(context);

      if (duration > thresholdMinutes && !fulfillmentMachineHelpers.isFinalState(snapshot.value as string)) {
        stalledJourneys.push({
          journeyId,
          state: snapshot,
          duration
        });
      }
    }

    return stalledJourneys;
  }

  /**
   * 清理资源
   */
  public cleanup(journeyId?: string): void {
    if (journeyId) {
      this.actors.delete(journeyId);
      this.snapshots.delete(journeyId);
    } else {
      // 清理所有资源
      for (const actor of this.actors.values()) {
        actor.stop();
      }
      this.actors.clear();
      this.snapshots.clear();
    }
  }

  /**
   * 处理状态变化
   */
  private handleStateChange(journeyId: string, snapshot: any): void {
    const context = snapshot.context as FulfillmentContext;
    const currentState = snapshot.value as string;

    console.log(`Journey ${journeyId} transitioned to ${currentState}`, {
      stage: currentState,
      score: context.overallScore,
      events: context.eventCount,
      duration: fulfillmentMachineHelpers.getStageDuration(context)
    });

    // 可以在这里触发领域事件或更新持久化存储
    this.persistStateChange(journeyId, snapshot);

    // 检查是否需要发出警告
    this.checkWarnings(journeyId, snapshot);
  }

  /**
   * 持久化状态变化
   */
  private persistStateChange(journeyId: string, snapshot: any): void {
    // 这里应该调用仓库或者领域服务来持久化状态变化
    // 例如：更新FulfillmentJourney聚合根的状态
    console.log(`Persisting state change for journey ${journeyId}`);
    
    // TODO: 实现状态持久化逻辑
    // - 更新FulfillmentJourney聚合根
    // - 发布领域事件
    // - 更新Guest聚合根的当前阶段
  }

  /**
   * 检查警告条件
   */
  private checkWarnings(journeyId: string, snapshot: any): void {
    const context = snapshot.context as FulfillmentContext;
    const currentState = snapshot.value as string;
    const duration = fulfillmentMachineHelpers.getStageDuration(context);

    // 检查是否停滞过久
    if (duration > 1440) { // 24小时
      console.warn(`Journey ${journeyId} has been in ${currentState} for ${duration} minutes`);
      
      // 发送停滞超时事件
      this.sendEventToJourney(journeyId, { 
        type: 'TIMEOUT', 
        data: { stage: currentState, duration } 
      });
    }

    // 检查评分是否过低
    if (context.stageQualityScore < 40) {
      console.warn(`Journey ${journeyId} has low quality score: ${context.stageQualityScore}`);
    }

    // 检查错误数量
    if (context.errors.length > 3) {
      console.warn(`Journey ${journeyId} has multiple errors:`, context.errors);
    }
  }
}

/**
 * 单例服务实例
 */
export const fulfillmentStateService = new FulfillmentXStateService();