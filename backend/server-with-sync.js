/**
 * 履约驱动酒店管理系统 - 带数据同步的后端服务
 * 集成 PouchDB Server 实现 RxDB 同步功能
 */

const express = require('express');
const cors = require('cors');
const PouchDB = require('pouchdb');
const expressPouchDB = require('express-pouchdb');

// 配置 PouchDB
PouchDB.plugin(require('pouchdb-adapter-memory'));

const app = express();
const PORT = process.env.PORT || 3000;

// 创建 PouchDB 实例配置
const pouchDBOptions = {
  mode: 'minimumForPouchDB',
  overrideMode: {
    include: ['routes/fauxton']
  }
};

// 创建内存数据库（生产环境可以改为持久化存储）
const MemPouchDB = PouchDB.defaults({
  adapter: 'memory'
});

// 中间件配置
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// PouchDB Server 路由 - 用于 RxDB 同步
app.use('/db', expressPouchDB(MemPouchDB, pouchDBOptions));

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: '履约驱动酒店管理系统',
    version: '1.2.0',
    features: ['api', 'sync'],
    syncEndpoint: '/db',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API版本信息
app.get('/api/version', (req, res) => {
  res.json({
    name: 'fulfillment-driven-hotel-management',
    version: '1.2.0',
    architecture: '厚客户端模块化单体',
    philosophy: '我们不管理客房，我们管理客人',
    features: [
      '履约驱动架构',
      'DDD领域设计', 
      'XState状态机',
      '离线优先',
      'RxDB-PouchDB同步',
      '90%测试覆盖率'
    ],
    syncCapabilities: {
      enabled: true,
      protocol: 'PouchDB Replication Protocol',
      endpoint: '/db',
      databases: ['guests', 'fulfillment_journeys']
    },
    deployment: {
      platform: 'Railway',
      region: process.env.RAILWAY_REGION || 'unknown',
      deployedAt: new Date().toISOString()
    }
  });
});

// 同步状态端点
app.get('/api/sync/status', async (req, res) => {
  try {
    // 获取所有数据库信息
    const allDbs = await MemPouchDB.allDbs();
    
    const dbStats = await Promise.all(
      allDbs.map(async (dbName) => {
        const db = new MemPouchDB(dbName);
        const info = await db.info();
        return {
          name: dbName,
          docCount: info.doc_count,
          updateSeq: info.update_seq,
          diskSize: info.disk_size || 0
        };
      })
    );
    
    res.json({
      success: true,
      syncEnabled: true,
      databases: dbStats,
      totalDatabases: allDbs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取同步状态失败',
      error: error.message
    });
  }
});

// 认证服务 (演示版本)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 演示认证逻辑
    if (username === 'demo' && password === 'demo123') {
      res.json({
        success: true,
        token: 'demo-jwt-token-' + Date.now(),
        user: {
          id: 'demo-user-' + Date.now(),
          name: '演示用户',
          role: 'hotel-manager',
          permissions: ['guest-management', 'fulfillment-tracking', 'data-sync']
        },
        syncAccess: {
          enabled: true,
          databases: ['guests', 'fulfillment_journeys']
        },
        message: '登录成功'
      });
    } else {
      res.status(401).json({
        success: false,
        message: '用户名或密码错误 (提示: demo/demo123)'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '登录服务异常',
      error: error.message
    });
  }
});

// 数据验证服务
app.post('/api/validate/booking', async (req, res) => {
  try {
    const { guestId, roomType, checkIn, checkOut, amount } = req.body;
    
    // 业务规则验证
    const validations = {
      guestIdValid: !!guestId,
      roomTypeValid: ['standard', 'deluxe', 'suite', 'presidential'].includes(roomType),
      dateValid: new Date(checkIn) < new Date(checkOut),
      amountValid: amount > 0 && amount < 10000,
      checkInFuture: new Date(checkIn) > new Date()
    };
    
    const isValid = Object.values(validations).every(v => v);
    
    res.json({
      valid: isValid,
      validations,
      message: isValid ? '预订数据验证通过' : '预订数据存在问题',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      valid: false,
      message: '验证服务异常',
      error: error.message
    });
  }
});

