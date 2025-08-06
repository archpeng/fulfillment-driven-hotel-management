// 测试SaaS开发环境的完整性
console.log('🚀 SaaS开发环境测试开始...\n');

// 测试Node.js版本
console.log('📋 Node.js版本:', process.version);
console.log('📋 工作目录:', process.cwd());
console.log('📋 环境变量 NODE_ENV:', process.env.NODE_ENV);

// 测试目录结构
const fs = require('fs');
const path = require('path');

const requiredDirs = [
    'src/domain',
    'src/xstate', 
    'src/database',
    'src/components',
    'tests/unit',
    'tests/integration'
];

console.log('\n📁 检查项目目录结构:');
requiredDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
        console.log(`  ✅ ${dir}`);
    } else {
        console.log(`  ❌ ${dir} - 不存在`);
    }
});

// 测试配置文件
const configFiles = [
    'package.json',
    'CLAUDE.md',
    '.env.example'
];

console.log('\n📝 检查配置文件:');
configFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ❌ ${file} - 不存在`);
    }
});

console.log('\n🎉 SaaS开发环境测试完成！');
console.log('\n💡 下一步:');
console.log('1. 配置 .env 文件');
console.log('2. 运行: claude auth (配置API密钥)');
console.log('3. 开始开发: claude "帮我创建用户认证系统"');