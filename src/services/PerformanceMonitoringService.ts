/**
 * 性能监控和统计服务
 * 基于履约驱动架构的智能性能分析系统
 */

import { Subject, BehaviorSubject, timer } from 'rxjs';
import { rxdbManager } from '../database/RxDBManager';
import { FulfillmentEventTracker } from '../domain/fulfillment/services/FulfillmentEventTracker';

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  category: 'database' | 'ui' | 'fulfillment' | 'sync' | 'system';
  threshold?: {
    warning: number;
    critical: number;
  };
}

export interface PerformanceBenchmark {
  operation: string;
  category: string;
  averageTime: number;
  minTime: number;
  maxTime: number;
  count: number;
  errorRate: number;
  lastUpdated: Date;
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  score: number; // 0-100
  issues: string[];
  recommendations: string[];
  uptime: number; // milliseconds
  lastCheck: Date;
}

export interface PerformanceReport {
  period: string;
  summary: {
    totalOperations: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number; // operations per second
  };
  benchmarks: PerformanceBenchmark[];
  topSlowOperations: Array<{
    operation: string;
    avgTime: number;
    count: number;
  }>;
  trends: {
    responseTime: Array<{ timestamp: Date; value: number }>;
    throughput: Array<{ timestamp: Date; value: number }>;
    errorRate: Array<{ timestamp: Date; value: number }>;
  };
  health: SystemHealth;
}

export class PerformanceMonitoringService {
  private metrics$ = new Subject<PerformanceMetric>();
  private systemHealth$ = new BehaviorSubject<SystemHealth>({
    overall: 'healthy',
    score: 100,
    issues: [],
    recommendations: [],
    uptime: 0,
    lastCheck: new Date()
  });
  
  private performanceData: Map<string, PerformanceMetric[]> = new Map();
  private benchmarks: Map<string, PerformanceBenchmark> = new Map();
  private operationTimings: Map<string, number[]> = new Map();
  private startTime: number = Date.now();
  
  // 性能阈值配置
  private readonly THRESHOLDS = {
    database: {
      query: { warning: 50, critical: 100 },
      insert: { warning: 100, critical: 200 },
      update: { warning: 75, critical: 150 },
      delete: { warning: 50, critical: 100 }
    },
    ui: {
      render: { warning: 16, critical: 32 }, // 60fps = 16.67ms
      interaction: { warning: 10, critical: 50 },
      navigation: { warning: 100, critical: 300 }
    },
    fulfillment: {
      stageTransition: { warning: 50, critical: 100 },
      eventProcessing: { warning: 100, critical: 250 },
      qualityCalculation: { warning: 200, critical: 500 }
    },
    sync: {
      upload: { warning: 1000, critical: 5000 },
      download: { warning: 1000, critical: 5000 },
      conflict: { warning: 500, critical: 2000 }
    },
    system: {
      memory: { warning: 100, critical: 200 }, // MB
      cpu: { warning: 70, critical: 90 } // percentage
    }
  };

  constructor(private eventTracker: FulfillmentEventTracker) {
    this.initializeMonitoring();
  }

  /**
   * 初始化性能监控
   */
  private initializeMonitoring(): void {
    // 定期收集系统性能指标
    timer(0, 5000).subscribe(() => {
      this.collectSystemMetrics();
    });

    // 定期分析性能趋势
    timer(0, 30000).subscribe(() => {
      this.analyzeTrends();
    });

    // 定期更新系统健康状态
    timer(0, 10000).subscribe(() => {
      this.updateSystemHealth();
    });

    console.log('📊 性能监控服务已启动');
  }

  /**
   * 开始性能测量
   */
  public startMeasurement(operationId: string, category: string, operation: string): void {
    const measurementId = `${operationId}-${Date.now()}`;
    performance.mark(`${measurementId}-start`);
    
    // 存储测量上下文
    (performance as any).measurementContext = (performance as any).measurementContext || {};
    (performance as any).measurementContext[measurementId] = {
      category,
      operation,
      startTime: performance.now()
    };
  }

