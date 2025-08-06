import type { RxJsonSchema } from 'rxdb';

/**
 * Guest RxDB文档类型
 * 对应Guest聚合根的持久化结构
 */
export interface GuestDocType {
  // 实体标识
  id: string;
  
  // 个人信息
  personalInfo: {
    name: string;
    phone: string;
    email?: string;
    idCard?: string;
    avatar?: string;
  };
  
  // 履约历史 
  fulfillmentHistory: {
    currentStage: string; // FulfillmentStage.value
    stageStartTime: string; // ISO 8601
    completedStages: Array<{
      stage: string; // FulfillmentStage.value
      startTime: string; // ISO 8601
      endTime?: string; // ISO 8601
      qualityScore: number; // 0-100
      isCompleted: boolean;
      events: Array<{
        eventType: string;
        timestamp: string;
        impact: number;
      }>;
    }>;
    journeyCount: number;
    totalJourneyTime: number; // 天数
  };
  
  // 商业指标
  businessMetrics: {
    lifetimeValue: number;
    totalBookings: number;
    totalNights: number;
    averageRating: number; // 0-5
    referralCount: number;
    lastVisitDate?: string; // ISO 8601
  };
  
  // 客人偏好
  preferences: {
    roomTypes: string[];
    priceRange: [number, number]; // [min, max]
    specialRequests: string[];
    communicationPreference: 'phone' | 'wechat' | 'email';
  };
  
  // 客人标签
  tags: {
    loyaltyLevel: string; // LoyaltyLevel.value
    riskLevel: 'low' | 'medium' | 'high';
    valueSegment: 'budget' | 'mid-range' | 'luxury';
    behaviorPatterns: string[];
  };
  
  // 审计信息
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  version: number;
  isDeleted: boolean;
}

/**
 * Guest集合的RxDB Schema
 */
export const guestSchema: RxJsonSchema<GuestDocType> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 50
    },
    
    personalInfo: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          maxLength: 100
        },
        phone: {
          type: 'string',
          maxLength: 20
        },
        email: {
          type: 'string',
          maxLength: 200
        },
        idCard: {
          type: 'string',
          maxLength: 50
        },
        avatar: {
          type: 'string',
          maxLength: 500
        }
      },
      required: ['name', 'phone']
    },
    
    fulfillmentHistory: {
      type: 'object',
      properties: {
        currentStage: {
          type: 'string',
          maxLength: 20,
          enum: ['awareness', 'evaluation', 'booking', 'experiencing', 'feedback']
        },
        stageStartTime: {
          type: 'string',
          maxLength: 30,
          format: 'date-time'
        },
        completedStages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stage: {
                type: 'string',
                maxLength: 20
              },
              startTime: {
                type: 'string',
                maxLength: 30
              },
              endTime: {
                type: 'string',
                maxLength: 30
              },
              qualityScore: {
                type: 'number',
                minimum: 0,
                maximum: 100
              },
              isCompleted: {
                type: 'boolean'
              },
              events: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    eventType: { type: 'string', maxLength: 50 },
                    timestamp: { type: 'string', maxLength: 30 },
                    impact: { type: 'number', minimum: -100, maximum: 100 }
                  }
                }
              }
            }
          }
        },
        journeyCount: {
          type: 'number',
          minimum: 0
        },
        totalJourneyTime: {
          type: 'number',
          minimum: 0
        }
      },
      required: ['currentStage', 'stageStartTime', 'completedStages', 'journeyCount', 'totalJourneyTime']
    },
    
    businessMetrics: {
      type: 'object',
      properties: {
        lifetimeValue: {
          type: 'number',
          minimum: 0
        },
        totalBookings: {
          type: 'number',
          minimum: 0
        },
        totalNights: {
          type: 'number',
          minimum: 0
        },
        averageRating: {
          type: 'number',
          minimum: 0,
          maximum: 5
        },
        referralCount: {
          type: 'number',
          minimum: 0
        },
        lastVisitDate: {
          type: 'string',
          maxLength: 30,
          format: 'date-time'
        }
      },
      required: ['lifetimeValue', 'totalBookings', 'totalNights', 'averageRating', 'referralCount']
    },
    
    preferences: {
      type: 'object',
      properties: {
        roomTypes: {
          type: 'array',
          items: {
            type: 'string',
            maxLength: 50
          }
        },
        priceRange: {
          type: 'array',
          items: {
            type: 'number',
            minimum: 0
          },
          minItems: 2,
          maxItems: 2
        },
        specialRequests: {
          type: 'array',
          items: {
            type: 'string',
            maxLength: 200
          }
        },
        communicationPreference: {
          type: 'string',
          maxLength: 10,
          enum: ['phone', 'wechat', 'email']
        }
      },
      required: ['roomTypes', 'priceRange', 'specialRequests', 'communicationPreference']
    },
    
    tags: {
      type: 'object',
      properties: {
        loyaltyLevel: {
          type: 'string',
          maxLength: 20,
          enum: ['bronze', 'silver', 'gold', 'platinum']
        },
        riskLevel: {
          type: 'string',
          maxLength: 10,
          enum: ['low', 'medium', 'high']
        },
        valueSegment: {
          type: 'string',
          maxLength: 15,
          enum: ['budget', 'mid-range', 'luxury']
        },
        behaviorPatterns: {
          type: 'array',
          items: {
            type: 'string',
            maxLength: 50
          }
        }
      },
      required: ['loyaltyLevel', 'riskLevel', 'valueSegment', 'behaviorPatterns']
    },
    
    createdAt: {
      type: 'string',
      maxLength: 30,
      format: 'date-time'
    },
    updatedAt: {
      type: 'string',
      maxLength: 30,
      format: 'date-time'
    },
    version: {
      type: 'number',
      minimum: 0
    },
    isDeleted: {
      type: 'boolean'
    }
  },
  
  required: [
    'id',
    'personalInfo',
    'fulfillmentHistory',
    'businessMetrics',
    'preferences',
    'tags',
    'createdAt',
    'updatedAt',
    'version',
    'isDeleted'
  ],
  
  indexes: [
    // 单字段索引 - 用于基础查询
    'personalInfo.phone',          // 按电话查找客人
    'fulfillmentHistory.currentStage',  // 按当前阶段筛选
    'tags.loyaltyLevel',          // 按忠诚度等级筛选
    'businessMetrics.lifetimeValue',   // 按价值排序
    'createdAt',                  // 按创建时间排序
    'updatedAt',                  // 按更新时间排序
    
    // 复合索引 - 用于复杂查询优化
    ['fulfillmentHistory.currentStage', 'updatedAt'],  // 阶段 + 更新时间
    ['tags.loyaltyLevel', 'businessMetrics.lifetimeValue'],  // 忠诚度 + 价值
    ['tags.riskLevel', 'fulfillmentHistory.currentStage'],  // 风险 + 阶段
    ['businessMetrics.totalBookings', 'createdAt'],    // 预订次数 + 创建时间
    
    // 业务分析索引
    ['tags.valueSegment', 'businessMetrics.averageRating'],  // 价值分段 + 评分
    ['fulfillmentHistory.currentStage', 'tags.riskLevel'],   // 当前阶段 + 风险等级
    
    // 删除标记索引 - 支持软删除查询
    ['isDeleted', 'updatedAt']
  ]
};

/**
 * Guest集合的类型定义
 */
export type GuestCollection = RxCollection<GuestDocType>;

/**
 * Guest文档的类型定义
 */
export type GuestDocument = RxDocument<GuestDocType>;