import { describe, it, expect, beforeEach } from 'vitest';
import { createActor } from 'xstate';
import { fulfillmentMachine } from '@/xstate/fulfillmentMachine';
import { createTestStateMachine } from '@tests/setup/test-setup';

describe('履约状态机测试', () => {
  let testMachine: any;
  let actor: any;

  beforeEach(() => {
    testMachine = createTestStateMachine(fulfillmentMachine);
    actor = createActor(testMachine);
  });

  describe('初始状态', () => {
    it('应该以awareness状态开始', () => {
      actor.start();
      expect(actor.getSnapshot().value).toBe('awareness');
    });

    it('应该正确初始化上下文', () => {
      actor.start();
      const context = actor.getSnapshot().context;
      
      expect(context.guestId).toBeDefined();
      expect(context.overallScore).toBe(0);
      expect(context.events).toHaveLength(0);
      expect(context.startTime).toBeInstanceOf(Date);
    });
  });

  describe('阶段转换', () => {
    beforeEach(() => {
      actor.start();
    });

    it('应该能从awareness转换到evaluation', () => {
      actor.send({ type: 'SHOW_INTEREST', data: { source: 'website' } });
      
      expect(actor.getSnapshot().value).toBe('evaluation');
    });

    it('应该能从evaluation转换到booking', () => {
      actor.send({ type: 'SHOW_INTEREST' });
      actor.send({ type: 'MAKE_BOOKING', data: { roomType: 'deluxe', amount: 500 } });
      
      expect(actor.getSnapshot().value).toBe('booking');
    });

    it('应该能从booking转换到confirmed', () => {
      actor.send({ type: 'SHOW_INTEREST' });
      actor.send({ type: 'MAKE_BOOKING' });
      actor.send({ type: 'CONFIRM_PAYMENT', data: { paymentId: 'pay-123' } });
      
      expect(actor.getSnapshot().value).toBe('confirmed');
    });

    it('应该能从confirmed转换到experiencing', () => {
      // 快速推进到confirmed状态
      actor.send({ type: 'SHOW_INTEREST' });
      actor.send({ type: 'MAKE_BOOKING' });
      actor.send({ type: 'CONFIRM_PAYMENT' });
      actor.send({ type: 'CHECK_IN', data: { checkInTime: new Date() } });
      
      expect(actor.getSnapshot().value).toBe('experiencing');
    });

    it('应该能从experiencing转换到completed', () => {
      // 推进到experiencing状态
      actor.send({ type: 'SHOW_INTEREST' });
      actor.send({ type: 'MAKE_BOOKING' });
      actor.send({ type: 'CONFIRM_PAYMENT' });
      actor.send({ type: 'CHECK_IN' });
      actor.send({ type: 'CHECK_OUT', data: { checkOutTime: new Date() } });
      
      expect(actor.getSnapshot().value).toBe('completed');
    });

    it('应该能从completed转换到reviewed', () => {
      // 推进到completed状态
      actor.send({ type: 'SHOW_INTEREST' });
      actor.send({ type: 'MAKE_BOOKING' });
      actor.send({ type: 'CONFIRM_PAYMENT' });
      actor.send({ type: 'CHECK_IN' });
      actor.send({ type: 'CHECK_OUT' });
      actor.send({ type: 'SUBMIT_REVIEW', data: { rating: 5, comment: '很好的体验' } });
      
      expect(actor.getSnapshot().value).toBe('reviewed');
    });
  });

  describe('异常处理', () => {
    beforeEach(() => {
      actor.start();
    });

    it('应该能处理客人流失(lost)情况', () => {
      actor.send({ type: 'LOSE_INTEREST' });
      
      expect(actor.getSnapshot().value).toBe('lost');
    });

    it('应该能处理预订过期(expired)情况', () => {
      actor.send({ type: 'SHOW_INTEREST' });
      actor.send({ type: 'MAKE_BOOKING' });
      actor.send({ type: 'EXPIRE_BOOKING' });
      
      expect(actor.getSnapshot().value).toBe('expired');
    });

    it('应该能处理客人未出现(noShow)情况', () => {
      // 推进到confirmed状态
      actor.send({ type: 'SHOW_INTEREST' });
      actor.send({ type: 'MAKE_BOOKING' });
      actor.send({ type: 'CONFIRM_PAYMENT' });
      actor.send({ type: 'NO_SHOW' });
      
      expect(actor.getSnapshot().value).toBe('noShow');
    });

    it('应该能处理服务投诉情况', () => {
      // 推进到experiencing状态
      actor.send({ type: 'SHOW_INTEREST' });
      actor.send({ type: 'MAKE_BOOKING' });
      actor.send({ type: 'CONFIRM_PAYMENT' });
      actor.send({ type: 'CHECK_IN' });
      actor.send({ type: 'REPORT_ISSUE', data: { issueType: 'service', severity: 'high' } });
      
      expect(actor.getSnapshot().value).toBe('issue_handling');
    });
  });

  describe('并行状态', () => {
    beforeEach(() => {
      actor.start();
      // 推进到experiencing状态（支持并行状态）
      actor.send({ type: 'SHOW_INTEREST' });
      actor.send({ type: 'MAKE_BOOKING' });
      actor.send({ type: 'CONFIRM_PAYMENT' });
      actor.send({ type: 'CHECK_IN' });
    });

    it('应该能同时跟踪服务质量和客人满意度', () => {
      const snapshot = actor.getSnapshot();
      
      // experiencing状态应该包含并行的子状态
      expect(snapshot.value).toEqual(
        expect.objectContaining({
          experiencing: expect.objectContaining({
            service_monitoring: expect.any(String),
            satisfaction_tracking: expect.any(String)
          })
        })
      );
    });

    it('应该能在体验阶段处理多个并发事件', () => {
      actor.send({ type: 'SERVICE_REQUEST', data: { serviceType: 'housekeeping' } });
      actor.send({ type: 'SATISFACTION_SURVEY', data: { score: 8 } });
      
      const context = actor.getSnapshot().context;
      expect(context.events.length).toBeGreaterThan(0);
    });
  });

  describe('状态机守卫条件', () => {
    beforeEach(() => {
      actor.start();
    });

    it('应该验证预订金额有效性', () => {
      actor.send({ type: 'SHOW_INTEREST' });
      
      // 尝试无效金额的预订
      actor.send({ 
        type: 'MAKE_BOOKING', 
        data: { roomType: 'deluxe', amount: -100 } 
      });
      
      // 应该仍在evaluation状态
      expect(actor.getSnapshot().value).toBe('evaluation');
    });

    it('应该验证客人资格', () => {
      // 模拟不合格客人
      const context = { ...actor.getSnapshot().context, riskLevel: 'high' };
      actor.send({ type: 'SHOW_INTEREST' });
      
      // 高风险客人可能被拒绝预订
      if (context.riskLevel === 'high') {
        expect(actor.getSnapshot().context.canProceedToBooking).toBe(false);
      }
    });
  });

  describe('超时处理', () => {
    beforeEach(() => {
      actor.start();
    });

    it('应该在evaluation阶段设置超时', () => {
      actor.send({ type: 'SHOW_INTEREST' });
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.timeoutDuration).toBeDefined();
      expect(snapshot.context.timeoutDuration).toBeGreaterThan(0);
    });

    it('应该在超时后自动转换状态', async () => {
      actor.send({ type: 'SHOW_INTEREST' });
      
      // 快进时间触发超时
      vi.advanceTimersByTime(30 * 60 * 1000); // 30分钟
      
      await waitForAsync(100);
      
      // 应该转换到lost状态（模拟客人失去兴趣）
      expect(actor.getSnapshot().value).toBe('lost');
    });
  });

  describe('事件记录和评分', () => {
    beforeEach(() => {
      actor.start();
    });

    it('应该记录每个阶段的事件', () => {
      actor.send({ type: 'SHOW_INTEREST', data: { source: 'google_ad' } });
      actor.send({ type: 'MAKE_BOOKING', data: { roomType: 'deluxe' } });
      
      const context = actor.getSnapshot().context;
      expect(context.events.length).toBeGreaterThan(0);
      
      const interestEvent = context.events.find((e: any) => e.type === 'SHOW_INTEREST');
      expect(interestEvent).toBeTruthy();
      expect(interestEvent.data.source).toBe('google_ad');
    });

    it('应该计算阶段评分', () => {
      actor.send({ type: 'SHOW_INTEREST' });
      actor.send({ type: 'MAKE_BOOKING', data: { amount: 500 } });
      
      const context = actor.getSnapshot().context;
      expect(context.stageScores.awareness).toBeGreaterThan(0);
      expect(context.stageScores.evaluation).toBeGreaterThan(0);
    });

    it('应该更新整体评分', () => {
      const initialScore = actor.getSnapshot().context.overallScore;
      
      actor.send({ type: 'SHOW_INTEREST' });
      actor.send({ type: 'MAKE_BOOKING', data: { amount: 500 } });
      actor.send({ type: 'CONFIRM_PAYMENT' });
      
      const finalScore = actor.getSnapshot().context.overallScore;
      expect(finalScore).toBeGreaterThan(initialScore);
    });
  });

  describe('复购循环', () => {
    beforeEach(() => {
      actor.start();
      // 完整走完一个履约流程
      actor.send({ type: 'SHOW_INTEREST' });
      actor.send({ type: 'MAKE_BOOKING' });
      actor.send({ type: 'CONFIRM_PAYMENT' });
      actor.send({ type: 'CHECK_IN' });
      actor.send({ type: 'CHECK_OUT' });
      actor.send({ type: 'SUBMIT_REVIEW', data: { rating: 5 } });
    });

    it('应该能够开始新的履约循环', () => {
      expect(actor.getSnapshot().value).toBe('reviewed');
      
      actor.send({ type: 'START_NEW_JOURNEY' });
      
      expect(actor.getSnapshot().value).toBe('awareness');
    });

    it('应该在新循环中保留历史数据', () => {
      const context = actor.getSnapshot().context;
      const previousEvents = context.events.length;
      
      actor.send({ type: 'START_NEW_JOURNEY' });
      
      const newContext = actor.getSnapshot().context;
      expect(newContext.journeyCount).toBe(context.journeyCount + 1);
      expect(newContext.historicalEvents).toBeDefined();
    });
  });

  describe('性能监控', () => {
    it('应该在合理时间内完成状态转换', () => {
      const timer = new PerformanceTimer();
      
      timer.start();
      actor.start();
      actor.send({ type: 'SHOW_INTEREST' });
      const duration = timer.stop();
      
      expect(duration).toBeLessThan(50); // 状态转换<50ms
    });

    it('应该能处理大量并发事件', () => {
      actor.start();
      actor.send({ type: 'SHOW_INTEREST' });
      actor.send({ type: 'MAKE_BOOKING' });
      actor.send({ type: 'CONFIRM_PAYMENT' });
      actor.send({ type: 'CHECK_IN' });
      
      const timer = new PerformanceTimer();
      timer.start();
      
      // 发送100个并发事件
      for (let i = 0; i < 100; i++) {
        actor.send({ 
          type: 'SERVICE_REQUEST', 
          data: { serviceType: 'room_service', requestId: i } 
        });
      }
      
      const duration = timer.stop();
      expect(duration).toBeLessThan(100); // 事件处理<100ms
    });
  });
});