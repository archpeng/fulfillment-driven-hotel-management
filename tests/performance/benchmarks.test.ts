import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GuestRepository } from '@/database/repositories/GuestRepository';
import { GuestRxDBManager } from '@/database/GuestRxDBManager';
import { FulfillmentXStateService } from '@/xstate/FulfillmentXStateService';
import { Guest } from '@/domain/guests/aggregates/Guest';
import { TEST_DB_CONFIG, cleanupTestData, PerformanceTimer, TEST_CONSTANTS } from '@tests/setup/test-setup';

describe('性能基准测试', () => {
  let repository: GuestRepository;
  let dbManager: GuestRxDBManager;
  let stateService: FulfillmentXStateService;

  beforeEach(async () => {
    dbManager = new GuestRxDBManager();
    await dbManager.initialize({
      ...TEST_DB_CONFIG,
      name: 'perf_test_db_' + Date.now()
    });
    
    repository = new GuestRepository(dbManager);
    stateService = new FulfillmentXStateService(repository);
  });

  afterEach(async () => {
    await cleanupTestData();
    if (dbManager) {
      await dbManager.destroy();
    }
  });

  describe('本地查询性能基准', () => {
    let testGuests: Guest[];

    beforeEach(async () => {
      // 创建1000条测试数据
      testGuests = [];
      for (let i = 0; i < 1000; i++) {
        const guestData = createMockGuest();
        guestData.id = `perf-guest-${i}`;
        guestData.personalInfo.phone = `138${String(i).padStart(8, '0')}`;
        guestData.tags.loyaltyLevel = ['bronze', 'silver', 'gold', 'platinum'][i % 4];
        
        const guest = Guest.fromDocument(guestData);
        testGuests.push(guest);
      }
      
      await repository.bulkInsert(testGuests);
    });

    it('单个记录查询性能 - 目标<10ms', async () => {
      const timer = new PerformanceTimer();
      const results: number[] = [];
      
      // 执行100次查询取平均值
      for (let i = 0; i < 100; i++) {
        const randomIndex = Math.floor(Math.random() * 1000);
        const targetId = `perf-guest-${randomIndex}`;
        
        timer.start();
        const guest = await repository.findById(targetId);
        const duration = timer.stop();
        
        expect(guest).toBeTruthy();
        results.push(duration);
      }
      
      const avgDuration = results.reduce((a, b) => a + b, 0) / results.length;
      const p95Duration = results.sort((a, b) => a - b)[Math.floor(results.length * 0.95)];
      
      console.log(`单个查询 - 平均: ${avgDuration.toFixed(2)}ms, P95: ${p95Duration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.LOCAL_QUERY);
      expect(p95Duration).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.LOCAL_QUERY * 2);
    });

    it('索引查询性能 - 目标<10ms', async () => {
      const timer = new PerformanceTimer();
      const results: number[] = [];
      
      // 执行50次索引查询
      for (let i = 0; i < 50; i++) {
        const randomPhone = `138${String(Math.floor(Math.random() * 1000)).padStart(8, '0')}`;
        
        timer.start();
        const guest = await repository.findByPhone(randomPhone);
        const duration = timer.stop();
        
        results.push(duration);
      }
      
      const avgDuration = results.reduce((a, b) => a + b, 0) / results.length;
      
      console.log(`索引查询 - 平均: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.LOCAL_QUERY);
    });

    it('复合查询性能 - 目标<100ms', async () => {
      const timer = new PerformanceTimer();
      const results: number[] = [];
      
      const queryConditions = [
        { loyaltyLevel: 'bronze', limit: 100 },
        { loyaltyLevel: 'silver', limit: 100 },
        { loyaltyLevel: 'gold', limit: 100 },
        { loyaltyLevel: 'platinum', limit: 100 }
      ];
      
      // 执行多种复合查询
      for (const condition of queryConditions) {
        timer.start();
        const guests = await repository.findByLoyaltyLevel(condition.loyaltyLevel);
        const duration = timer.stop();
        
        expect(guests.length).toBeGreaterThan(0);
        results.push(duration);
      }
      
      const avgDuration = results.reduce((a, b) => a + b, 0) / results.length;
      
      console.log(`复合查询 - 平均: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(100); // <100ms
    });

    it('分页查询性能 - 目标<50ms', async () => {
      const timer = new PerformanceTimer();
      const results: number[] = [];
      
      // 测试不同页面的查询性能
      for (let page = 0; page < 10; page++) {
        timer.start();
        const result = await repository.findWithPagination({
          limit: 50,
          offset: page * 50
        });
        const duration = timer.stop();
        
        expect(result.data.length).toBeGreaterThan(0);
        expect(result.total).toBe(1000);
        results.push(duration);
      }
      
      const avgDuration = results.reduce((a, b) => a + b, 0) / results.length;
      
      console.log(`分页查询 - 平均: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(50);
    });
  });

  describe('状态机性能基准', () => {
    let journeyIds: string[];

    beforeEach(async () => {
      // 创建100个履约历程
      journeyIds = [];
      for (let i = 0; i < 100; i++) {
        const guestData = createMockGuest();
        guestData.id = `state-guest-${i}`;
        
        const guest = Guest.fromDocument(guestData);
        await repository.save(guest);
        
        const journeyId = await stateService.createJourney(guest.id);
        journeyIds.push(journeyId);
      }
    });

    it('状态转换性能 - 目标<50ms', async () => {
      const timer = new PerformanceTimer();
      const results: number[] = [];
      
      // 测试状态转换性能
      for (const journeyId of journeyIds.slice(0, 20)) {
        timer.start();
        await stateService.sendEventToJourney(journeyId, {
          type: 'SHOW_INTEREST',
          data: { source: 'website' }
        });
        const duration = timer.stop();
        
        results.push(duration);
      }
      
      const avgDuration = results.reduce((a, b) => a + b, 0) / results.length;
      
      console.log(`状态转换 - 平均: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.STATE_TRANSITION);
    });

    it('并发状态转换性能', async () => {
      const timer = new PerformanceTimer();
      
      // 并发发送状态转换事件
      const promises = journeyIds.slice(0, 50).map(journeyId =>
        stateService.sendEventToJourney(journeyId, {
          type: 'SHOW_INTEREST',
          data: { source: 'mobile_app' }
        })
      );
      
      timer.start();
      await Promise.all(promises);
      const duration = timer.stop();
      
      console.log(`50个并发状态转换 - 总时间: ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(500); // 50个并发操作<500ms
    });

    it('事件处理性能 - 目标<100ms', async () => {
      const journeyId = journeyIds[0];
      const timer = new PerformanceTimer();
      const results: number[] = [];
      
      // 快速推进到体验阶段
      await stateService.sendEventToJourney(journeyId, { type: 'SHOW_INTEREST' });
      await stateService.sendEventToJourney(journeyId, { type: 'MAKE_BOOKING', data: { amount: 500 } });
      await stateService.sendEventToJourney(journeyId, { type: 'CONFIRM_PAYMENT' });
      await stateService.sendEventToJourney(journeyId, { type: 'CHECK_IN' });
      
      // 测试事件处理性能
      for (let i = 0; i < 20; i++) {
        timer.start();
        await stateService.sendEventToJourney(journeyId, {
          type: 'SERVICE_REQUEST',
          data: { 
            serviceType: 'room_service',
            requestId: `req-${i}`,
            timestamp: new Date().toISOString()
          }
        });
        const duration = timer.stop();
        
        results.push(duration);
      }
      
      const avgDuration = results.reduce((a, b) => a + b, 0) / results.length;
      
      console.log(`事件处理 - 平均: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.EVENT_PROCESSING);
    });
  });

  describe('批量操作性能基准', () => {
    it('批量插入性能 - 目标≥1000条/秒', async () => {
      const batchSizes = [100, 500, 1000];
      
      for (const batchSize of batchSizes) {
        const guests: Guest[] = [];
        
        // 生成测试数据
        for (let i = 0; i < batchSize; i++) {
          const guestData = createMockGuest();
          guestData.id = `batch-${batchSize}-guest-${i}`;
          guests.push(Guest.fromDocument(guestData));
        }
        
        const timer = new PerformanceTimer();
        timer.start();
        
        await repository.bulkInsert(guests);
        
        const duration = timer.stop();
        const throughput = batchSize / (duration / 1000); // 每秒处理数量
        
        console.log(`批量插入 ${batchSize}条 - 用时: ${duration.toFixed(2)}ms, 吞吐量: ${throughput.toFixed(0)}条/秒`);
        
        expect(throughput).toBeGreaterThan(1000); // ≥1000条/秒
      }
    });

    it('批量查询性能', async () => {
      // 先插入测试数据
      const guests: Guest[] = [];
      for (let i = 0; i < 1000; i++) {
        const guestData = createMockGuest();
        guestData.id = `bulk-query-guest-${i}`;
        guests.push(Guest.fromDocument(guestData));
      }
      await repository.bulkInsert(guests);
      
      const timer = new PerformanceTimer();
      timer.start();
      
      // 批量查询所有记录
      const allGuests = await repository.findWithPagination({
        limit: 1000,
        offset: 0
      });
      
      const duration = timer.stop();
      const throughput = allGuests.data.length / (duration / 1000);
      
      console.log(`批量查询 ${allGuests.data.length}条 - 用时: ${duration.toFixed(2)}ms, 吞吐量: ${throughput.toFixed(0)}条/秒`);
      
      expect(allGuests.data).toHaveLength(1000);
      expect(throughput).toBeGreaterThan(5000); // 查询吞吐量应该更高
    });

    it('批量更新性能', async () => {
      // 先插入测试数据
      const guests: Guest[] = [];
      for (let i = 0; i < 500; i++) {
        const guestData = createMockGuest();
        guestData.id = `bulk-update-guest-${i}`;
        guests.push(Guest.fromDocument(guestData));
      }
      await repository.bulkInsert(guests);
      
      // 批量更新
      const updateGuests = guests.map(guest => {
        guest.updatePersonalInfo({
          ...guest.personalInfo,
          email: `updated-${guest.id}@example.com`
        });
        return guest;
      });
      
      const timer = new PerformanceTimer();
      timer.start();
      
      await repository.bulkUpdate(updateGuests);
      
      const duration = timer.stop();
      const throughput = updateGuests.length / (duration / 1000);
      
      console.log(`批量更新 ${updateGuests.length}条 - 用时: ${duration.toFixed(2)}ms, 吞吐量: ${throughput.toFixed(0)}条/秒`);
      
      expect(throughput).toBeGreaterThan(500); // 更新操作相对较慢，但也要保证合理性能
    });
  });

  describe('内存使用性能基准', () => {
    it('内存使用效率 - 目标<20MB/1000条记录', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // 插入1000条记录
      const guests: Guest[] = [];
      for (let i = 0; i < 1000; i++) {
        const guestData = createMockGuest();
        guestData.id = `memory-test-guest-${i}`;
        
        // 添加一些复杂数据结构以模拟真实场景
        guestData.fulfillmentHistory.completedStages = Array.from({ length: 5 }, (_, index) => ({
          stage: `stage-${index}`,
          completedAt: new Date().toISOString(),
          duration: Math.random() * 10000,
          score: Math.random() * 100
        }));
        
        guests.push(Guest.fromDocument(guestData));
      }
      
      await repository.bulkInsert(guests);
      
      // 查询数据到内存中
      const allGuests = await repository.findWithPagination({ limit: 1000, offset: 0 });
      
      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      console.log(`1000条记录内存增长: ${memoryIncrease.toFixed(2)}MB`);
      
      expect(memoryIncrease).toBeLessThan(20); // <20MB
      expect(allGuests.data).toHaveLength(1000);
    });

    it('内存泄漏检测', async () => {
      const iterations = 5;
      const memorySnapshots: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        // 创建和销毁大量对象
        const guests: Guest[] = [];
        for (let j = 0; j < 200; j++) {
          const guestData = createMockGuest();
          guestData.id = `leak-test-${i}-guest-${j}`;
          guests.push(Guest.fromDocument(guestData));
        }
        
        await repository.bulkInsert(guests);
        
        // 查询和处理数据
        const results = await repository.findByLoyaltyLevel('bronze');
        results.forEach(guest => {
          guest.updatePersonalInfo({
            ...guest.personalInfo,
            email: `iteration-${i}@example.com`
          });
        });
        
        // 清理数据
        for (const guest of guests) {
          await repository.delete(guest.id);
        }
        
        // 强制垃圾回收
        if (global.gc) {
          global.gc();
        }
        
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }
      
      // 检查内存是否稳定（没有持续增长）
      const firstSnapshot = memorySnapshots[0];
      const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowthMB = (lastSnapshot - firstSnapshot) / 1024 / 1024;
      
      console.log(`${iterations}轮测试内存增长: ${memoryGrowthMB.toFixed(2)}MB`);
      
      expect(memoryGrowthMB).toBeLessThan(5); // 内存增长<5MB，认为没有明显泄漏
    });
  });

  describe('压力测试', () => {
    it('高并发访问测试', async () => {
      // 准备测试数据
      const guests: Guest[] = [];
      for (let i = 0; i < 100; i++) {
        const guestData = createMockGuest();
        guestData.id = `stress-guest-${i}`;
        guests.push(Guest.fromDocument(guestData));
      }
      await repository.bulkInsert(guests);
      
      const timer = new PerformanceTimer();
      const concurrentOperations = 100;
      
      // 创建并发操作
      const operations = [];
      for (let i = 0; i < concurrentOperations; i++) {
        const operation = async () => {
          const randomIndex = Math.floor(Math.random() * 100);
          const guestId = `stress-guest-${randomIndex}`;
          
          // 随机执行不同操作
          const operationType = Math.floor(Math.random() * 3);
          switch (operationType) {
            case 0:
              return repository.findById(guestId);
            case 1:
              return repository.findByLoyaltyLevel('bronze');
            case 2:
              const guest = await repository.findById(guestId);
              if (guest) {
                guest.updatePersonalInfo({
                  ...guest.personalInfo,
                  email: `concurrent-${Date.now()}@example.com`
                });
                return repository.save(guest);
              }
              break;
          }
        };
        
        operations.push(operation());
      }
      
      timer.start();
      const results = await Promise.all(operations);
      const duration = timer.stop();
      
      console.log(`${concurrentOperations}个并发操作 - 总时间: ${duration.toFixed(2)}ms`);
      
      expect(results.length).toBe(concurrentOperations);
      expect(duration).toBeLessThan(2000); // 100个并发操作<2秒
    });

    it('长时间运行稳定性测试', async () => {
      const duration = 10000; // 10秒压力测试
      const startTime = Date.now();
      let operationCount = 0;
      const errors: Error[] = [];
      
      // 准备少量测试数据
      const guests: Guest[] = [];
      for (let i = 0; i < 10; i++) {
        const guestData = createMockGuest();
        guestData.id = `stability-guest-${i}`;
        guests.push(Guest.fromDocument(guestData));
      }
      await repository.bulkInsert(guests);
      
      // 持续执行操作直到时间结束
      while (Date.now() - startTime < duration) {
        try {
          const randomIndex = Math.floor(Math.random() * 10);
          const guestId = `stability-guest-${randomIndex}`;
          
          await repository.findById(guestId);
          operationCount++;
          
          // 短暂延迟以避免过度消耗CPU
          await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
          errors.push(error as Error);
        }
      }
      
      const actualDuration = Date.now() - startTime;
      const operationsPerSecond = operationCount / (actualDuration / 1000);
      
      console.log(`长时间运行测试 - 执行${operationCount}次操作，用时${actualDuration}ms，平均${operationsPerSecond.toFixed(0)}操作/秒`);
      console.log(`错误数量: ${errors.length}`);
      
      expect(errors.length).toBe(0); // 不应该有错误
      expect(operationCount).toBeGreaterThan(100); // 至少应该执行100次操作
      expect(operationsPerSecond).toBeGreaterThan(50); // 至少50操作/秒
    });
  });
});