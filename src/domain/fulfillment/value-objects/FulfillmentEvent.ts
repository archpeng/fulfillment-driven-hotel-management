/**
 * 履约事件值对象
 * 记录履约过程中发生的所有事件，用于分析和追踪
 */
export class FulfillmentEvent {
  public static readonly EVENT_TYPES = {
    // 认知阶段事件
    PAGE_VIEW: 'page_view',
    AD_CLICK: 'ad_click',
    SEARCH_QUERY: 'search_query',
    SOCIAL_SHARE: 'social_share',
    
    // 评估阶段事件
    DETAILS_VIEW: 'details_view',
    PHOTO_VIEW: 'photo_view',
    PRICE_CHECK: 'price_check',
    COMPARISON: 'comparison',
    INQUIRY_SUBMIT: 'inquiry_submit',
    LIVE_CHAT: 'live_chat',
    PHONE_CALL: 'phone_call',
    
    // 预订阶段事件
    BOOKING_START: 'booking_start',
    FORM_FILL: 'form_fill',
    PAYMENT_ATTEMPT: 'payment_attempt',
    PAYMENT_SUCCESS: 'payment_success',
    PAYMENT_FAILED: 'payment_failed',
    BOOKING_CONFIRMED: 'booking_confirmed',
    
    // 体验阶段事件
    CHECK_IN: 'check_in',
    ROOM_ENTRY: 'room_entry',
    SERVICE_REQUEST: 'service_request',
    COMPLAINT: 'complaint',
    COMPLIMENT: 'compliment',
    FACILITY_USE: 'facility_use',
    ADDITIONAL_PURCHASE: 'additional_purchase',
    CHECK_OUT: 'check_out',
    
    // 反馈阶段事件
    REVIEW_SUBMIT: 'review_submit',
    RATING_GIVEN: 'rating_given',
    PHOTO_UPLOAD: 'photo_upload',
    SOCIAL_POST: 'social_post',
    REFERRAL: 'referral',
    REPEAT_BOOKING: 'repeat_booking',
    
    // 系统事件
    TIMEOUT: 'timeout',
    ERROR: 'error',
    REMINDER_SENT: 'reminder_sent',
    NOTIFICATION_SENT: 'notification_sent'
  } as const;

  public static readonly IMPACT_LEVELS = {
    VERY_NEGATIVE: -20,
    NEGATIVE: -10,
    NEUTRAL: 0,
    POSITIVE: 10,
    VERY_POSITIVE: 20
  } as const;

  private readonly _id: string;
  private readonly _journeyId: string;
  private readonly _guestId: string;
  private readonly _type: string;
  private readonly _stage: string;
  private readonly _timestamp: Date;
  private readonly _data: EventData;
  private readonly _impact: number;
  private readonly _source: EventSource;
  private readonly _metadata: EventMetadata;

  constructor(
    journeyId: string,
    guestId: string,
    type: string,
    stage: string,
    data: EventData,
    impact: number = 0,
    source: EventSource = { type: 'system', identifier: 'unknown' },
    metadata: Partial<EventMetadata> = {}
  ) {
    this._id = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this._journeyId = journeyId;
    this._guestId = guestId;
    this._type = type;
    this._stage = stage;
    this._timestamp = new Date();
    this._data = data;
    this._impact = this.validateImpact(impact);
    this._source = source;
    this._metadata = {
      userAgent: '',
      ipAddress: '',
      sessionId: '',
      deviceType: 'unknown',
      ...metadata
    };
  }

  // Getters
  get id(): string { return this._id; }
  get journeyId(): string { return this._journeyId; }
  get guestId(): string { return this._guestId; }
  get type(): string { return this._type; }
  get stage(): string { return this._stage; }
  get timestamp(): Date { return this._timestamp; }
  get data(): EventData { return { ...this._data }; }
  get impact(): number { return this._impact; }
  get source(): EventSource { return { ...this._source }; }
  get metadata(): EventMetadata { return { ...this._metadata }; }

  /**
   * 检查事件是否对用户体验有正面影响
   */
  public isPositiveImpact(): boolean {
    return this._impact > 0;
  }

  /**
   * 检查事件是否对用户体验有负面影响
   */
  public isNegativeImpact(): boolean {
    return this._impact < 0;
  }

