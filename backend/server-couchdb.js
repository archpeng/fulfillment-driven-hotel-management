/**
 * 履约驱动酒店管理系统 - CouchDB 集成版本
 * 使用外部 CouchDB 服务进行数据持久化
 */

const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// CouchDB 配置
const COUCHDB_URL = process.env.COUCHDB_URL || 'https://your-account.cloudantnosqldb.appdomain.cloud';
const COUCHDB_USER = process.env.COUCHDB_USER || 'apikey';
const COUCHDB_PASSWORD = process.env.COUCHDB_PASSWORD || 'your-api-key';

// 中间件配置
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/health', async (req, res) => {
  try {
    // 检查 CouchDB 连接
    const couchResponse = await fetch(`${COUCHDB_URL}/_up`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`).toString('base64')
      }
    });

    const couchHealthy = couchResponse.ok;

    res.json({
      status: couchHealthy ? 'healthy' : 'degraded',
      service: '履约驱动酒店管理系统',
      version: '1.3.0',
      features: ['api', 'couchdb-sync'],
      database: {
        type: 'CouchDB',
        healthy: couchHealthy,
        url: COUCHDB_URL.replace(/https?:\/\/([^:]+):.*@/, 'https://$1:***@')
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

// API版本信息
app.get('/api/version', (req, res) => {
  res.json({
    name: 'fulfillment-driven-hotel-management',
    version: '1.3.0',
    architecture: '厚客户端模块化单体',
    philosophy: '我们不管理客房，我们管理客人',
    features: [
      '履约驱动架构',
      'DDD领域设计', 
      'XState状态机',
      '离线优先',
      'CouchDB持久化存储',
      '90%测试覆盖率'
    ],
    database: {
      type: 'CouchDB/Cloudant',
      features: [
        '持久化存储',
        '自动备份',
        '全球复制',
        '冲突解决',
        'MapReduce视图'
      ]
    }
  });
});

// CouchDB 代理配置
const couchProxyMiddleware = createProxyMiddleware({
  target: COUCHDB_URL,
  changeOrigin: true,
  auth: `${COUCHDB_USER}:${COUCHDB_PASSWORD}`,
  pathRewrite: {
    '^/db': ''
  },
  onProxyReq: (proxyReq, req, res) => {
    // 添加必要的头
    proxyReq.setHeader('Accept', 'application/json');
    proxyReq.setHeader('Content-Type', 'application/json');
    
    // 记录请求
    console.log(`[CouchDB Proxy] ${req.method} ${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // 添加 CORS 头
    proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
  },
  onError: (err, req, res) => {
    console.error('[CouchDB Proxy] Error:', err.message);
    res.status(502).json({
      error: 'Database connection failed',
      message: '数据同步服务暂时不可用',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// CouchDB 代理路由
app.use('/db', couchProxyMiddleware);

// 数据库初始化端点
app.post('/api/db/init', async (req, res) => {
  try {
    const databases = ['guests', 'fulfillment_journeys'];
    const results = [];

    for (const dbName of databases) {
      try {
        // 创建数据库
        const response = await fetch(`${COUCHDB_URL}/${dbName}`, {
          method: 'PUT',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`).toString('base64'),
            'Content-Type': 'application/json'
          }
        });

        const result = await response.json();
        results.push({
          database: dbName,
          created: response.ok,
          message: result.error || 'Success'
        });

        // 如果数据库创建成功，设置索引
        if (response.ok || result.error === 'file_exists') {
          await createIndexes(dbName);
        }
      } catch (error) {
        results.push({
          database: dbName,
          created: false,
          message: error.message
        });
      }
    }

    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '数据库初始化失败',
      error: error.message
    });
  }
});

// 创建数据库索引
async function createIndexes(dbName) {
  const indexes = {
    guests: [
      { fields: ['personalInfo.phone'] },
      { fields: ['fulfillmentHistory.currentStage'] },
      { fields: ['tags.loyaltyLevel'] },
      { fields: ['createdAt'] }
    ],
    fulfillment_journeys: [
      { fields: ['guestId'] },
      { fields: ['currentStage'] },
      { fields: ['status'] },
      { fields: ['startDate'] }
    ]
  };

  if (indexes[dbName]) {
    for (const index of indexes[dbName]) {
      try {
        await fetch(`${COUCHDB_URL}/${dbName}/_index`, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`).toString('base64'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            index: index,
            type: 'json'
          })
        });
      } catch (error) {
        console.error(`创建索引失败 ${dbName}:`, error);
      }
    }
  }
}

// 同步统计端点
app.get('/api/sync/stats', async (req, res) => {
  try {
    const databases = ['guests', 'fulfillment_journeys'];
    const stats = [];

    for (const dbName of databases) {
      try {
        const response = await fetch(`${COUCHDB_URL}/${dbName}`, {
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`).toString('base64')
          }
        });

        if (response.ok) {
          const info = await response.json();
          stats.push({
            database: dbName,
            docCount: info.doc_count,
            diskSize: info.disk_size,
            compactRunning: info.compact_running
          });
        }
      } catch (error) {
        stats.push({
          database: dbName,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      databases: stats,
      couchdbUrl: COUCHDB_URL.replace(/https?:\/\/([^:]+):.*@/, 'https://$1:***@'),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取同步统计失败',
      error: error.message
    });
  }
});

// 认证服务
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (username === 'demo' && password === 'demo123') {
      res.json({
        success: true,
        token: 'demo-jwt-token-' + Date.now(),
        user: {
          id: 'demo-user',
          name: '演示用户',
          role: 'hotel-manager',
          permissions: ['guest-management', 'fulfillment-tracking', 'data-sync']
        },
        database: {
          type: 'CouchDB',
          syncUrl: '/db',
          collections: ['guests', 'fulfillment_journeys']
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '登录服务异常'
    });
  }
});

// API文档
app.get('/api/docs', (req, res) => {
  res.json({
    service: '履约驱动酒店管理系统 API (CouchDB版)',
    version: '1.3.0',
    endpoints: {
      'GET /health': '健康检查（包含CouchDB状态）',
      'GET /api/version': 'API版本信息',
      'POST /api/auth/login': '用户认证',
      'POST /api/db/init': '初始化数据库',
      'GET /api/sync/stats': '同步统计信息',
      'ALL /db/*': 'CouchDB代理（用于RxDB同步）'
    },
    couchdb: {
      setup: '需要配置 COUCHDB_URL, COUCHDB_USER, COUCHDB_PASSWORD 环境变量',
      sync: 'RxDB可以直接连接到 /db 端点进行同步'
    }
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: '服务暂时不可用'
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'API端点不存在',
    path: req.originalUrl
  });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🏨 履约驱动酒店管理系统 - CouchDB版本
📍 端口: ${PORT}
🌐 环境: ${process.env.NODE_ENV || 'development'}
🗄️  CouchDB: ${COUCHDB_URL ? '已配置' : '未配置'}
💡 理念: "我们不管理客房，我们管理客人"

请确保设置以下环境变量:
- COUCHDB_URL
- COUCHDB_USER  
- COUCHDB_PASSWORD
- CORS_ORIGIN
  `);
});

process.on('SIGTERM', () => {
  console.log('优雅关闭...');
  process.exit(0);
});