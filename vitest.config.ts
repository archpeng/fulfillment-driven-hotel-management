/// <reference types="vitest" />
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  // 测试配置
  test: {
    // 全局测试设置
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup/test-setup.ts'],
    
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      
      // 覆盖率阈值（符合CLAUDE.md要求）
      thresholds: {
        statements: 90,   // 语句覆盖率≥90%
        branches: 85,     // 分支覆盖率≥85%
        functions: 95,    // 函数覆盖率≥95%
        lines: 90        // 行覆盖率≥90%
      },
      
      // 包含和排除的文件
      include: [
        'src/**/*.ts',
        'src/**/*.tsx'
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/tests/**',
        'node_modules/**'
      ]
    },
    
    // 测试文件匹配模式
    include: [
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/__tests__/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    
    // 测试超时设置
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // 并发设置
    threads: true,
    maxThreads: 4,
    
    // 监听模式配置
    watch: false,
    
    // 报告器配置
    reporter: ['verbose', 'html']
  },
  
  // 构建配置
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@tests': resolve(__dirname, 'tests')
    }
  },
  
  // 定义全局常量
  define: {
    __TEST__: true,
    __VERSION__: JSON.stringify(process.env.npm_package_version || '1.1.0')
  }
})