import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GuestRepository } from '@/database/repositories/GuestRepository';
import { GuestRxDBManager } from '@/database/GuestRxDBManager';
import { Guest } from '@/domain/guests/aggregates/Guest';
import { TEST_DB_CONFIG, cleanupTestData, PerformanceTimer } from '@tests/setup/test-setup';

describe('GuestRepository集成测试', () => {
  let repository: GuestRepository;
  let dbManager: GuestRxDBManager;

  beforeEach(async () => {
    dbManager = new GuestRxDBManager();
    await dbManager.initialize({
      ...TEST_DB_CONFIG,
      name: 'test_guest_db_' + Date.now()
    });
    
    repository = new GuestRepository(dbManager);
  });

  afterEach(async () => {
    await cleanupTestData();
    if (dbManager) {
      await dbManager.destroy();
    }
  });

  describe('基本CRUD操作', () => {
    it('应该能够保存Guest聚合根', async () => {
      const guest = createMockGuest();
      const guestAggregate = Guest.fromDocument(guest);
      
      await repository.save(guestAggregate);
      
      const savedGuest = await repository.findById(guest.id);
      expect(savedGuest).toBeTruthy();
      expect(savedGuest!.id).toBe(guest.id);
      expect(savedGuest!.personalInfo.name).toBe(guest.personalInfo.name);
    });

    it('应该能够更新现有Guest', async () => {
      const guest = createMockGuest();
      const guestAggregate = Guest.fromDocument(guest);
      
      await repository.save(guestAggregate);
      
      // 更新guest信息
      guestAggregate.updatePersonalInfo({
        ...guestAggregate.personalInfo,
        name: '李四'
      });
      
      await repository.save(guestAggregate);
      
      const updatedGuest = await repository.findById(guest.id);
      expect(updatedGuest!.personalInfo.name).toBe('李四');
      expect(updatedGuest!.version).toBe(guestAggregate.version);
    });

    it('应该能够删除Guest', async () => {
      const guest = createMockGuest();
      const guestAggregate = Guest.fromDocument(guest);
      
      await repository.save(guestAggregate);
      
      await repository.delete(guest.id);
      
      const deletedGuest = await repository.findById(guest.id);
      expect(deletedGuest).toBeNull();
    });

    it('应该在Guest不存在时返回null', async () => {
      const nonExistentGuest = await repository.findById('non-existent-id');
      expect(nonExistentGuest).toBeNull();
    });
  });

  describe('查询操作', () => {
    let testGuests: Guest[];

    beforeEach(async () => {
      // 创建测试数据
      testGuests = [];
      for (let i = 0; i < 5; i++) {
        const guestData = createMockGuest();
        guestData.id = `guest-${i}`;
        guestData.personalInfo.name = `客人${i}`;
        guestData.tags.loyaltyLevel = i < 2 ? 'bronze' : i < 4 ? 'silver' : 'gold';
        guestData.fulfillmentHistory.currentStage = i % 2 === 0 ? 'awareness' : 'evaluation';
        
        const guest = Guest.fromDocument(guestData);
        testGuests.push(guest);
        await repository.save(guest);
      }
    });

    it('应该能够按忠诚度等级查询', async () => {
      const silverGuests = await repository.findByLoyaltyLevel('silver');
      
      expect(silverGuests).toHaveLength(2);
      silverGuests.forEach(guest => {
        expect(guest.loyaltyLevel).toBe('silver');
      });
    });

    it('应该能够按当前履约阶段查询', async () => {
      const awarenessGuests = await repository.findByCurrentStage('awareness');
      
      expect(awarenessGuests.length).toBeGreaterThan(0);
      awarenessGuests.forEach(guest => {
        expect(guest.currentStage).toBe('awareness');
      });
    });

    it('应该能够按电话号码查询', async () => {
      const testGuest = testGuests[0];
      const foundGuest = await repository.findByPhone(testGuest.personalInfo.phone);
      
      expect(foundGuest).toBeTruthy();
      expect(foundGuest!.id).toBe(testGuest.id);
    });

    it('应该能够分页查询', async () => {
      const page1 = await repository.findWithPagination({ limit: 2, offset: 0 });
      const page2 = await repository.findWithPagination({ limit: 2, offset: 2 });
      
      expect(page1.data).toHaveLength(2);
      expect(page2.data).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page2.total).toBe(5);
      
      // 确保没有重复数据
      const page1Ids = page1.data.map(g => g.id);
      const page2Ids = page2.data.map(g => g.id);
      const intersection = page1Ids.filter(id => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    });

    it('应该支持复合查询条件', async () => {
      const results = await repository.findByMultipleCriteria({
        loyaltyLevel: 'silver',
        currentStage: 'evaluation'
      });
      
      results.forEach(guest => {
        expect(guest.loyaltyLevel).toBe('silver');
        expect(guest.currentStage).toBe('evaluation');
      });
    });
  });

  describe('性能测试', () => {
    it('应该快速执行单个查询(<10ms)', async () => {
      const guest = createMockGuest();
      const guestAggregate = Guest.fromDocument(guest);
      await repository.save(guestAggregate);
      
      const timer = new PerformanceTimer();
      timer.start();
      
      const foundGuest = await repository.findById(guest.id);
      
      const duration = timer.stop();
      
      expect(foundGuest).toBeTruthy();
      expect(duration).toBeLessThan(10); // <10ms
    });

    it('应该高效处理批量插入(≥1000条/秒)', async () => {
      const guests: Guest[] = [];
      
      // 生成1000个测试Guest
      for (let i = 0; i < 1000; i++) {
        const guestData = createMockGuest();
        guestData.id = `batch-guest-${i}`;
        guests.push(Guest.fromDocument(guestData));
      }
      
      const timer = new PerformanceTimer();
      timer.start();
      
      await repository.bulkInsert(guests);
      
      const duration = timer.stop();
      const throughput = 1000 / (duration / 1000); // 每秒处理数量
      
      expect(throughput).toBeGreaterThan(1000); // ≥1000条/秒
    });

    it('应该高效执行复杂查询(<100ms)', async () => {
      // 插入大量测试数据
      const guests: Guest[] = [];
      for (let i = 0; i < 500; i++) {
        const guestData = createMockGuest();
        guestData.id = `perf-guest-${i}`;
        guestData.businessMetrics.lifetimeValue = Math.random() * 10000;
        guestData.tags.loyaltyLevel = ['bronze', 'silver', 'gold', 'platinum'][i % 4];
        guests.push(Guest.fromDocument(guestData));
      }
      
      await repository.bulkInsert(guests);
      
      const timer = new PerformanceTimer();
      timer.start();
      
      // 执行复杂查询
      const results = await repository.findHighValueGuests({
        minLifetimeValue: 5000,
        loyaltyLevels: ['gold', 'platinum'],
        limit: 100
      });
      
      const duration = timer.stop();
      
      expect(duration).toBeLessThan(100); // <100ms
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('内存使用优化', () => {
    it('应该保持合理的内存使用(<20MB/1000条记录)', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      const guests: Guest[] = [];
      for (let i = 0; i < 1000; i++) {
        const guestData = createMockGuest();
        guestData.id = `memory-guest-${i}`;
        guests.push(Guest.fromDocument(guestData));
      }
      
      await repository.bulkInsert(guests);
      
      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      expect(memoryIncrease).toBeLessThan(20); // <20MB
    });
  });

  describe('数据一致性', () => {
    it('应该正确处理并发更新', async () => {
      const guest = createMockGuest();
      const guestAggregate = Guest.fromDocument(guest);
      await repository.save(guestAggregate);
      
      // 模拟两个并发更新
      const guest1 = await repository.findById(guest.id);
      const guest2 = await repository.findById(guest.id);
      
      expect(guest1).toBeTruthy();
      expect(guest2).toBeTruthy();
      
      // 并发更新不同字段
      guest1!.updatePersonalInfo({
        ...guest1!.personalInfo,
        name: '更新1'
      });
      
      guest2!.updatePersonalInfo({
        ...guest2!.personalInfo,
        email: 'updated2@example.com'
      });
      
      // 先保存guest1
      await repository.save(guest1!);
      
      // 保存guest2时应该处理冲突
      try {
        await repository.save(guest2!);
        // 如果成功，验证最终状态
        const finalGuest = await repository.findById(guest.id);
        expect(finalGuest).toBeTruthy();
      } catch (error) {
        // 如果发生冲突，应该是版本冲突错误
        expect(error.message).toContain('version conflict');
      }
    });

    it('应该保持数据完整性约束', async () => {
      const guest = createMockGuest();
      guest.personalInfo.phone = ''; // 无效电话号码
      
      const guestAggregate = Guest.fromDocument(guest);
      
      // 应该抛出验证错误
      await expect(repository.save(guestAggregate)).rejects.toThrow();
    });
  });

  describe('事务处理', () => {
    it('应该支持批量操作的原子性', async () => {
      const guests: Guest[] = [];
      for (let i = 0; i < 3; i++) {
        const guestData = createMockGuest();
        guestData.id = `transaction-guest-${i}`;
        guests.push(Guest.fromDocument(guestData));
      }
      
      // 故意在第二个guest中制造错误
      guests[1].updatePersonalInfo({
        ...guests[1].personalInfo,
        phone: '' // 无效数据
      });
      
      // 批量保存应该全部失败
      await expect(repository.bulkInsert(guests)).rejects.toThrow();
      
      // 验证没有任何guest被保存
      for (const guest of guests) {
        const foundGuest = await repository.findById(guest.id);
        expect(foundGuest).toBeNull();
      }
    });
  });

  describe('索引性能', () => {
    it('应该正确使用数据库索引', async () => {
      // 创建大量测试数据
      const guests: Guest[] = [];
      for (let i = 0; i < 1000; i++) {
        const guestData = createMockGuest();
        guestData.id = `index-guest-${i}`;
        guestData.personalInfo.phone = `138${String(i).padStart(8, '0')}`;
        guests.push(Guest.fromDocument(guestData));
      }
      
      await repository.bulkInsert(guests);
      
      const timer = new PerformanceTimer();
      timer.start();
      
      // 使用索引字段查询
      const foundGuest = await repository.findByPhone('13800000500');
      
      const duration = timer.stop();
      
      expect(foundGuest).toBeTruthy();
      expect(duration).toBeLessThan(10); // 索引查询应该很快
    });

    it('应该优化复合索引查询', async () => {
      const guests: Guest[] = [];
      for (let i = 0; i < 500; i++) {
        const guestData = createMockGuest();
        guestData.id = `compound-guest-${i}`;
        guestData.tags.loyaltyLevel = ['bronze', 'silver'][i % 2];
        guestData.fulfillmentHistory.currentStage = ['awareness', 'evaluation'][i % 2];
        guests.push(Guest.fromDocument(guestData));
      }
      
      await repository.bulkInsert(guests);
      
      const timer = new PerformanceTimer();
      timer.start();
      
      // 使用复合索引查询
      const results = await repository.findByMultipleCriteria({
        loyaltyLevel: 'silver',
        currentStage: 'evaluation'
      });
      
      const duration = timer.stop();
      
      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(50); // 复合索引查询优化
    });
  });
});