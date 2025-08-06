#!/bin/bash

# 切换到 IBM Cloudant 的自动化脚本
# 使用方法: ./scripts/switch-to-cloudant.sh <CLOUDANT_URL> <API_KEY>

set -e

echo "🔄 履约驱动酒店管理系统 - Cloudant 自动切换脚本"
echo "=================================================="

# 检查参数
if [ $# -ne 2 ]; then
    echo "❌ 使用方法: $0 <CLOUDANT_URL> <API_KEY>"
    echo ""
    echo "示例:"
    echo "  $0 https://your-account.cloudantnosqldb.appdomain.cloud your-api-key-here"
    echo ""
    echo "💡 获取这些信息:"
    echo "  1. 登录 IBM Cloud: https://cloud.ibm.com/"
    echo "  2. 进入你的 Cloudant 服务"
    echo "  3. 点击 'Service credentials'"
    echo "  4. 复制 'url' 和 'apikey' 字段"
    exit 1
fi

CLOUDANT_URL="$1"
API_KEY="$2"

echo "🔍 验证参数..."
if [[ ! "$CLOUDANT_URL" =~ ^https://.*\.cloudantnosqldb\.appdomain\.cloud$ ]]; then
    echo "❌ Cloudant URL 格式错误"
    echo "   应该类似: https://xxx.cloudantnosqldb.appdomain.cloud"
    exit 1
fi

if [[ ${#API_KEY} -lt 30 ]]; then
    echo "❌ API Key 长度太短，请检查是否正确"
    exit 1
fi

echo "✅ 参数验证通过"

# 测试 Cloudant 连接
echo "🔗 测试 Cloudant 连接..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -u "apikey:$API_KEY" \
    "$CLOUDANT_URL/_up")

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ Cloudant 连接成功"
else
    echo "❌ Cloudant 连接失败 (HTTP $HTTP_CODE)"
    echo "   请检查 URL 和 API Key 是否正确"
    exit 1
fi

# 创建环境变量文件
echo "📝 创建环境变量配置..."
cat > .env.cloudant << EOF
# IBM Cloudant 配置
DB_TYPE=cloudant
COUCHDB_URL=$CLOUDANT_URL
COUCHDB_APIKEY=$API_KEY

# 其他配置保持不变
NODE_ENV=production
CORS_ORIGIN=https://archpeng.github.io
EOF

echo "✅ 环境变量配置已保存到 .env.cloudant"

# 显示 Railway 部署说明
echo ""
echo "🚀 Railway 部署说明:"
echo "==================="
echo ""
echo "1️⃣ 登录 Railway 控制台:"
echo "   https://railway.app/"
echo ""
echo "2️⃣ 进入你的项目设置，添加以下环境变量:"
echo ""
echo "   DB_TYPE = cloudant"
echo "   COUCHDB_URL = $CLOUDANT_URL"
echo "   COUCHDB_APIKEY = $API_KEY"
echo ""
echo "3️⃣ Railway 会自动重新部署并切换到 Cloudant"
echo ""
echo "4️⃣ 访问以下地址验证切换成功:"
echo "   https://fulfillment-driven-hotel-management-production.up.railway.app/health"
echo ""
echo "5️⃣ 在健康检查响应中，你应该看到:"
echo '   "database": { "type": "cloudant", "persistent": true }'
echo ""

# 初始化数据库结构
echo "🗄️  准备数据库初始化脚本..."
cat > scripts/init-cloudant-databases.js << 'EOF'
#!/usr/bin/env node

/**
 * Cloudant 数据库初始化脚本
 */

const https = require('https');
const { URL } = require('url');

const CLOUDANT_URL = process.env.COUCHDB_URL;
const API_KEY = process.env.COUCHDB_APIKEY;

if (!CLOUDANT_URL || !API_KEY) {
    console.error('❌ 请设置 COUCHDB_URL 和 COUCHDB_APIKEY 环境变量');
    process.exit(1);
}

const databases = ['guests', 'fulfillment_journeys'];

async function createDatabase(dbName) {
    return new Promise((resolve, reject) => {
        const url = new URL(`/${dbName}`, CLOUDANT_URL);
        const auth = Buffer.from(`apikey:${API_KEY}`).toString('base64');
        
        const options = {
            method: 'PUT',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const result = JSON.parse(data);
                if (res.statusCode === 201 || result.error === 'file_exists') {
                    console.log(`✅ 数据库 ${dbName} 已准备就绪`);
                    resolve(true);
                } else {
                    console.log(`❌ 创建数据库 ${dbName} 失败:`, result);
                    resolve(false);
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function initDatabases() {
    console.log('🗄️ 初始化 Cloudant 数据库...');
    
    for (const dbName of databases) {
        await createDatabase(dbName);
    }
    
    console.log('✅ 数据库初始化完成');
}

initDatabases().catch(console.error);
EOF

chmod +x scripts/init-cloudant-databases.js

echo "✅ 数据库初始化脚本已创建"

# 本地测试说明
echo ""
echo "🧪 本地测试说明:"
echo "================"
echo ""
echo "1️⃣ 加载环境变量:"
echo "   source .env.cloudant"
echo ""
echo "2️⃣ 启动本地服务器:"
echo "   cd backend && npm run dev:cloudant"
echo ""
echo "3️⃣ 测试连接:"
echo "   curl http://localhost:3000/health"
echo ""

echo "🎉 Cloudant 自动切换脚本执行完成！"
echo ""
echo "⚠️  重要提醒:"
echo "   - 请妥善保管你的 API Key"
echo "   - 不要将 .env.cloudant 文件提交到 Git"
echo "   - Railway 环境变量设置后会自动重新部署"