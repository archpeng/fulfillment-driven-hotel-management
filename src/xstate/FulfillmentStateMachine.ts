/**
 * 履约驱动状态机
 * 管理客人的完整履约生命周期
 */

import { createMachine, assign, fromPromise } from 'xstate';
import type { GuestDocType } from '../database/schemas/guest.schema';

// 履约上下文类型
export interface FulfillmentContext {
  guest: GuestDocType | null;
  currentStage: string;
  stageStartTime: Date;
  completedStages: any[];
  qualityScore: number;
  errors: string[];
  eventHistory: FulfillmentEvent[];
}

// 履约事件类型
export interface FulfillmentEvent {
  type: string;
  timestamp: Date;
  data?: any;
  score: number;
  stage: string;
}

// 事件分数映射
const EVENT_SCORES = {
  // 认知阶段事件
  'PAGE_VIEW': 5,
  'AD_CLICK': 10,
  'SEARCH_QUERY': 15,
  'SOCIAL_SHARE': 20,
  
  // 评估阶段事件
  'DETAILS_VIEW': 25,
  'INQUIRY_SUBMIT': 30,
  'LIVE_CHAT': 35,
  'PHONE_CALL': 40,
  'COMPARISON_VIEW': 20,
  
  // 预订阶段事件
  'BOOKING_START': 50,
  'PAYMENT_INFO': 60,
  'PAYMENT_SUCCESS': 80,
  'BOOKING_CONFIRMED': 100,
  
  // 体验阶段事件
  'CHECK_IN': 90,
  'SERVICE_REQUEST': 70,
  'ROOM_UPGRADE': 85,
  'COMPLAINT': -30,
  'POSITIVE_FEEDBACK': 40,
  'CHECK_OUT': 95,
  
  // 反馈阶段事件
  'REVIEW_SUBMIT': 60,
  'HIGH_RATING': 50,
  'REFERRAL': 80,
  'REPEAT_BOOKING': 100
};

