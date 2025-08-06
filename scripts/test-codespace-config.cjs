#!/usr/bin/env node

/**
 * GitHub Codespaces 配置测试脚本
 * 验证所有必需的配置文件是否存在且正确
 */

const fs = require('fs');
const path = require('path');

const requiredFiles = [
  '.devcontainer/devcontainer.json',
  '.devcontainer/Dockerfile', 
  '.devcontainer/docker-compose.yml',
  '.devcontainer/setup.sh',
  '.devcontainer/README.md',
  'CODESPACES_GUIDE.md'
];

const requiredPorts = [3000, 3001, 5984, 6379, 8080];
const requiredExtensions = [
  'dbaeumer.vscode-eslint',
  'esbenp.prettier-vscode',
  'ms-vscode.vscode-typescript-next',
  'statelyai.stately-vscode'
];

console.log('🔍 检查 GitHub Codespaces 配置...\n');

let allTestsPassed = true;

// 检查必需文件
console.log('📁 检查必需文件:');
requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, '..', file));
  const status = exists ? '✅' : '❌';
  console.log(`  ${status} ${file}`);
  if (!exists) allTestsPassed = false;
});

// 检查devcontainer.json配置
console.log('\n⚙️ 检查devcontainer.json配置:');
try {
  const devcontainerPath = path.join(__dirname, '..', '.devcontainer/devcontainer.json');
  const devcontainerContent = fs.readFileSync(devcontainerPath, 'utf8');
  const config = JSON.parse(devcontainerContent);
  
  // 检查端口转发
  const configuredPorts = config.forwardPorts || [];
  requiredPorts.forEach(port => {
    const isConfigured = configuredPorts.includes(port);
    const status = isConfigured ? '✅' : '❌';
    console.log(`  ${status} Port ${port} forwarding`);
    if (!isConfigured) allTestsPassed = false;
  });
  
  // 检查VS Code扩展
  const extensions = config.customizations?.vscode?.extensions || [];
  requiredExtensions.forEach(ext => {
    const isConfigured = extensions.includes(ext);
    const status = isConfigured ? '✅' : '❌';
    console.log(`  ${status} Extension: ${ext}`);
    if (!isConfigured) allTestsPassed = false;
  });
  
  // 检查资源要求
  const hostRequirements = config.hostRequirements;
  if (hostRequirements && hostRequirements.cpus >= 4 && hostRequirements.memory === '8gb') {
    console.log('  ✅ 性能配置: 4+ CPU, 8GB RAM');
  } else {
    console.log('  ⚠️  性能配置未优化');
  }
  
} catch (error) {
  console.log('  ❌ devcontainer.json 解析失败:', error.message);
  allTestsPassed = false;
}

// 检查Docker Compose配置
console.log('\n🐳 检查Docker Compose配置:');
try {
  const composePath = path.join(__dirname, '..', '.devcontainer/docker-compose.yml');
  const composeContent = fs.readFileSync(composePath, 'utf8');
  
  const requiredServices = ['couchdb', 'redis'];
  requiredServices.forEach(service => {
    const hasService = composeContent.includes(`${service}:`);
    const status = hasService ? '✅' : '❌';
    console.log(`  ${status} Service: ${service}`);
    if (!hasService) allTestsPassed = false;
  });
  
} catch (error) {
  console.log('  ❌ docker-compose.yml 读取失败:', error.message);
  allTestsPassed = false;
}

// 检查setup.sh权限
console.log('\n🔧 检查setup脚本:');
try {
  const setupPath = path.join(__dirname, '..', '.devcontainer/setup.sh');
  const stats = fs.statSync(setupPath);
  const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
  const status = isExecutable ? '✅' : '❌';
  console.log(`  ${status} setup.sh 可执行权限`);
  if (!isExecutable) {
    console.log('    💡 运行: chmod +x .devcontainer/setup.sh');
    allTestsPassed = false;
  }
} catch (error) {
  console.log('  ❌ setup.sh 检查失败:', error.message);
  allTestsPassed = false;
}

// 输出结果
console.log('\n' + '='.repeat(50));
if (allTestsPassed) {
  console.log('🎉 所有配置检查通过！');
  console.log('\n🚀 下一步操作:');
  console.log('1. 确保更改已推送到 GitHub');
  console.log('2. 访问您的仓库并创建 Codespace');
  console.log('3. 等待环境初始化完成');
  console.log('4. 运行 npm run dev 开始开发');
} else {
  console.log('❌ 配置检查失败，请修复上述问题');
  process.exit(1);
}

console.log('\n📖 详细指南: 查看 CODESPACES_GUIDE.md');
console.log('🔗 仓库地址: https://github.com/archpeng/fulfillment-driven-hotel-management');