  /**
   * 获取事件的严重程度等级
   */
  public getSeverityLevel(): 'low' | 'medium' | 'high' | 'critical' {
    const absImpact = Math.abs(this._impact);
    if (absImpact >= 20) return 'critical';
    if (absImpact >= 15) return 'high';
    if (absImpact >= 5) return 'medium';
    return 'low';
  }

  /**
   * 检查是否为用户主动行为
   */
  public isUserInitiated(): boolean {
    return this._source.type === 'user' || this._source.type === 'mobile_app';
  }

  /**
   * 检查是否为系统自动事件
   */
  public isSystemGenerated(): boolean {
    return this._source.type === 'system';
  }

  /**
   * 获取事件持续时间（如果有的话）
   */
  public getDurationMs(): number | null {
    return this._data.duration_ms || null;
  }

  /**
   * 创建事件的摘要描述
   */
  public getDescription(): string {
    const descriptions: Record<string, string> = {
      [FulfillmentEvent.EVENT_TYPES.PAGE_VIEW]: '浏览页面',
      [FulfillmentEvent.EVENT_TYPES.INQUIRY_SUBMIT]: '提交咨询',
      [FulfillmentEvent.EVENT_TYPES.BOOKING_START]: '开始预订',
      [FulfillmentEvent.EVENT_TYPES.PAYMENT_SUCCESS]: '支付成功',
      [FulfillmentEvent.EVENT_TYPES.CHECK_IN]: '办理入住',
      [FulfillmentEvent.EVENT_TYPES.COMPLAINT]: '投诉反馈',
      [FulfillmentEvent.EVENT_TYPES.REVIEW_SUBMIT]: '提交评价',
      [FulfillmentEvent.EVENT_TYPES.REFERRAL]: '推荐好友'
    };

    return descriptions[this._type] || this._type;
  }

  /**
   * 转换为JSON对象（用于持久化）
   */
  public toJSON(): FulfillmentEventJson {
    return {
      id: this._id,
      journeyId: this._journeyId,
      guestId: this._guestId,
      type: this._type,
      stage: this._stage,
      timestamp: this._timestamp.toISOString(),
      data: this._data,
      impact: this._impact,
      source: this._source,
      metadata: this._metadata
    };
  }

  /**
   * 从JSON对象创建事件实例
   */
  public static fromJSON(json: FulfillmentEventJson): FulfillmentEvent {
    const event = new FulfillmentEvent(
      json.journeyId,
      json.guestId,
      json.type,
      json.stage,
      json.data,
      json.impact,
      json.source,
      json.metadata
    );
    
    // 使用反射设置私有属性（仅用于反序列化）
    (event as any)._id = json.id;
    (event as any)._timestamp = new Date(json.timestamp);
    
    return event;
  }

  /**
   * 验证影响值的有效性
   */
  private validateImpact(impact: number): number {
    return Math.max(-100, Math.min(100, impact));
  }
}

/**
 * 事件数据接口
 */
export interface EventData {
  // 通用字段
  value?: string | number;
  duration_ms?: number;
  url?: string;
  page?: string;
  
  // 特定事件字段
  room_type?: string;
  price?: number;
  rating?: number;
  comment?: string;
  service_type?: string;
  issue_type?: string;
  referral_code?: string;
  
  // 扩展字段
  custom_fields?: Record<string, any>;
}

/**
 * 事件源信息
 */
export interface EventSource {
  type: 'user' | 'system' | 'staff' | 'mobile_app' | 'web_app' | 'api' | 'third_party';
  identifier: string; // 用户ID、系统组件名、API客户端等
  version?: string;   // 应用版本或API版本
}

/**
 * 事件元数据
 */
export interface EventMetadata {
  userAgent: string;
  ipAddress: string;
  sessionId: string;
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  location?: {
    country?: string;
    city?: string;
    coordinates?: [number, number]; // [longitude, latitude]
  };
  referrer?: string;
  campaign?: {
    source?: string;
    medium?: string;
    name?: string;
  };
}

/**
 * 事件JSON序列化格式
 */
export interface FulfillmentEventJson {
  id: string;
  journeyId: string;
  guestId: string;
  type: string;
  stage: string;
  timestamp: string; // ISO 8601
  data: EventData;
  impact: number;
  source: EventSource;
  metadata: EventMetadata;
}

