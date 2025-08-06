/**
 * Vercel Serverless Function - 认证服务
 * 部署到 /api/auth
 */

export default function handler(req, res) {
  // 设置CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { username, password, action } = req.body;

    // 登录逻辑
    if (action === 'login') {
      if (username === 'demo' && password === 'demo123') {
        return res.status(200).json({
          success: true,
          token: 'demo-jwt-token-' + Date.now(),
          user: {
            id: 'demo-user',
            name: '演示用户',
            role: 'hotel-manager',
            permissions: ['guest-management', 'fulfillment-tracking']
          },
          message: '登录成功'
        });
      } else {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }
    }

    // Token验证逻辑
    if (action === 'verify') {
      const { token } = req.body;
      
      if (token && token.startsWith('demo-jwt-token-')) {
        return res.status(200).json({
          success: true,
          valid: true,
          user: {
            id: 'demo-user',
            name: '演示用户',
            role: 'hotel-manager'
          }
        });
      } else {
        return res.status(401).json({
          success: false,
          valid: false,
          message: 'Token无效'
        });
      }
    }

    return res.status(400).json({
      success: false,
      message: '不支持的操作'
    });
  }

  // GET请求返回认证信息
  res.status(200).json({
    service: 'Authentication Service',
    version: '1.1.0',
    availableActions: ['login', 'verify'],
    demoCredentials: {
      username: 'demo',
      password: 'demo123'
    }
  });
}