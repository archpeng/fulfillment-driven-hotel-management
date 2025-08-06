/**
 * Vitest测试环境设置
 * 为履约驱动酒店管理系统配置测试环境
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// 模拟环境变量
process.env.NODE_ENV = 'test';
process.env.VITE_APP_NAME = '履约驱动酒店管理系统';
process.env.VITE_APP_VERSION = '1.1.0';

// 全局测试配置
beforeAll(() => {
  // 模拟性能API（用于性能测试）
  global.performance = {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
  } as any;

  // 模拟IndexedDB（用于RxDB测试）
  if (!global.indexedDB) {
    const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
    const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');
    
    global.indexedDB = new FDBFactory();
    global.IDBKeyRange = FDBKeyRange;
  }

  // 模拟Web Crypto API
  if (!global.crypto) {
    global.crypto = {
      getRandomValues: vi.fn(() => new Uint8Array(32)),
      subtle: {
        digest: vi.fn(),
        encrypt: vi.fn(),
        decrypt: vi.fn(),
      },
    } as any;
  }

  // 控制台静默（减少测试输出噪音）
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  // 恢复所有mock
  vi.restoreAllMocks();
});

beforeEach(() => {
  // 每个测试前重置所有mock
  vi.clearAllMocks();
  
  // 重置时间mock
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-08-06T00:00:00Z'));
});

afterEach(() => {
  // 每个测试后清理
  vi.useRealTimers();
  vi.clearAllTimers();
});

// 全局测试工具函数
declare global {
  var createMockGuest: () => any;
  var createMockFulfillmentJourney: () => any;
  var waitForAsync: (ms?: number) => Promise<void>;
}

// 模拟Guest数据生成器
global.createMockGuest = () => ({
  id: 'guest-' + Math.random().toString(36).substr(2, 9),
  personalInfo: {
    name: '张三',
    phone: '13800138000',
    email: 'zhangsan@example.com',
    idCard: '310101199001011234'
  },
  fulfillmentHistory: {
    currentStage: 'awareness',
    stageStartTime: new Date(),
    completedStages: [],
    journeyCount: 0
  },
  businessMetrics: {
    lifetimeValue: 0,
    totalBookings: 0,
    averageRating: 0,
    referralCount: 0
  },
  tags: {
    loyaltyLevel: 'bronze',
    riskLevel: 'low',
    valueSegment: 'standard'
  },
  preferences: {
    roomType: 'deluxe',
    bedType: 'king',
    smokingPreference: 'non-smoking',
    floorPreference: 'high'
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1
});

// 模拟FulfillmentJourney数据生成器
global.createMockFulfillmentJourney = () => ({
  id: 'journey-' + Math.random().toString(36).substr(2, 9),
  guestId: 'guest-' + Math.random().toString(36).substr(2, 9),
  currentStage: 'awareness',
  overallScore: 80,
  events: [],
  milestones: [],
  isActive: true,
  stageScores: {
    awareness: 85,
    evaluation: 80,
    booking: 90,
    experiencing: 88,
    feedback: 92
  },
  metadata: {
    sourceChannel: 'website',
    deviceType: 'desktop',
    location: '上海',
    referrer: 'organic'
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1
});

// 异步等待工具函数
global.waitForAsync = (ms = 10) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// RxDB测试数据库配置
export const TEST_DB_CONFIG = {
  name: 'testdb_' + Date.now(),
  storage: 'memory',
  multiInstance: false,
  eventReduce: false,
  cleanupPolicy: {
    minimumDeletedTime: 0,
    minimumCollectionAge: 0,
    runEach: 5000
  }
};

// XState测试工具
export const createTestStateMachine = (machine: any) => {
  const testMachine = machine.withConfig({
    actions: {
      // 模拟所有actions
      ...Object.keys(machine.config.actions || {}).reduce((acc, key) => {
        acc[key] = vi.fn();
        return acc;
      }, {} as any)
    },
    guards: {
      // 模拟所有guards
      ...Object.keys(machine.config.guards || {}).reduce((acc, key) => {
        acc[key] = vi.fn(() => true);
        return acc;
      }, {} as any)
    },
    services: {
      // 模拟所有services
      ...Object.keys(machine.config.services || {}).reduce((acc, key) => {
        acc[key] = vi.fn(() => Promise.resolve());
        return acc;
      }, {} as any)
    }
  });
  
  return testMachine;
};

// 性能测试工具
export class PerformanceTimer {
  private startTime: number;
  private endTime: number;
  
  constructor() {
    this.startTime = 0;
    this.endTime = 0;
  }
  
  start(): void {
    this.startTime = performance.now();
  }
  
  stop(): number {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }
  
  getDuration(): number {
    return this.endTime - this.startTime;
  }
}

// 测试数据清理工具
export const cleanupTestData = async () => {
  // 清理IndexedDB
  if (global.indexedDB && global.indexedDB.deleteDatabase) {
    try {
      await global.indexedDB.deleteDatabase('testdb');
    } catch (error) {
      console.warn('Failed to cleanup test database:', error);
    }
  }
  
  // 清理localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  
  // 清理sessionStorage
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
};

// 导出测试常量
export const TEST_CONSTANTS = {
  PERFORMANCE_THRESHOLDS: {
    LOCAL_QUERY: 10,        // 本地查询<10ms
    STATE_TRANSITION: 50,   // 状态转换<50ms
    EVENT_PROCESSING: 100   // 事件处理<100ms
  },
  
  BATCH_SIZES: {
    SMALL: 100,
    MEDIUM: 500,
    LARGE: 1000
  },
  
  FULFILLMENT_STAGES: [
    'awareness',
    'evaluation', 
    'booking',
    'experiencing',
    'feedback'
  ],
  
  LOYALTY_LEVELS: [
    'bronze',
    'silver', 
    'gold',
    'platinum'
  ]
} as const;