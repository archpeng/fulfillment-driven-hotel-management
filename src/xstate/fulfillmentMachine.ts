import { createMachine, assign, sendTo, spawn } from 'xstate';
import { FulfillmentStage } from '../domain/shared/value-objects/FulfillmentStage';

/**
 * 履约历程状态机配置
 * 定义客人履约历程的完整状态流转逻辑
 */

// 状态机上下文类型
export interface FulfillmentContext {
  guestId: string;
  journeyId: string;
  currentStage: string;
  stageStartTime: number;
  stageQualityScore: number;
  overallScore: number;
  eventCount: number;
  milestones: Milestone[];
  metadata: {
    source?: string;
    channel?: string;
    referrer?: string;
    campaignId?: string;
  };
  errors: string[];
}

// 状态机事件类型
export type FulfillmentEvent = 
  | { type: 'SHOW_INTEREST'; data?: { source?: string; engagement?: number } }
  | { type: 'ASK_QUESTION'; data?: { question: string; channel?: string } }
  | { type: 'VIEW_DETAILS'; data?: { page?: string; duration?: number } }
  | { type: 'MAKE_BOOKING'; data?: { roomType?: string; amount?: number } }
  | { type: 'CONFIRM_PAYMENT'; data?: { paymentMethod?: string; amount?: number } }
  | { type: 'CANCEL_BOOKING'; data?: { reason?: string; refundAmount?: number } }
  | { type: 'CHECK_IN'; data?: { actualTime?: number; roomNumber?: string } }
  | { type: 'REQUEST_SERVICE'; data?: { serviceType?: string; urgency?: 'low' | 'medium' | 'high' } }
  | { type: 'REPORT_ISSUE'; data?: { issueType?: string; severity?: number } }
  | { type: 'CHECK_OUT'; data?: { actualTime?: number; finalBill?: number } }
  | { type: 'LEAVE_REVIEW'; data?: { rating?: number; comment?: string } }
  | { type: 'RECOMMEND_FRIEND'; data?: { friendContact?: string; incentive?: string } }
  | { type: 'START_NEW_JOURNEY'; data?: { journeyType?: string } }
  | { type: 'ABANDON'; data?: { reason?: string; stage?: string } }
  | { type: 'NO_SHOW'; data?: { expectedTime?: number } }
  | { type: 'TIMEOUT'; data?: { stage?: string; duration?: number } }
  | { type: 'UPDATE_SCORE'; data?: { impact?: number; reason?: string } }
  | { type: 'RECORD_MILESTONE'; data?: Milestone };

// 里程碑类型
interface Milestone {
  type: string;
  timestamp: number;
  stage: string;
  description: string;
  data?: Record<string, any>;
}

/**
 * 履约历程状态机
 */
