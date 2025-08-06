/**
 * DDD 聚合根基类
 * 提供领域事件发布和基础聚合功能
 */
export abstract class AggregateRoot<T> {
  protected _id: T;
  private _domainEvents: DomainEvent[] = [];
  private _version: number = 0;
  
  constructor(id: T) {
    this._id = id;
  }

  get id(): T {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  /**
   * 添加领域事件
   */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * 获取所有领域事件
   */
  public getDomainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  /**
   * 清空领域事件
   */
  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  /**
   * 递增版本号
   */
  protected incrementVersion(): void {
    this._version++;
  }
}

/**
 * 领域事件接口
 */
export interface DomainEvent {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly occurredOn: Date;
  readonly eventData: Record<string, any>;
}