// 履约驱动状态机
export const fulfillmentMachine = createMachine({
  id: 'fulfillmentJourney',
  
  types: {} as {
    context: FulfillmentContext;
    events: 
      | { type: 'START_JOURNEY'; guest: GuestDocType }
      | { type: 'RECORD_EVENT'; eventType: string; data?: any }
      | { type: 'ADVANCE_STAGE' }
      | { type: 'HANDLE_ISSUE'; issue: string }
      | { type: 'COMPLETE_JOURNEY' }
      | { type: 'RESET' }
  },

  context: {
    guest: null,
    currentStage: 'awareness',
    stageStartTime: new Date(),
    completedStages: [],
    qualityScore: 0,
    errors: [],
    eventHistory: []
  },

  initial: 'idle',

  states: {
    // 空闲状态
    idle: {
      on: {
        START_JOURNEY: {
          target: 'awareness',
          actions: assign({
            guest: ({ event }) => event.guest,
            currentStage: 'awareness',
            stageStartTime: new Date(),
            qualityScore: 0,
            eventHistory: []
          })
        }
      }
    },

    // 认知阶段 - 客人开始了解酒店
    awareness: {
      entry: ['logStageEntry'],
      
      on: {
        RECORD_EVENT: {
          actions: ['recordEvent', 'updateQualityScore']
        },
        
        ADVANCE_STAGE: [
          {
            guard: 'hasMinimumAwarenessScore',
            target: 'evaluation',
            actions: ['completeStage']
          },
          {
            actions: ['logInsufficientScore']
          }
        ],
        
        HANDLE_ISSUE: {
          target: 'issue_handling',
          actions: ['recordIssue']
        }
      },

      // 自动超时机制
      after: {
        1800000: { // 30分钟
          target: 'lost',
          actions: ['recordTimeout']
        }
      }
    },

    // 评估阶段 - 客人正在评估选择
    evaluation: {
      entry: ['logStageEntry'],
      
      on: {
        RECORD_EVENT: {
          actions: ['recordEvent', 'updateQualityScore']
        },
        
        ADVANCE_STAGE: [
          {
            guard: 'hasMinimumEvaluationScore', 
            target: 'booking',
            actions: ['completeStage']
          },
          {
            actions: ['logInsufficientScore']
          }
        ],
        
        HANDLE_ISSUE: {
          target: 'issue_handling',
          actions: ['recordIssue']
        }
      },

      after: {
        3600000: { // 1小时
          target: 'lost',
          actions: ['recordTimeout']
        }
      }
    },

    // 预订阶段 - 客人正在进行预订
    booking: {
      entry: ['logStageEntry'],
      
      on: {
        RECORD_EVENT: {
          actions: ['recordEvent', 'updateQualityScore']
        },
        
        ADVANCE_STAGE: [
          {
            guard: 'hasConfirmedBooking',
            target: 'confirmed',
            actions: ['completeStage']
          },
          {
            actions: ['logInsufficientScore']
          }
        ],
        
        HANDLE_ISSUE: {
          target: 'issue_handling',
          actions: ['recordIssue']
        }
      },

      after: {
        1800000: { // 30分钟
          target: 'expired',
          actions: ['recordTimeout']
        }
      }
    },

    // 确认状态 - 预订已确认，等待体验
    confirmed: {
      entry: ['logStageEntry', 'sendConfirmation'],
      
      on: {
        RECORD_EVENT: {
          actions: ['recordEvent']
        },
        
        ADVANCE_STAGE: {
          target: 'experiencing',
          actions: ['completeStage']
        },
        
        'NO_SHOW': {
          target: 'no_show',
          actions: ['recordNoShow']
        }
      }
    },

    // 体验阶段 - 客人正在酒店体验服务
    experiencing: {
      entry: ['logStageEntry'],
      
      // 并行状态：同时监控服务质量和满意度
      type: 'parallel',
      
      states: {
        service_monitoring: {
          initial: 'normal',
          states: {
            normal: {
              on: {
                COMPLAINT: 'handling_complaint',
                SERVICE_REQUEST: 'processing_request'
              }
            },
            
            handling_complaint: {
              entry: ['handleComplaint'],
              on: {
                RESOLVE_COMPLAINT: 'normal'
              }
            },
            
            processing_request: {
              entry: ['processServiceRequest'],
              on: {
                COMPLETE_REQUEST: 'normal'
              }
            }
          }
        },
        
        satisfaction_tracking: {
          initial: 'monitoring',
          states: {
            monitoring: {
              on: {
                POSITIVE_FEEDBACK: {
                  actions: ['recordPositiveFeedback']
                },
                NEGATIVE_FEEDBACK: {
                  actions: ['recordNegativeFeedback']
                }
              }
            }
          }
        }
      },

      on: {
        RECORD_EVENT: {
          actions: ['recordEvent', 'updateQualityScore']
        },
        
        ADVANCE_STAGE: {
          target: 'feedback',
          actions: ['completeStage']
        }
      }
    },

    // 反馈阶段 - 收集客人反馈
    feedback: {
      entry: ['logStageEntry', 'requestFeedback'],
      
      on: {
        RECORD_EVENT: {
          actions: ['recordEvent', 'updateQualityScore']
        },
        
        COMPLETE_JOURNEY: {
          target: 'completed',
          actions: ['completeJourney']
        }
      },

      after: {
        604800000: { // 7天
          target: 'completed',
          actions: ['completeJourney']
        }
      }
    },

    // 完成状态 - 履约周期完成
    completed: {
      entry: ['logCompletion', 'calculateFinalScore'],
      type: 'final'
    },

    // 异常状态处理
    issue_handling: {
      entry: ['logIssue'],
      
      on: {
        RESOLVE_ISSUE: {
          target: '#fulfillmentJourney.awareness', // 返回到之前的状态
          actions: ['resolveIssue']
        }
      }
    },

    // 丢失状态 - 客人在某个阶段丢失
    lost: {
      entry: ['logLoss', 'analyzeDropOff'],
      type: 'final'
    },

    // 过期状态 - 预订过期
    expired: {
      entry: ['logExpiration'],
      type: 'final'
    },

    // 未出现状态 - 客人未按时入住
    no_show: {
      entry: ['logNoShow'],
      type: 'final'
    }
  }
}, {
  // 守卫条件
  guards: {
    hasMinimumAwarenessScore: ({ context }) => {
      return context.qualityScore >= 30; // 认知阶段需要30分
    },
    
    hasMinimumEvaluationScore: ({ context }) => {
      return context.qualityScore >= 80; // 评估阶段需要80分
    },
    
    hasConfirmedBooking: ({ context }) => {
      return context.eventHistory.some(
        event => event.type === 'BOOKING_CONFIRMED'
      );
    }
  },

  // 动作处理
  actions: {
    logStageEntry: ({ context }) => {
      console.log(`🎯 进入履约阶段: ${context.currentStage}`, {
        guest: context.guest?.personalInfo.name,
        time: new Date().toISOString(),
        currentScore: context.qualityScore
      });
    },

    recordEvent: assign({
      eventHistory: ({ context, event }) => {
        if (event.type !== 'RECORD_EVENT') return context.eventHistory;
        
        const fulfillmentEvent: FulfillmentEvent = {
          type: event.eventType,
          timestamp: new Date(),
          data: event.data,
          score: EVENT_SCORES[event.eventType] || 0,
          stage: context.currentStage
        };
        
        console.log(`📊 记录履约事件: ${event.eventType}`, fulfillmentEvent);
        
        return [...context.eventHistory, fulfillmentEvent];
      }
    }),

    updateQualityScore: assign({
      qualityScore: ({ context, event }) => {
        if (event.type !== 'RECORD_EVENT') return context.qualityScore;
        
        const eventScore = EVENT_SCORES[event.eventType] || 0;
        const newScore = Math.max(0, Math.min(100, context.qualityScore + eventScore));
        
        console.log(`📈 质量评分更新: ${context.qualityScore} → ${newScore} (+${eventScore})`);
        
        return newScore;
      }
    }),

    completeStage: assign({
      completedStages: ({ context }) => {
        const stageCompletion = {
          stage: context.currentStage,
          completedAt: new Date(),
          duration: Date.now() - context.stageStartTime.getTime(),
          score: context.qualityScore,
          events: context.eventHistory.filter(e => e.stage === context.currentStage)
        };
        
        console.log(`✅ 完成履约阶段: ${context.currentStage}`, stageCompletion);
        
        return [...context.completedStages, stageCompletion];
      },
      stageStartTime: new Date()
    }),

    sendConfirmation: ({ context }) => {
      console.log(`📧 发送确认信息给: ${context.guest?.personalInfo.name}`);
      // 这里可以集成真实的通知系统
    },

    requestFeedback: ({ context }) => {
      console.log(`💬 请求反馈从: ${context.guest?.personalInfo.name}`);
      // 这里可以集成反馈收集系统
    },

    completeJourney: assign({
      qualityScore: ({ context }) => {
        // 计算最终质量评分
        const totalEvents = context.eventHistory.length;
        const avgScore = totalEvents > 0 
          ? context.eventHistory.reduce((sum, e) => sum + e.score, 0) / totalEvents
          : context.qualityScore;
        
        console.log(`🏆 履约历程完成 - 最终评分: ${avgScore}`);
        return avgScore;
      }
    }),

    logCompletion: ({ context }) => {
      const duration = Date.now() - context.stageStartTime.getTime();
      console.log(`🎉 履约历程成功完成!`, {
        guest: context.guest?.personalInfo.name,
        totalDuration: duration,
        finalScore: context.qualityScore,
        completedStages: context.completedStages.length,
        totalEvents: context.eventHistory.length
      });
    },

    calculateFinalScore: ({ context }) => {
      // 更复杂的评分算法
      const stageBonus = context.completedStages.length * 10;
      const eventBonus = context.eventHistory.filter(e => e.score > 0).length * 2;
      const timeBonus = context.completedStages.every(s => s.duration < 3600000) ? 20 : 0; // 1小时内完成每个阶段
      
      const finalScore = Math.min(100, context.qualityScore + stageBonus + eventBonus + timeBonus);
      
      console.log(`🎯 最终质量评分计算:`, {
        baseScore: context.qualityScore,
        stageBonus,
        eventBonus, 
        timeBonus,
        finalScore
      });
    },

    recordIssue: assign({
      errors: ({ context, event }) => {
        if (event.type !== 'HANDLE_ISSUE') return context.errors;
        return [...context.errors, event.issue];
      }
    }),

    recordTimeout: ({ context }) => {
      console.log(`⏰ 履约阶段超时: ${context.currentStage}`, {
        guest: context.guest?.personalInfo.name,
        stage: context.currentStage,
        duration: Date.now() - context.stageStartTime.getTime()
      });
    },

    logInsufficientScore: ({ context }) => {
      console.log(`⚠️ 评分不足，无法进入下一阶段`, {
        currentStage: context.currentStage,
        currentScore: context.qualityScore,
        required: context.currentStage === 'awareness' ? 30 : 80
      });
    },

    logLoss: ({ context }) => {
      console.log(`😞 客人流失于: ${context.currentStage}`, {
        guest: context.guest?.personalInfo.name,
        lostAt: context.currentStage,
        score: context.qualityScore,
        eventsCount: context.eventHistory.length
      });
    },

    analyzeDropOff: ({ context }) => {
      // 分析客人流失原因
      const lastEvents = context.eventHistory.slice(-3);
      const negativeEvents = lastEvents.filter(e => e.score < 0);
      
      console.log(`📊 流失分析:`, {
        stage: context.currentStage,
        lastEvents: lastEvents.map(e => e.type),
        negativeEvents: negativeEvents.map(e => e.type),
        possibleCauses: negativeEvents.length > 0 ? '负面事件影响' : '缺乏互动'
      });
    },

    handleComplaint: ({ context }) => {
      console.log(`🚨 处理投诉: ${context.guest?.personalInfo.name}`);
      // 触发投诉处理流程
    },

    processServiceRequest: ({ context }) => {
      console.log(`🛎️ 处理服务请求: ${context.guest?.personalInfo.name}`);
      // 处理服务请求
    },

    recordPositiveFeedback: ({ context }) => {
      console.log(`👍 收到正面反馈: ${context.guest?.personalInfo.name}`);
    },

    recordNegativeFeedback: ({ context }) => {
      console.log(`👎 收到负面反馈: ${context.guest?.personalInfo.name}`);
    },

    logExpiration: ({ context }) => {
      console.log(`⏳ 预订过期: ${context.guest?.personalInfo.name}`);
    },

    logNoShow: ({ context }) => {
      console.log(`👻 客人未出现: ${context.guest?.personalInfo.name}`);
    },

    resolveIssue: ({ context }) => {
      console.log(`✅ 问题已解决，继续履约历程`);
    },

    logIssue: ({ context }) => {
      console.log(`⚠️ 进入问题处理模式`);
    }
  }
});