export const fulfillmentMachine = createMachine({
  id: 'fulfillment',
  initial: 'awareness',
  types: {} as {
    context: FulfillmentContext;
    events: FulfillmentEvent;
  },
  context: {
    guestId: '',
    journeyId: '',
    currentStage: 'awareness',
    stageStartTime: Date.now(),
    stageQualityScore: 80,
    overallScore: 80,
    eventCount: 0,
    milestones: [],
    metadata: {},
    errors: []
  },
  states: {
    // 认知阶段
    awareness: {
      id: 'awareness',
      entry: ['enterStage', 'startStageTimer'],
      exit: 'exitStage',
      on: {
        SHOW_INTEREST: {
          target: 'evaluation',
          actions: ['recordEvent', 'updateScore']
        },
        VIEW_DETAILS: {
          actions: ['recordEvent', 'updateScore']
        },
        ABANDON: {
          target: 'lost',
          actions: ['recordEvent', 'recordMilestone']
        },
        TIMEOUT: {
          target: 'stalled',
          actions: ['recordEvent', 'flagTimeout']
        }
      },
      after: {
        // 24小时后如果没有进展，标记为超时
        86400000: { target: 'stalled', actions: 'flagTimeout' }
      }
    },

    // 评估阶段
    evaluation: {
      id: 'evaluation',
      entry: ['enterStage', 'startStageTimer'],
      exit: 'exitStage',
      on: {
        ASK_QUESTION: {
          actions: ['recordEvent', 'updateScore']
        },
        VIEW_DETAILS: {
          actions: ['recordEvent', 'updateScore']
        },
        MAKE_BOOKING: {
          target: 'booking',
          actions: ['recordEvent', 'updateScore', 'recordMilestone']
        },
        ABANDON: {
          target: 'lost',
          actions: ['recordEvent', 'recordMilestone']
        },
        TIMEOUT: {
          target: 'stalled',
          actions: ['recordEvent', 'flagTimeout']
        }
      },
      after: {
        // 72小时后如果没有预订，标记为超时
        259200000: { target: 'stalled', actions: 'flagTimeout' }
      }
    },

    // 预订阶段
    booking: {
      id: 'booking',
      entry: ['enterStage', 'startStageTimer'],
      exit: 'exitStage',
      on: {
        CONFIRM_PAYMENT: {
          target: 'confirmed',
          actions: ['recordEvent', 'updateScore', 'recordMilestone']
        },
        CANCEL_BOOKING: {
          target: 'cancelled',
          actions: ['recordEvent', 'recordMilestone']
        },
        TIMEOUT: {
          target: 'expired',
          actions: ['recordEvent', 'flagTimeout']
        }
      },
      after: {
        // 30分钟后如果没有支付，标记为过期
        1800000: { target: 'expired', actions: 'flagTimeout' }
      }
    },

    // 预订确认
    confirmed: {
      id: 'confirmed',
      entry: ['enterStage', 'startStageTimer'],
      exit: 'exitStage',
      on: {
        CHECK_IN: {
          target: 'experiencing',
          actions: ['recordEvent', 'updateScore', 'recordMilestone']
        },
        CANCEL_BOOKING: {
          target: 'cancelled',
          actions: ['recordEvent', 'recordMilestone']
        },
        NO_SHOW: {
          target: 'noShow',
          actions: ['recordEvent', 'recordMilestone']
        }
      }
    },

    // 体验阶段
    experiencing: {
      id: 'experiencing',
      entry: ['enterStage', 'startStageTimer'],
      exit: 'exitStage',
      on: {
        REQUEST_SERVICE: {
          actions: ['recordEvent', 'updateScore']
        },
        REPORT_ISSUE: {
          actions: ['recordEvent', 'updateScore']
        },
        CHECK_OUT: {
          target: 'completed',
          actions: ['recordEvent', 'updateScore', 'recordMilestone']
        }
      },
      // 体验阶段可能有多个并行的子状态
      type: 'parallel',
      states: {
        serviceMonitoring: {
          initial: 'monitoring',
          states: {
            monitoring: {
              on: {
                REQUEST_SERVICE: 'servicing'
              }
            },
            servicing: {
              on: {
                // 服务完成后回到监控状态
                // 这里可以添加服务完成的事件
              }
            }
          }
        },
        satisfactionTracking: {
          initial: 'tracking',
          states: {
            tracking: {
              on: {
                REPORT_ISSUE: 'addressing'
              }
            },
            addressing: {
              on: {
                // 问题解决后回到跟踪状态
              }
            }
          }
        }
      }
    },

    // 体验完成
    completed: {
      id: 'completed',
      entry: ['enterStage', 'startStageTimer'],
      exit: 'exitStage',
      on: {
        LEAVE_REVIEW: {
          target: 'reviewed',
          actions: ['recordEvent', 'updateScore', 'recordMilestone']
        },
        START_NEW_JOURNEY: {
          target: 'booking',
          actions: ['recordEvent', 'resetForNewJourney']
        }
      },
      after: {
        // 7天后如果没有评价，自动进入评价阶段
        604800000: { 
          target: 'reviewed', 
          actions: ['recordEvent', 'autoCompleteReview'] 
        }
      }
    },

    // 已评价
    reviewed: {
      id: 'reviewed',
      entry: ['enterStage', 'calculateFinalScore'],
      type: 'final',
      on: {
        RECOMMEND_FRIEND: {
          actions: ['recordEvent', 'updateScore', 'recordMilestone']
        },
        START_NEW_JOURNEY: {
          target: 'booking',
          actions: ['recordEvent', 'resetForNewJourney']
        }
      }
    },

    // 异常状态
    lost: {
      id: 'lost',
      entry: ['enterStage', 'recordLoss'],
      type: 'final'
    },

    cancelled: {
      id: 'cancelled',
      entry: ['enterStage', 'recordCancellation'],
      type: 'final'
    },

    expired: {
      id: 'expired',
      entry: ['enterStage', 'recordExpiry'],
      type: 'final'
    },

    noShow: {
      id: 'noShow',
      entry: ['enterStage', 'recordNoShow'],
      type: 'final'
    },

    stalled: {
      id: 'stalled',
      entry: ['enterStage', 'recordStall'],
      on: {
        // 可以从停滞状态恢复
        SHOW_INTEREST: 'evaluation',
        MAKE_BOOKING: 'booking'
      }
    }
  }
}, {
  actions: {
    // 进入阶段
    enterStage: assign({
      currentStage: ({ context }, event) => {
        // 从当前状态ID获取阶段名称
        return event.type;
      },
      stageStartTime: () => Date.now(),
      stageQualityScore: 80 // 重置阶段评分
    }),

    // 开始阶段计时
    startStageTimer: () => {
      // 可以在这里启动阶段计时逻辑
      console.log('Stage timer started');
    },

    // 退出阶段
    exitStage: ({ context }) => {
      console.log(`Exiting stage: ${context.currentStage}`);
    },

    // 记录事件
    recordEvent: assign({
      eventCount: ({ context }) => context.eventCount + 1
    }),

    // 更新评分
    updateScore: assign({
      stageQualityScore: ({ context }, event) => {
        const impact = event.data?.impact || 0;
        return Math.max(0, Math.min(100, context.stageQualityScore + impact));
      },
      overallScore: ({ context }, event) => {
        const impact = event.data?.impact || 0;
        return Math.max(0, Math.min(100, context.overallScore + impact * 0.1));
      }
    }),

    // 记录里程碑
    recordMilestone: assign({
      milestones: ({ context }, event) => [
        ...context.milestones,
        {
          type: event.type,
          timestamp: Date.now(),
          stage: context.currentStage,
          description: `Event: ${event.type}`,
          data: event.data
        }
      ]
    }),

    // 计算最终评分
    calculateFinalScore: assign({
      overallScore: ({ context }) => {
        // 基于整个履约历程计算最终评分
        const milestoneBonus = context.milestones.length * 2;
        return Math.min(100, context.overallScore + milestoneBonus);
      }
    }),

    // 标记超时
    flagTimeout: assign({
      errors: ({ context }) => [
        ...context.errors,
        `Stage ${context.currentStage} timed out`
      ]
    }),

    // 记录流失
    recordLoss: assign({
      errors: ({ context }) => [
        ...context.errors,
        `Customer lost at stage ${context.currentStage}`
      ]
    }),

    // 记录取消
    recordCancellation: assign({
      errors: ({ context }) => [
        ...context.errors,
        `Booking cancelled at stage ${context.currentStage}`
      ]
    }),

    // 记录过期
    recordExpiry: assign({
      errors: ({ context }) => [
        ...context.errors,
        `Booking expired at stage ${context.currentStage}`
      ]
    }),

    // 记录未到店
    recordNoShow: assign({
      errors: ({ context }) => [
        ...context.errors,
        `Customer no-show at stage ${context.currentStage}`
      ]
    }),

    // 记录停滞
    recordStall: assign({
      errors: ({ context }) => [
        ...context.errors,
        `Customer stalled at stage ${context.currentStage}`
      ]
    }),

    // 自动完成评价
    autoCompleteReview: assign({
      milestones: ({ context }) => [
        ...context.milestones,
        {
          type: 'AUTO_REVIEW',
          timestamp: Date.now(),
          stage: context.currentStage,
          description: 'Automatic review completion after timeout',
          data: { rating: 3 } // 默认中性评价
        }
      ]
    }),

    // 重置为新历程
    resetForNewJourney: assign({
      stageStartTime: () => Date.now(),
      stageQualityScore: 80,
      eventCount: 0,
      errors: []
    })
  },

  guards: {
    // 可以添加守卫条件
    canMakeBooking: ({ context }) => {
      return context.stageQualityScore > 50;
    },
    
    hasValidPayment: ({ context }, event) => {
      return event.data?.paymentMethod && event.data?.amount > 0;
    }
  }
});

