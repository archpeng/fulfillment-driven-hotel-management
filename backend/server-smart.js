/**
 * 履约驱动酒店管理系统 - 智能数据库切换版本
 * 自动检测环境变量，在 PouchDB Server 和 IBM Cloudant 之间切换
 */

const express = require('express');
const cors = require('cors');
const dbConfig = require('./database-config');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 动态设置数据库中间件
let dbMiddleware;

async function setupDatabase() {
  if (dbConfig.isPouchDB()) {
    // PouchDB Server 配置
    console.log('📦 初始化 PouchDB Server...');
    
    const PouchDB = require('pouchdb');
    const expressPouchDB = require('express-pouchdb');
    
    PouchDB.plugin(require('pouchdb-adapter-memory'));
    
    const MemPouchDB = PouchDB.defaults({
      adapter: 'memory'
    });
    
    const pouchDBOptions = {
      mode: 'minimumForPouchDB',
      overrideMode: {
        include: ['routes/fauxton']
      }
    };
    
    dbMiddleware = expressPouchDB(MemPouchDB, pouchDBOptions);
    
  } else if (dbConfig.isCloudant()) {
    // Cloudant 代理配置
    console.log('☁️  初始化 Cloudant 连接...');
    
    const { createProxyMiddleware } = require('http-proxy-middleware');
    const connectionInfo = dbConfig.getConnectionInfo();
    
    dbMiddleware = createProxyMiddleware({
      target: connectionInfo.url,
      changeOrigin: true,
      auth: `${connectionInfo.auth.username}:${connectionInfo.auth.password}`,
      pathRewrite: {
        '^/db': ''
      },
      onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('Accept', 'application/json');
        proxyReq.setHeader('Content-Type', 'application/json');
        console.log(`[Cloudant Proxy] ${req.method} ${req.url}`);
      },
      onProxyRes: (proxyRes, req, res) => {
        proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
        proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
      },
      onError: (err, req, res) => {
        console.error('[Cloudant Proxy] Error:', err.message);
        res.status(502).json({
          error: 'Database connection failed',
          message: '数据同步服务暂时不可用',
          type: 'cloudant'
        });
      }
    });
  }
  
  // 设置数据库路由
  app.use('/db', dbMiddleware);
}

// 健康检查
app.get('/health', async (req, res) => {
  const dbStatus = dbConfig.getStatus();
  let dbHealthy = true;
  let dbDetails = {};

  try {
    if (dbConfig.isCloudant()) {
      // 检查 Cloudant 连接
      const connectionInfo = dbConfig.getConnectionInfo();
      const response = await fetch(`${connectionInfo.url}/_up`, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${connectionInfo.auth.username}:${connectionInfo.auth.password}`).toString('base64')
        }
      });
      dbHealthy = response.ok;
      dbDetails = { cloudant: { connected: dbHealthy, url: connectionInfo.url } };
    } else {
      // PouchDB Server 总是健康的
      dbDetails = { pouchdb: { inMemory: true, status: 'running' } };
    }
  } catch (error) {
    dbHealthy = false;
    dbDetails = { error: error.message };
  }

  res.json({
    status: dbHealthy ? 'healthy' : 'degraded',
    service: '履约驱动酒店管理系统',
    version: '1.4.0',
    features: ['api', 'smart-db-switching'],
    database: {
      ...dbStatus,
      healthy: dbHealthy,
      details: dbDetails,
      switchInstructions: {
        toPouchDB: '设置环境变量: DB_TYPE=pouchdb',
        toCloudant: '设置环境变量: DB_TYPE=cloudant, COUCHDB_URL=<url>, COUCHDB_APIKEY=<key>'
      }
    },
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API版本信息
app.get('/api/version', (req, res) => {
  const dbStatus = dbConfig.getStatus();
  
  res.json({
    name: 'fulfillment-driven-hotel-management',
    version: '1.4.0',
    architecture: '厚客户端模块化单体',
    philosophy: '我们不管理客房，我们管理客人',
    features: [
      '履约驱动架构',
      'DDD领域设计', 
      'XState状态机',
      '离线优先',
      '智能数据库切换',
      '90%测试覆盖率'
    ],
    database: {
      current: dbStatus,
      capabilities: {
        pouchdb: '内存存储，立即可用，重启数据丢失',
        cloudant: '持久化存储，企业级备份，全球复制'
      },
      switching: {
        automatic: true,
        configurable: true,
        instructions: '通过环境变量 DB_TYPE 控制'
      }
    },
    syncCapabilities: {
      enabled: true,
      protocol: 'PouchDB Replication Protocol',
      endpoint: '/db',
      collections: ['guests', 'fulfillment_journeys']
    }
  });
});

// 数据库状态和切换信息
app.get('/api/database/status', (req, res) => {
  const status = dbConfig.getStatus();
  const connectionInfo = dbConfig.getConnectionInfo();
  
  res.json({
    success: true,
    current: status,
    connection: {
      type: connectionInfo.type,
      endpoint: dbConfig.getSyncEndpoint(),
      persistent: status.persistent
    },
    switching: {
      available: ['pouchdb', 'cloudant'],
      current: status.type,
      howTo: {
        description: '通过环境变量切换数据库类型',
        variables: {
          DB_TYPE: 'pouchdb 或 cloudant',
          COUCHDB_URL: '仅Cloudant需要',
          COUCHDB_APIKEY: '仅Cloudant需要'
        }
      }
    },
    timestamp: new Date().toISOString()
  });
});

// 数据库切换端点（重启应用后生效）
app.post('/api/database/switch', (req, res) => {
  const { type, credentials } = req.body;
  
  if (!['pouchdb', 'cloudant'].includes(type)) {
    return res.status(400).json({
      success: false,
      message: '不支持的数据库类型',
      supportedTypes: ['pouchdb', 'cloudant']
    });
  }
  
  // 这个端点只是提供说明，实际切换需要重启
  res.json({
    success: false,
    message: '数据库切换需要重启应用',
    instructions: {
      step1: `设置环境变量 DB_TYPE=${type}`,
      step2: type === 'cloudant' ? '设置 COUCHDB_URL 和 COUCHDB_APIKEY' : '无需其他配置',
      step3: '重启应用生效',
      railwayTip: '在 Railway 项目设置中更新环境变量后会自动重启'
    },
    currentType: dbConfig.getStatus().type,
    targetType: type
  });
});

// 认证服务
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const dbStatus = dbConfig.getStatus();
    
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
        database: {
          type: dbStatus.type,
          name: dbStatus.name,
          persistent: dbStatus.persistent,
          syncUrl: '/db',
          collections: ['guests', 'fulfillment_journeys']
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

// 同步统计
app.get('/api/sync/status', async (req, res) => {
  try {
    const dbStatus = dbConfig.getStatus();
    
    if (dbConfig.isCloudant()) {
      // Cloudant 统计
      const connectionInfo = dbConfig.getConnectionInfo();
      const databases = ['guests', 'fulfillment_journeys'];
      const stats = [];

      for (const dbName of databases) {
        try {
          const response = await fetch(`${connectionInfo.url}/${dbName}`, {
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${connectionInfo.auth.username}:${connectionInfo.auth.password}`).toString('base64')
            }
          });

          if (response.ok) {
            const info = await response.json();
            stats.push({
              name: dbName,
              docCount: info.doc_count,
              updateSeq: info.update_seq,
              diskSize: info.disk_size,
              compactRunning: info.compact_running
            });
          } else {
            stats.push({
              name: dbName,
              error: '数据库不存在或无权限访问'
            });
          }
        } catch (error) {
          stats.push({
            name: dbName,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        syncEnabled: true,
        databaseType: 'cloudant',
        persistent: true,
        databases: stats,
        timestamp: new Date().toISOString()
      });
      
    } else {
      // PouchDB 统计（模拟）
      res.json({
        success: true,
        syncEnabled: true,
        databaseType: 'pouchdb',
        persistent: false,
        databases: [
          {
            name: 'guests',
            docCount: 0,
            updateSeq: 0,
            diskSize: 0,
            note: '内存数据库，重启后清空'
          },
          {
            name: 'fulfillment_journeys',
            docCount: 0,
            updateSeq: 0,
            diskSize: 0,
            note: '内存数据库，重启后清空'
          }
        ],
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取同步状态失败',
      error: error.message
    });
  }
});

