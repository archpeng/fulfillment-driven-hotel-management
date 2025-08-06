import { describe, it, expect, beforeEach } from 'vitest';
import { Guest } from '@/domain/guests/aggregates/Guest';
import { FulfillmentStage } from '@/domain/shared/value-objects/FulfillmentStage';
import { LoyaltyLevel } from '@/domain/shared/value-objects/LoyaltyLevel';

describe('Guest聚合根', () => {
  let guest: Guest;
  const mockPersonalInfo = {
    name: '张三',
    phone: '13800138000',
    email: 'zhangsan@example.com',
    idCard: '310101199001011234'
  };

  beforeEach(() => {
    guest = new Guest('guest-123', mockPersonalInfo);
  });

  describe('创建和初始化', () => {
    it('应该正确创建Guest实例', () => {
      expect(guest.id).toBe('guest-123');
      expect(guest.personalInfo.name).toBe('张三');
      expect(guest.currentStage).toBe(FulfillmentStage.AWARENESS.value);
      expect(guest.loyaltyLevel).toBe(LoyaltyLevel.BRONZE.value);
    });

    it('应该初始化默认的业务指标', () => {
      expect(guest.lifetimeValue).toBe(0);
      expect(guest.totalBookings).toBe(0);
      expect(guest.averageRating).toBe(0);
      expect(guest.journeyCount).toBe(0);
    });

    it('应该设置默认的偏好设置', () => {
      expect(guest.preferences.roomType).toBe('standard');
      expect(guest.preferences.bedType).toBe('double');
      expect(guest.preferences.smokingPreference).toBe('non-smoking');
    });
  });

  describe('履约阶段管理', () => {
    it('应该能够推进到下一个履约阶段', () => {
      guest.advanceToStage(FulfillmentStage.EVALUATION);
      
      expect(guest.currentStage).toBe(FulfillmentStage.EVALUATION.value);
      expect(guest.stageStartTime).toBeInstanceOf(Date);
      expect(guest.version).toBe(2); // 版本应该递增
    });

    it('应该在阶段推进时记录历史', () => {
      guest.advanceToStage(FulfillmentStage.EVALUATION);
      guest.advanceToStage(FulfillmentStage.BOOKING);
      
      expect(guest.completedStages).toHaveLength(2);
      expect(guest.completedStages[0].stage).toBe(FulfillmentStage.AWARENESS.value);
      expect(guest.completedStages[1].stage).toBe(FulfillmentStage.EVALUATION.value);
    });

    it('应该在无效阶段转换时抛出错误', () => {
      expect(() => {
        guest.advanceToStage(FulfillmentStage.FEEDBACK); // 从awareness直接到feedback
      }).toThrow('Invalid stage transition');
    });

    it('应该正确计算阶段持续时间', () => {
      const startTime = guest.stageStartTime;
      
      // 模拟时间推进
      vi.advanceTimersByTime(5000); // 5秒
      
      guest.advanceToStage(FulfillmentStage.EVALUATION);
      
      const completedStage = guest.completedStages[0];
      expect(completedStage.duration).toBe(5000);
    });
  });

  describe('业务价值计算', () => {
    it('应该正确计算生命周期价值(LTV)', () => {
      // 模拟多次预订
      guest.recordBooking(500, 5); // 500元，5分评价
      guest.recordBooking(800, 4); // 800元，4分评价
      guest.recordBooking(600, 5); // 600元，5分评价
      
      const ltv = guest.calculateLifetimeValue();
      
      expect(ltv).toBeGreaterThan(1900); // 基础消费1900 + 推荐价值
      expect(guest.totalBookings).toBe(3);
      expect(guest.averageRating).toBeCloseTo(4.67, 2);
    });

    it('应该根据LTV正确更新忠诚度等级', () => {
      // 模拟高价值客户
      for (let i = 0; i < 10; i++) {
        guest.recordBooking(1000, 5);
      }
      
      guest.updateLoyaltyLevel();
      
      expect(guest.loyaltyLevel).toBe(LoyaltyLevel.GOLD.value);
    });

    it('应该正确计算推荐价值', () => {
      guest.recordReferral('referred-guest-1');
      guest.recordReferral('referred-guest-2');
      
      const referralValue = guest.calculateReferralValue();
      
      expect(referralValue).toBe(400); // 2 * 200基础推荐价值
      expect(guest.referralCount).toBe(2);
    });
  });

  describe('偏好管理', () => {
    it('应该能够更新客人偏好', () => {
      const newPreferences = {
        roomType: 'deluxe',
        bedType: 'king',
        smokingPreference: 'smoking',
        floorPreference: 'high'
      };
      
      guest.updatePreferences(newPreferences);
      
      expect(guest.preferences.roomType).toBe('deluxe');
      expect(guest.preferences.bedType).toBe('king');
      expect(guest.preferences.smokingPreference).toBe('smoking');
      expect(guest.preferences.floorPreference).toBe('high');
    });

    it('应该保留未更新的偏好设置', () => {
      guest.updatePreferences({ roomType: 'deluxe' });
      
      expect(guest.preferences.roomType).toBe('deluxe');
      expect(guest.preferences.bedType).toBe('double'); // 保持默认值
    });
  });

  describe('风险评估', () => {
    it('应该正确评估客人风险等级', () => {
      // 模拟低风险客人
      guest.recordBooking(500, 5);
      guest.recordBooking(600, 5);
      guest.completeJourney(95); // 高分完成履约
      
      const riskLevel = guest.assessRiskLevel();
      
      expect(riskLevel).toBe('low');
    });

    it('应该识别高风险客人', () => {
      // 模拟高风险行为
      guest.recordBooking(100, 2); // 低价值，低评分
      guest.recordComplaint('service quality');
      guest.recordComplaint('billing issue');
      
      const riskLevel = guest.assessRiskLevel();
      
      expect(riskLevel).toBe('high');
    });
  });

  describe('履约历程完成', () => {
    it('应该正确记录履约历程完成', () => {
      guest.advanceToStage(FulfillmentStage.EVALUATION);
      guest.advanceToStage(FulfillmentStage.BOOKING);
      guest.advanceToStage(FulfillmentStage.EXPERIENCING);
      guest.advanceToStage(FulfillmentStage.FEEDBACK);
      
      guest.completeJourney(88);
      
      expect(guest.journeyCount).toBe(1);
      expect(guest.currentStage).toBe(FulfillmentStage.AWARENESS.value); // 重置到初始阶段
      expect(guest.completedStages).toHaveLength(0); // 清空历史，开始新历程
    });

    it('应该在履约完成时发布领域事件', () => {
      guest.completeJourney(90);
      
      const events = guest.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('JourneyCompletedEvent');
    });
  });

  describe('领域事件', () => {
    it('应该在阶段推进时发布事件', () => {
      guest.advanceToStage(FulfillmentStage.EVALUATION);
      
      const events = guest.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('StageAdvancedEvent');
      expect(events[0].data.newStage).toBe(FulfillmentStage.EVALUATION.value);
    });

    it('应该在忠诚度升级时发布事件', () => {
      // 模拟忠诚度升级
      for (let i = 0; i < 5; i++) {
        guest.recordBooking(500, 5);
      }
      
      const oldLevel = guest.loyaltyLevel;
      guest.updateLoyaltyLevel();
      
      if (guest.loyaltyLevel !== oldLevel) {
        const events = guest.getUncommittedEvents();
        const loyaltyEvent = events.find(e => e.eventType === 'LoyaltyUpgradedEvent');
        expect(loyaltyEvent).toBeTruthy();
        expect(loyaltyEvent?.data.newLevel).toBe(guest.loyaltyLevel);
      }
    });

    it('应该能够清除已提交的事件', () => {
      guest.advanceToStage(FulfillmentStage.EVALUATION);
      
      expect(guest.getUncommittedEvents()).toHaveLength(1);
      
      guest.markEventsAsCommitted();
      
      expect(guest.getUncommittedEvents()).toHaveLength(0);
    });
  });

  describe('数据序列化', () => {
    it('应该正确序列化为RxDB文档格式', () => {
      guest.advanceToStage(FulfillmentStage.EVALUATION);
      guest.recordBooking(500, 5);
      
      const doc = guest.toDocument();
      
      expect(doc.id).toBe('guest-123');
      expect(doc.personalInfo.name).toBe('张三');
      expect(doc.fulfillmentHistory.currentStage).toBe('evaluation');
      expect(doc.businessMetrics.totalBookings).toBe(1);
      expect(doc.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(doc.version).toBeGreaterThan(1);
    });

    it('应该能够从RxDB文档重建Guest实例', () => {
      const originalGuest = guest;
      originalGuest.advanceToStage(FulfillmentStage.BOOKING);
      
      const doc = originalGuest.toDocument();
      const rebuiltGuest = Guest.fromDocument(doc);
      
      expect(rebuiltGuest.id).toBe(originalGuest.id);
      expect(rebuiltGuest.currentStage).toBe(originalGuest.currentStage);
      expect(rebuiltGuest.personalInfo).toEqual(originalGuest.personalInfo);
      expect(rebuiltGuest.version).toBe(originalGuest.version);
    });
  });
});