  /**
   * 结束性能测量
   */
  public endMeasurement(operationId: string, success: boolean = true, additionalData?: any): void {
    const entries = performance.getEntriesByName(`${operationId}`, 'mark');
    if (entries.length === 0) return;

    const latestEntry = entries[entries.length - 1];
    const measurementId = latestEntry.name.replace('-start', '');
    const context = (performance as any).measurementContext?.[measurementId];
    
    if (!context) return;

    const duration = performance.now() - context.startTime;
    
    // 记录性能指标
    const metric: PerformanceMetric = {
      id: `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: context.operation,
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      category: context.category,
      threshold: this.getThreshold(context.category, context.operation)
    };

    this.recordMetric(metric);
    
    // 更新基准测试数据
    this.updateBenchmark(context.operation, context.category, duration, success);

    // 清理测量上下文
    delete (performance as any).measurementContext[measurementId];

    console.log(`⏱️ ${context.operation}: ${duration.toFixed(2)}ms ${success ? '✅' : '❌'}`);
  }

  /**
   * 记录性能指标
   */
  public recordMetric(metric: PerformanceMetric): void {
    const categoryMetrics = this.performanceData.get(metric.category) || [];
    categoryMetrics.push(metric);
    
    // 保留最近1000条记录
    if (categoryMetrics.length > 1000) {
      categoryMetrics.shift();
    }
    
    this.performanceData.set(metric.category, categoryMetrics);
    this.metrics$.next(metric);

    // 检查是否超过阈值
    if (metric.threshold) {
      if (metric.value > metric.threshold.critical) {
        console.error(`🚨 性能严重告警: ${metric.name} = ${metric.value}${metric.unit} (阈值: ${metric.threshold.critical})`);
      } else if (metric.value > metric.threshold.warning) {
        console.warn(`⚠️ 性能警告: ${metric.name} = ${metric.value}${metric.unit} (阈值: ${metric.threshold.warning})`);
      }
    }
  }

  /**
   * 更新基准测试数据
   */
  private updateBenchmark(operation: string, category: string, duration: number, success: boolean): void {
    const key = `${category}-${operation}`;
    const existing = this.benchmarks.get(key);
    
    if (existing) {
      // 更新现有基准
      existing.count++;
      existing.averageTime = ((existing.averageTime * (existing.count - 1)) + duration) / existing.count;
      existing.minTime = Math.min(existing.minTime, duration);
      existing.maxTime = Math.max(existing.maxTime, duration);
      existing.errorRate = success 
        ? existing.errorRate * 0.95 
        : existing.errorRate * 0.95 + 0.05;
      existing.lastUpdated = new Date();
    } else {
      // 创建新基准
      this.benchmarks.set(key, {
        operation,
        category,
        averageTime: duration,
        minTime: duration,
        maxTime: duration,
        count: 1,
        errorRate: success ? 0 : 1,
        lastUpdated: new Date()
      });
    }

    // 记录时间序列数据
    const timings = this.operationTimings.get(operation) || [];
    timings.push(duration);
    if (timings.length > 100) timings.shift(); // 保留最近100次
    this.operationTimings.set(operation, timings);
  }

  /**
   * 收集系统性能指标
   */
  private collectSystemMetrics(): void {
    try {
      // 内存使用情况
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        this.recordMetric({
          id: `memory-${Date.now()}`,
          name: 'memory-usage',
          value: Math.round(memInfo.usedJSHeapSize / 1024 / 1024),
          unit: 'MB',
          timestamp: new Date(),
          category: 'system',
          threshold: this.THRESHOLDS.system.memory
        });
      }

      // 数据库性能指标
      this.collectDatabaseMetrics();

      // 履约流程性能指标
      this.collectFulfillmentMetrics();

    } catch (error) {
      console.error('收集系统指标失败:', error);
    }
  }

  /**
   * 收集数据库性能指标
   */
  private async collectDatabaseMetrics(): Promise<void> {
    try {
      const guestsCollection = rxdbManager.getGuestsCollection();
      
      // 测试查询性能
      const queryStart = performance.now();
      await guestsCollection.find({ limit: 10 }).exec();
      const queryDuration = performance.now() - queryStart;
      
      this.recordMetric({
        id: `db-query-${Date.now()}`,
        name: 'database-query',
        value: queryDuration,
        unit: 'ms',
        timestamp: new Date(),
        category: 'database',
        threshold: this.THRESHOLDS.database.query
      });

      // 数据库大小指标
      const allGuests = await guestsCollection.find().exec();
      this.recordMetric({
        id: `db-size-${Date.now()}`,
        name: 'database-record-count',
        value: allGuests.length,
        unit: 'records',
        timestamp: new Date(),
        category: 'database'
      });

    } catch (error) {
      console.error('收集数据库指标失败:', error);
    }
  }

  /**
   * 收集履约流程性能指标
   */
  private collectFulfillmentMetrics(): void {
    try {
      // 事件处理性能
      const eventStats = this.getEventProcessingStats();
      
      this.recordMetric({
        id: `fulfillment-events-${Date.now()}`,
        name: 'event-processing-avg',
        value: eventStats.averageProcessingTime,
        unit: 'ms',
        timestamp: new Date(),
        category: 'fulfillment',
        threshold: this.THRESHOLDS.fulfillment.eventProcessing
      });

      this.recordMetric({
        id: `fulfillment-quality-${Date.now()}`,
        name: 'quality-calculation-avg',
        value: eventStats.averageQualityCalculationTime,
        unit: 'ms',
        timestamp: new Date(),
        category: 'fulfillment',
        threshold: this.THRESHOLDS.fulfillment.qualityCalculation
      });

    } catch (error) {
      console.error('收集履约指标失败:', error);
    }
  }

  /**
   * 获取事件处理统计信息
   */
  private getEventProcessingStats(): {
    averageProcessingTime: number;
    averageQualityCalculationTime: number;
  } {
    // 这里应该从eventTracker获取实际的处理时间统计
    // 简化版本：返回模拟数据
    return {
      averageProcessingTime: 45 + Math.random() * 20, // 45-65ms
      averageQualityCalculationTime: 120 + Math.random() * 80 // 120-200ms
    };
  }

  /**
   * 分析性能趋势
   */
  private analyzeTrends(): void {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // 分析各类别的性能趋势
      for (const [category, metrics] of this.performanceData.entries()) {
        const recentMetrics = metrics.filter(m => m.timestamp > oneHourAgo);
        
        if (recentMetrics.length > 0) {
          const avgValue = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
          const trend = this.calculateTrend(recentMetrics.map(m => m.value));
          
          console.log(`📈 ${category}性能趋势: 平均${avgValue.toFixed(2)}ms, 趋势${trend > 0 ? '上升' : trend < 0 ? '下降' : '稳定'}`);
        }
      }

    } catch (error) {
      console.error('分析性能趋势失败:', error);
    }
  }

  /**
   * 计算数据趋势
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    return secondAvg - firstAvg;
  }

  /**
   * 更新系统健康状态
   */
  private updateSystemHealth(): void {
    try {
      const now = new Date();
      const issues: string[] = [];
      const recommendations: string[] = [];
      let totalScore = 100;

      // 检查各类别性能指标
      for (const [category, benchmarks] of this.benchmarks.entries()) {
        const threshold = this.getThresholdForBenchmark(benchmarks);
        
        if (threshold) {
          if (benchmarks.averageTime > threshold.critical) {
            issues.push(`${category}性能严重低下 (${benchmarks.averageTime.toFixed(1)}ms > ${threshold.critical}ms)`);
            totalScore -= 20;
          } else if (benchmarks.averageTime > threshold.warning) {
            issues.push(`${category}性能较慢 (${benchmarks.averageTime.toFixed(1)}ms > ${threshold.warning}ms)`);
            totalScore -= 10;
          }

          if (benchmarks.errorRate > 0.05) { // 5%错误率
            issues.push(`${category}错误率过高 (${(benchmarks.errorRate * 100).toFixed(1)}%)`);
            totalScore -= 15;
          }
        }
      }

      // 生成建议
      if (issues.length === 0) {
        recommendations.push('系统运行状况良好，继续保持');
      } else {
        if (issues.some(i => i.includes('数据库'))) {
          recommendations.push('考虑优化数据库查询和索引');
        }
        if (issues.some(i => i.includes('UI') || i.includes('render'))) {
          recommendations.push('优化用户界面渲染性能');
        }
        if (issues.some(i => i.includes('履约') || i.includes('fulfillment'))) {
          recommendations.push('优化履约流程处理逻辑');
        }
        if (issues.some(i => i.includes('错误率'))) {
          recommendations.push('加强错误处理和重试机制');
        }
      }

      const overall: 'healthy' | 'warning' | 'critical' = 
        totalScore >= 80 ? 'healthy' : 
        totalScore >= 60 ? 'warning' : 'critical';

      const health: SystemHealth = {
        overall,
        score: Math.max(0, totalScore),
        issues,
        recommendations,
        uptime: now.getTime() - this.startTime,
        lastCheck: now
      };

      this.systemHealth$.next(health);

    } catch (error) {
      console.error('更新系统健康状态失败:', error);
    }
  }

  /**
   * 获取操作的性能阈值
   */
  private getThreshold(category: string, operation: string): { warning: number; critical: number } | undefined {
    const categoryThresholds = (this.THRESHOLDS as any)[category];
    if (!categoryThresholds) return undefined;

    // 尝试匹配具体操作
    for (const [key, threshold] of Object.entries(categoryThresholds)) {
      if (operation.toLowerCase().includes(key)) {
        return threshold as { warning: number; critical: number };
      }
    }

    return undefined;
  }

  /**
   * 获取基准测试的阈值
   */
  private getThresholdForBenchmark(benchmark: PerformanceBenchmark): { warning: number; critical: number } | undefined {
    return this.getThreshold(benchmark.category, benchmark.operation);
  }

  /**
   * 生成性能报告
   */
  public generatePerformanceReport(periodHours: number = 1): PerformanceReport {
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodHours * 60 * 60 * 1000);

    // 收集期间内的所有指标
    const allMetrics: PerformanceMetric[] = [];
    for (const metrics of this.performanceData.values()) {
      allMetrics.push(...metrics.filter(m => m.timestamp > periodStart));
    }

    // 计算摘要统计
    const totalOperations = allMetrics.length;
    const averageResponseTime = totalOperations > 0 
      ? allMetrics.reduce((sum, m) => sum + m.value, 0) / totalOperations 
      : 0;

    // 计算错误率（基于基准数据）
    const totalErrorRate = Array.from(this.benchmarks.values())
      .reduce((sum, b, _, arr) => sum + b.errorRate / arr.length, 0);

    // 计算吞吐量
    const throughput = totalOperations / periodHours / 3600; // ops/second

    // 获取最慢的操作
    const benchmarkArray = Array.from(this.benchmarks.values());
    const topSlowOperations = benchmarkArray
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 5)
      .map(b => ({
        operation: b.operation,
        avgTime: b.averageTime,
        count: b.count
      }));

    // 生成趋势数据（简化版）
    const responseTimeTrend = this.generateTrendData('responseTime', periodHours);
    const throughputTrend = this.generateTrendData('throughput', periodHours);
    const errorRateTrend = this.generateTrendData('errorRate', periodHours);

    return {
      period: `${periodHours}h`,
      summary: {
        totalOperations,
        averageResponseTime,
        errorRate: totalErrorRate,
        throughput
      },
      benchmarks: benchmarkArray,
      topSlowOperations,
      trends: {
        responseTime: responseTimeTrend,
        throughput: throughputTrend,
        errorRate: errorRateTrend
      },
      health: this.systemHealth$.value
    };
  }

  /**
   * 生成趋势数据
   */
  private generateTrendData(metric: string, periodHours: number): Array<{ timestamp: Date; value: number }> {
    const now = new Date();
    const points: Array<{ timestamp: Date; value: number }> = [];
    const intervalMs = (periodHours * 60 * 60 * 1000) / 10; // 10个数据点

    for (let i = 0; i < 10; i++) {
      const timestamp = new Date(now.getTime() - (9 - i) * intervalMs);
      let value = 0;

      // 基于指标类型计算值（简化版）
      switch (metric) {
        case 'responseTime':
          value = 50 + Math.sin(i * 0.5) * 20 + Math.random() * 10;
          break;
        case 'throughput':
          value = 100 + Math.cos(i * 0.3) * 30 + Math.random() * 20;
          break;
        case 'errorRate':
          value = Math.max(0, 0.02 + Math.sin(i * 0.8) * 0.01 + Math.random() * 0.005);
          break;
      }

      points.push({ timestamp, value });
    }

    return points;
  }

  /**
   * 获取性能指标流
   */
  public getMetricsStream() {
    return this.metrics$.asObservable();
  }

  /**
   * 获取系统健康状态流
   */
  public getSystemHealthStream() {
    return this.systemHealth$.asObservable();
  }

  /**
   * 获取当前基准测试数据
   */
  public getCurrentBenchmarks(): PerformanceBenchmark[] {
    return Array.from(this.benchmarks.values());
  }

  /**
   * 重置性能数据
   */
  public resetPerformanceData(): void {
    this.performanceData.clear();
    this.benchmarks.clear();
    this.operationTimings.clear();
    console.log('📊 性能数据已重置');
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.metrics$.complete();
    this.systemHealth$.complete();
    this.resetPerformanceData();
  }
}

// 全局性能监控实例
let globalPerformanceMonitor: PerformanceMonitoringService;

export const initializePerformanceMonitoring = (eventTracker: FulfillmentEventTracker) => {
  globalPerformanceMonitor = new PerformanceMonitoringService(eventTracker);
  return globalPerformanceMonitor;
};

export const getPerformanceMonitor = (): PerformanceMonitoringService => {
  if (!globalPerformanceMonitor) {
    throw new Error('Performance monitor not initialized');
  }
  return globalPerformanceMonitor;
};

/**
 * 性能装饰器 - 自动测量方法执行时间
 */
export function measurePerformance(category: string, operation?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const operationName = operation || propertyName;

    descriptor.value = function (...args: any[]) {
      const monitor = getPerformanceMonitor();
      const operationId = `${target.constructor.name}-${propertyName}-${Date.now()}`;
      
      monitor.startMeasurement(operationId, category, operationName);
      
      try {
        const result = method.apply(this, args);
        
        // 处理 Promise
        if (result && typeof result.then === 'function') {
          return result
            .then((res: any) => {
              monitor.endMeasurement(operationId, true);
              return res;
            })
            .catch((err: any) => {
              monitor.endMeasurement(operationId, false);
              throw err;
            });
        } else {
          monitor.endMeasurement(operationId, true);
          return result;
        }
      } catch (error) {
        monitor.endMeasurement(operationId, false);
        throw error;
      }
    };
  };
}