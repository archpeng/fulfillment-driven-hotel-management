import { defineConfig } from 'vite'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages部署配置
  base: process.env.NODE_ENV === 'production' 
    ? '/fulfillment-driven-hotel-management/' 
    : './',
  
  // 构建配置
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    
    // 构建优化
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        // 资源文件命名
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    },
    
    // 性能配置
    chunkSizeWarningLimit: 1000,
    
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  
  // 开发服务器配置
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    open: true
  },
  
  // 路径解析
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@tests': resolve(__dirname, 'tests')
    }
  },
  
  // 环境变量配置
  define: {
    __VERSION__: JSON.stringify(process.env.npm_package_version || '1.1.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  
  // 预构建优化
  optimizeDeps: {
    include: ['xstate', 'rxdb']
  }
})