// API文档
app.get('/api/docs', (req, res) => {
  const dbStatus = dbConfig.getStatus();
  
  res.json({
    service: '履约驱动酒店管理系统 API',
    version: '1.4.0',
    philosophy: '我们不管理客房，我们管理客人',
    currentDatabase: dbStatus,
    endpoints: {
      'GET /health': '健康检查（包含数据库状态）',
      'GET /api/version': 'API版本信息',
      'GET /api/database/status': '数据库状态和切换信息',
      'POST /api/database/switch': '数据库切换说明',
      'POST /api/auth/login': '用户认证 (demo/demo123)',
      'GET /api/sync/status': '同步状态信息',
      'GET /api/docs': 'API文档 (当前页面)',
      'ALL /db/*': '数据库同步端点 (自动适配)'
    },
    databaseSwitching: {
      description: '通过环境变量自动切换数据库',
      supported: ['pouchdb', 'cloudant'],
      configuration: {
        pouchdb: {
          envVars: ['DB_TYPE=pouchdb'],
          features: ['内存存储', '立即可用', '开发测试']
        },
        cloudant: {
          envVars: ['DB_TYPE=cloudant', 'COUCHDB_URL', 'COUCHDB_APIKEY'],
          features: ['持久化存储', '企业级', '自动备份']
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
      'GET /api/database/status',
      'POST /api/auth/login',
      'GET /api/sync/status',
      'GET /api/docs',
      'ALL /db/* (数据库同步)'
    ],
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
async function startServer() {
  try {
    // 设置数据库
    await setupDatabase();
    
    const dbStatus = dbConfig.getStatus();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
🏨 履约驱动酒店管理系统 - 智能数据库版本
📍 端口: ${PORT}
🌐 环境: ${process.env.NODE_ENV || 'development'}
🗄️  数据库: ${dbStatus.name} (${dbStatus.type})
💾 持久化: ${dbStatus.persistent ? '是' : '否'}
🔄 同步端点: /db
💡 理念: "我们不管理客房，我们管理客人"
🚀 部署平台: Railway
✨ 特性: 智能数据库切换

🔧 数据库切换:
   当前: ${dbStatus.type}
   切换: 设置环境变量 DB_TYPE=cloudant + COUCHDB_URL + COUCHDB_APIKEY
      `);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，开始优雅关闭...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，开始优雅关闭...');
  process.exit(0);
});

// 启动应用
startServer();