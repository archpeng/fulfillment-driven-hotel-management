/**
 * Vercel Serverless Function - 健康检查
 * 部署到 /api/health
 */

export default function handler(req, res) {
  // 设置CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 健康检查响应
  res.status(200).json({
    status: 'healthy',
    service: '履约驱动酒店管理系统',
    version: '1.1.0',
    timestamp: new Date().toISOString(),
    philosophy: '我们不管理客房，我们管理客人',
    deployment: 'Vercel Serverless Functions',
    endpoints: [
      '/api/health',
      '/api/version', 
      '/api/auth',
      '/api/validate',
      '/api/stats'
    ]
  });
}