/**
 * 事件工厂类
 * 提供创建常见事件的便捷方法
 */
export class FulfillmentEventFactory {
  /**
   * 创建页面浏览事件
   */
  public static createPageViewEvent(
    journeyId: string,
    guestId: string,
    stage: string,
    url: string,
    durationMs?: number
  ): FulfillmentEvent {
    return new FulfillmentEvent(
      journeyId,
      guestId,
      FulfillmentEvent.EVENT_TYPES.PAGE_VIEW,
      stage,
      { url, duration_ms: durationMs },
      FulfillmentEvent.IMPACT_LEVELS.NEUTRAL,
      { type: 'web_app', identifier: 'web_client' }
    );
  }

  /**
   * 创建咨询提交事件
   */
  public static createInquiryEvent(
    journeyId: string,
    guestId: string,
    stage: string,
    inquiryType: string,
    urgency: 'low' | 'medium' | 'high' = 'medium'
  ): FulfillmentEvent {
    const impactMap = {
      low: FulfillmentEvent.IMPACT_LEVELS.POSITIVE,
      medium: FulfillmentEvent.IMPACT_LEVELS.POSITIVE,
      high: FulfillmentEvent.IMPACT_LEVELS.VERY_POSITIVE
    };

    return new FulfillmentEvent(
      journeyId,
      guestId,
      FulfillmentEvent.EVENT_TYPES.INQUIRY_SUBMIT,
      stage,
      { service_type: inquiryType, value: urgency },
      impactMap[urgency],
      { type: 'user', identifier: guestId }
    );
  }

  /**
   * 创建支付成功事件
   */
  public static createPaymentSuccessEvent(
    journeyId: string,
    guestId: string,
    amount: number,
    paymentMethod: string
  ): FulfillmentEvent {
    return new FulfillmentEvent(
      journeyId,
      guestId,
      FulfillmentEvent.EVENT_TYPES.PAYMENT_SUCCESS,
      'booking',
      { price: amount, value: paymentMethod },
      FulfillmentEvent.IMPACT_LEVELS.VERY_POSITIVE,
      { type: 'user', identifier: guestId }
    );
  }

  /**
   * 创建投诉事件
   */
  public static createComplaintEvent(
    journeyId: string,
    guestId: string,
    stage: string,
    issueType: string,
    severity: number = 5
  ): FulfillmentEvent {
    const impact = Math.max(-20, -severity * 2);
    
    return new FulfillmentEvent(
      journeyId,
      guestId,
      FulfillmentEvent.EVENT_TYPES.COMPLAINT,
      stage,
      { issue_type: issueType, value: severity },
      impact,
      { type: 'user', identifier: guestId }
    );
  }

  /**
   * 创建评价提交事件
   */
  public static createReviewEvent(
    journeyId: string,
    guestId: string,
    rating: number,
    comment?: string
  ): FulfillmentEvent {
    // 根据评分计算影响值
    const impact = (rating - 3) * 5; // 1星=-10, 3星=0, 5星=10
    
    return new FulfillmentEvent(
      journeyId,
      guestId,
      FulfillmentEvent.EVENT_TYPES.REVIEW_SUBMIT,
      'feedback',
      { rating, comment },
      impact,
      { type: 'user', identifier: guestId }
    );
  }

  /**
   * 创建推荐事件
   */
  public static createReferralEvent(
    journeyId: string,
    guestId: string,
    referralCode?: string
  ): FulfillmentEvent {
    return new FulfillmentEvent(
      journeyId,
      guestId,
      FulfillmentEvent.EVENT_TYPES.REFERRAL,
      'feedback',
      { referral_code: referralCode },
      FulfillmentEvent.IMPACT_LEVELS.VERY_POSITIVE,
      { type: 'user', identifier: guestId }
    );
  }

  /**
   * 创建超时事件
   */
  public static createTimeoutEvent(
    journeyId: string,
    guestId: string,
    stage: string,
    durationMs: number
  ): FulfillmentEvent {
    return new FulfillmentEvent(
      journeyId,
      guestId,
      FulfillmentEvent.EVENT_TYPES.TIMEOUT,
      stage,
      { duration_ms: durationMs },
      FulfillmentEvent.IMPACT_LEVELS.NEGATIVE,
      { type: 'system', identifier: 'timeout_monitor' }
    );
  }
}