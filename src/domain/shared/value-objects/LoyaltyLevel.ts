/**
 * 忠诚度等级值对象
 * 基于客人的履约表现和商业价值确定忠诚度等级
 */
export class LoyaltyLevel {
  public static readonly BRONZE = new LoyaltyLevel('bronze', '铜牌客人', 0, '#CD7F32');
  public static readonly SILVER = new LoyaltyLevel('silver', '银牌客人', 1, '#C0C0C0');
  public static readonly GOLD = new LoyaltyLevel('gold', '金牌客人', 2, '#FFD700');
  public static readonly PLATINUM = new LoyaltyLevel('platinum', '白金客人', 3, '#E5E4E2');

  private static readonly ALL_LEVELS = [
    LoyaltyLevel.BRONZE,
    LoyaltyLevel.SILVER,
    LoyaltyLevel.GOLD,
    LoyaltyLevel.PLATINUM
  ];

  private constructor(
    private readonly _value: string,
    private readonly _displayName: string,
    private readonly _tier: number,
    private readonly _color: string
  ) {}

  get value(): string {
    return this._value;
  }

  get displayName(): string {
    return this._displayName;
  }

  get tier(): number {
    return this._tier;
  }

  get color(): string {
    return this._color;
  }

  /**
   * 基于客人指标计算忠诚度等级
   */
  public static calculateLevel(metrics: {
    totalValue: number;
    visitCount: number;
    averageRating: number;
    referralCount: number;
    monthsSinceFirstVisit: number;
  }): LoyaltyLevel {
    const score = this.calculateLoyaltyScore(metrics);
    
    if (score >= 80) return LoyaltyLevel.PLATINUM;
    if (score >= 60) return LoyaltyLevel.GOLD;
    if (score >= 30) return LoyaltyLevel.SILVER;
    return LoyaltyLevel.BRONZE;
  }

  /**
   * 计算忠诚度评分 (0-100)
   */
  private static calculateLoyaltyScore(metrics: {
    totalValue: number;
    visitCount: number;
    averageRating: number;
    referralCount: number;
    monthsSinceFirstVisit: number;
  }): number {
    // 消费价值权重 (40%)
    const valueScore = Math.min(metrics.totalValue / 10000, 1) * 40;
    
    // 访问频次权重 (25%)
    const frequencyScore = Math.min(metrics.visitCount / 10, 1) * 25;
    
    // 满意度权重 (20%)
    const satisfactionScore = (metrics.averageRating / 5) * 20;
    
    // 推荐贡献权重 (10%)
    const referralScore = Math.min(metrics.referralCount / 5, 1) * 10;
    
    // 关系时长权重 (5%)
    const tenureScore = Math.min(metrics.monthsSinceFirstVisit / 12, 1) * 5;
    
    return Math.round(valueScore + frequencyScore + satisfactionScore + referralScore + tenureScore);
  }

  /**
   * 检查是否可以升级到目标等级
   */
  public canUpgradeTo(targetLevel: LoyaltyLevel): boolean {
    return targetLevel.tier > this.tier;
  }

  /**
   * 获取等级权益描述
   */
  public getBenefits(): string[] {
    switch (this._value) {
      case 'platinum':
        return [
          '专属客服热线',
          '免费房间升级',
          '延迟退房至下午2点',
          '免费接送机服务',
          '生日惊喜礼品',
          '专属欢迎礼品'
        ];
      case 'gold':
        return [
          '优先预订权',
          '免费WiFi升级',
          '延迟退房至中午12点',
          '积分双倍奖励',
          '免费早餐'
        ];
      case 'silver':
        return [
          '会员专享价格',
          '积分奖励',
          '免费房间WiFi',
          '生日祝福'
        ];
      case 'bronze':
        return [
          '积分累积',
          '会员通讯',
          '特价活动通知'
        ];
      default:
        return [];
    }
  }

  /**
   * 从字符串值创建等级
   */
  public static fromValue(value: string): LoyaltyLevel {
    const level = LoyaltyLevel.ALL_LEVELS.find(l => l.value === value);
    if (!level) {
      throw new Error(`Invalid loyalty level: ${value}`);
    }
    return level;
  }

  /**
   * 获取所有等级
   */
  public static getAllLevels(): LoyaltyLevel[] {
    return [...LoyaltyLevel.ALL_LEVELS];
  }

  public equals(other: LoyaltyLevel): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}