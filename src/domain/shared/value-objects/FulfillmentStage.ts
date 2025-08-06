/**
 * 履约阶段值对象
 * 定义客人履约历程的五个核心阶段
 */
export class FulfillmentStage {
  public static readonly AWARENESS = new FulfillmentStage('awareness', '认知阶段', 0);
  public static readonly EVALUATION = new FulfillmentStage('evaluation', '评估阶段', 1);
  public static readonly BOOKING = new FulfillmentStage('booking', '预订阶段', 2);
  public static readonly EXPERIENCING = new FulfillmentStage('experiencing', '体验阶段', 3);
  public static readonly FEEDBACK = new FulfillmentStage('feedback', '反馈阶段', 4);

  private static readonly ALL_STAGES = [
    FulfillmentStage.AWARENESS,
    FulfillmentStage.EVALUATION,
    FulfillmentStage.BOOKING,
    FulfillmentStage.EXPERIENCING,
    FulfillmentStage.FEEDBACK
  ];

  private constructor(
    private readonly _value: string,
    private readonly _displayName: string,
    private readonly _order: number
  ) {}

  get value(): string {
    return this._value;
  }

  get displayName(): string {
    return this._displayName;
  }

  get order(): number {
    return this._order;
  }

  /**
   * 检查是否可以转换到目标阶段
   */
  public canTransitionTo(targetStage: FulfillmentStage): boolean {
    // 正向流程：只能向前一个阶段转换
    if (targetStage.order === this.order + 1) {
      return true;
    }
    
    // 特殊情况：反馈阶段可以回到预订阶段（复购）
    if (this._value === 'feedback' && targetStage._value === 'booking') {
      return true;
    }
    
    return false;
  }

  /**
   * 获取下一个阶段
   */
  public getNextStage(): FulfillmentStage | null {
    const nextOrder = this.order + 1;
    return FulfillmentStage.ALL_STAGES.find(stage => stage.order === nextOrder) || null;
  }

  /**
   * 检查是否是最终阶段
   */
  public isFinalStage(): boolean {
    return this._value === 'feedback';
  }

  /**
   * 从字符串值创建阶段
   */
  public static fromValue(value: string): FulfillmentStage {
    const stage = FulfillmentStage.ALL_STAGES.find(s => s.value === value);
    if (!stage) {
      throw new Error(`Invalid fulfillment stage: ${value}`);
    }
    return stage;
  }

  /**
   * 获取所有阶段
   */
  public static getAllStages(): FulfillmentStage[] {
    return [...FulfillmentStage.ALL_STAGES];
  }

  public equals(other: FulfillmentStage): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}

/**
 * 履约阶段进度
 */
export interface StageProgress {
  stage: FulfillmentStage;
  startTime: string;
  endTime?: string;
  qualityScore: number; // 0-100
  isCompleted: boolean;
  events: FulfillmentEventSummary[];
}

/**
 * 履约事件摘要
 */
export interface FulfillmentEventSummary {
  eventType: string;
  timestamp: string;
  impact: number; // 对质量评分的影响 -100 到 100
}