// 履约统计服务 (演示数据)
app.get('/api/stats/fulfillment', async (req, res) => {
  try {
    // 生成一些动态演示数据
    const now = new Date();
    const baseGuests = 1250;
    const variance = Math.floor(Math.random() * 100) - 50;
    
    const stats = {
      totalGuests: baseGuests + variance,
      activeJourneys: 89 + Math.floor(Math.random() * 20),
      completedJourneys: (baseGuests + variance) - (89 + Math.floor(Math.random() * 20)),
      conversionRates: {
        awarenessToEvaluation: 68.5 + Math.random() * 10,
        evaluationToBooking: 45.2 + Math.random() * 10,
        bookingToExperience: 96.8 + Math.random() * 2,
        experienceToFeedback: 78.3 + Math.random() * 10
      },
      averageScore: 87.5 + Math.random() * 5,
      topPerformingStage: ['awareness', 'evaluation', 'booking', 'experiencing', 'feedback'][
        Math.floor(Math.random() * 5)
      ],
      syncStatus: {
        lastSync: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        pendingChanges: Math.floor(Math.random() * 10),
        syncEnabled: true
      },
      lastUpdated: now.toISOString(),
      dataSource: 'demo-simulation'
    };
    
    res.json({
      success: true,
      data: stats,
      timestamp: now.toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '统计服务异常',
      error: error.message
    });
  }
});

// SLA监控端点 (动态演示数据)
app.get('/api/monitoring/sla', async (req, res) => {
  try {
    const slaMetrics = {
      responseTime: {
        p50: 8.5 + Math.random() * 5,
        p95: 15.2 + Math.random() * 10,
        p99: 28.7 + Math.random() * 15
      },
      availability: 99.95 + Math.random() * 0.04,
      errorRate: 0.02 + Math.random() * 0.03,
      throughput: 1250.5 + Math.random() * 200,
      syncMetrics: {
        replicationLag: Math.random() * 100, // ms
        conflictRate: Math.random() * 0.5, // %
        syncQueueSize: Math.floor(Math.random() * 50)
      },
      memoryUsage: 65.3 + Math.random() * 15,
      cpuUsage: 23.4 + Math.random() * 20,
      lastUpdated: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    res.json({
      success: true,
      metrics: slaMetrics,
      status: slaMetrics.availability > 99.5 ? 'healthy' : 'degraded'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'SLA监控服务异常',
      error: error.message
    });
  }
});

// API文档端点
app.get('/api/docs', (req, res) => {
  res.json({
    service: '履约驱动酒店管理系统 API',
    version: '1.2.0',
    philosophy: '我们不管理客房，我们管理客人',
    endpoints: {
      'GET /health': '健康检查',
      'GET /api/version': 'API版本信息',
      'POST /api/auth/login': '用户认证 (demo/demo123)',
      'POST /api/validate/booking': '预订数据验证',
      'GET /api/stats/fulfillment': '履约统计数据',
      'GET /api/monitoring/sla': 'SLA监控指标',
      'GET /api/sync/status': '同步状态信息',
      'GET /api/docs': 'API文档 (当前页面)',
      'ALL /db/*': 'PouchDB同步端点 (RxDB兼容)'
    },
    syncInstructions: {
      description: '使用RxDB的replication功能连接到 /db 端点',
      example: {
        url: 'https://your-backend-url/db/',
        collections: ['guests', 'fulfillment_journeys'],
        auth: '使用JWT token进行认证'
      }
    },
    examples: {
      login: {
        url: '/api/auth/login',
        method: 'POST',
        body: {
          username: 'demo',
          password: 'demo123'
        }
      },
      validation: {
        url: '/api/validate/booking',
        method: 'POST',
        body: {
          guestId: 'guest-123',
          roomType: 'deluxe',
          checkIn: '2025-08-10',
          checkOut: '2025-08-12',
          amount: 500
        }
      }
    }
  });
});

// CORS preflight 处理
app.options('*', cors());

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: '服务暂时不可用，请稍后重试',
    timestamp: new Date().toISOString()
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'API端点不存在',
    requestedPath: req.originalUrl,
    availableEndpoints: [
      'GET /health',
      'GET /api/version',
      'GET /api/docs',
      'GET /api/sync/status',
      'POST /api/auth/login',
      'POST /api/validate/booking',
      'GET /api/stats/fulfillment',
      'GET /api/monitoring/sla',
      'ALL /db/* (PouchDB同步)'
    ],
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🏨 履约驱动酒店管理系统 - 后端服务启动成功
📍 端口: ${PORT}
🌐 环境: ${process.env.NODE_ENV || 'development'}
🔄 同步端点: /db
💡 理念: "我们不管理客房，我们管理客人"
🚀 部署平台: Railway
✨ 特性: API服务 + RxDB同步支持
📖 API文档: /api/docs
  `);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，开始优雅关闭...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，开始优雅关闭...');
  process.exit(0);
});