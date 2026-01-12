import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 代理配置（server和preview共用）
const proxyConfig = {
  '/api/sina': {
    target: 'https://hq.sinajs.cn',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/sina/, ''),
    headers: {
      'Referer': 'https://finance.sina.com.cn/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  },
  '/api/qq': {
    target: 'https://web.ifzq.gtimg.cn',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/qq/, ''),
    headers: {
      'Referer': 'https://stockapp.finance.qq.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  },
  '/api/search': {
    target: 'https://smartbox.gtimg.cn',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/search/, ''),
    headers: {
      'Referer': 'https://stockapp.finance.qq.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  },
  '/api/qqquote': {
    target: 'https://qt.gtimg.cn',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/qqquote/, ''),
    headers: {
      'Referer': 'https://stockapp.finance.qq.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  }
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3000,
    open: true,
    proxy: proxyConfig
  },
  preview: {
    port: 4173,
    open: true,
    proxy: proxyConfig
  }
})