/**
 * 状态机辅助函数
 */
export const fulfillmentMachineHelpers = {
  /**
   * 创建初始上下文
   */
  createInitialContext: (guestId: string, journeyId: string, metadata?: any): FulfillmentContext => ({
    guestId,
    journeyId,
    currentStage: 'awareness',
    stageStartTime: Date.now(),
    stageQualityScore: 80,
    overallScore: 80,
    eventCount: 0,
    milestones: [],
    metadata: metadata || {},
    errors: []
  }),

  /**
   * 获取阶段显示名称
   */
  getStageDisplayName: (stage: string): string => {
    const stageNames: Record<string, string> = {
      awareness: '认知阶段',
      evaluation: '评估阶段', 
      booking: '预订阶段',
      confirmed: '确认阶段',
      experiencing: '体验阶段',
      completed: '完成阶段',
      reviewed: '评价阶段',
      lost: '已流失',
      cancelled: '已取消',
      expired: '已过期',
      noShow: '未到店',
      stalled: '已停滞'
    };
    return stageNames[stage] || stage;
  },

  /**
   * 检查是否为最终状态
   */
  isFinalState: (stage: string): boolean => {
    return ['reviewed', 'lost', 'cancelled', 'expired', 'noShow'].includes(stage);
  },

  /**
   * 检查是否为异常状态
   */
  isErrorState: (stage: string): boolean => {
    return ['lost', 'cancelled', 'expired', 'noShow', 'stalled'].includes(stage);
  },

  /**
   * 计算阶段持续时间（分钟）
   */
  getStageDuration: (context: FulfillmentContext): number => {
    return Math.floor((Date.now() - context.stageStartTime) / (1000 * 60));
  }
};

export default fulfillmentMachine;