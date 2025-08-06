/**
 * 数据库配置管理器
 * 支持 PouchDB Server 和 IBM Cloudant 的自动切换
 */

// 数据库类型检测
const DB_TYPE = process.env.DB_TYPE || 'pouchdb'; // 'pouchdb' 或 'cloudant'

// 数据库配置
const DATABASE_CONFIG = {
  pouchdb: {
    type: 'pouchdb',
    name: 'PouchDB Server (内存)',
    inMemory: true,
    persistent: false,
    setup: {
      requires: ['express-pouchdb', 'pouchdb-adapter-memory'],
      envVars: []
    }
  },
  
  cloudant: {
    type: 'cloudant', 
    name: 'IBM Cloudant',
    inMemory: false,
    persistent: true,
    setup: {
      requires: ['http-proxy-middleware'],
      envVars: ['COUCHDB_URL', 'COUCHDB_APIKEY']
    },
    credentials: {
      url: process.env.COUCHDB_URL,
      apikey: process.env.COUCHDB_APIKEY,
      username: 'apikey'
    }
  }
};

// 当前配置
const currentConfig = DATABASE_CONFIG[DB_TYPE];

// 验证配置
function validateConfig() {
  if (DB_TYPE === 'cloudant') {
    const missing = currentConfig.setup.envVars.filter(
      env => !process.env[env]
    );
    
    if (missing.length > 0) {
      console.warn(`⚠️  Cloudant 配置不完整，缺少环境变量: ${missing.join(', ')}`);
      console.warn(`⚠️  自动降级到 PouchDB Server`);
      return false;
    }
  }
  return true;
}

// 获取有效配置
function getEffectiveConfig() {
  if (DB_TYPE === 'cloudant' && validateConfig()) {
    return DATABASE_CONFIG.cloudant;
  }
  return DATABASE_CONFIG.pouchdb;
}

module.exports = {
  DB_TYPE,
  DATABASE_CONFIG,
  currentConfig: getEffectiveConfig(),
  validateConfig,
  
  // 工具方法
  isPouchDB: () => getEffectiveConfig().type === 'pouchdb',
  isCloudant: () => getEffectiveConfig().type === 'cloudant',
  
  // 获取连接信息
  getConnectionInfo: () => {
    const config = getEffectiveConfig();
    
    if (config.type === 'cloudant') {
      return {
        type: 'cloudant',
        url: config.credentials.url,
        auth: {
          username: config.credentials.username,
          password: config.credentials.apikey
        }
      };
    }
    
    return {
      type: 'pouchdb',
      inMemory: true
    };
  },
  
  // 获取同步端点信息
  getSyncEndpoint: () => {
    return '/db'; // 统一的同步端点
  },
  
  // 获取状态信息
  getStatus: () => {
    const config = getEffectiveConfig();
    return {
      type: config.type,
      name: config.name,
      persistent: config.persistent,
      configured: validateConfig()
    };
  }
};