import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import http from 'node:http'
import https from 'node:https'

const fetchWithRedirects = (url, headers, depth = 0) => new Promise((resolve, reject) => {
  const client = url.startsWith('https') ? https : http
  const req = client.request(url, { method: 'GET', headers }, (res) => {
    const status = res.statusCode || 200
    const location = res.headers.location
    if (status >= 300 && status < 400 && location && depth < 5) {
      const nextUrl = new URL(location, url).toString()
      res.resume()
      resolve(fetchWithRedirects(nextUrl, headers, depth + 1))
      return
    }

    const chunks = []
    res.on('data', (chunk) => chunks.push(chunk))
    res.on('end', () => {
      resolve({
        status,
        headers: res.headers,
        body: Buffer.concat(chunks)
      })
    })
  })
  req.on('error', reject)
  req.end()
})

const attachBasicHtmlProxy = (server) => {
  server.middlewares.use('/api/ths-basic-html', async (req, res) => {
    const rawUrl = req.originalUrl || req.url || ''
    let path = rawUrl.replace(/^\/api\/ths-basic-html/, '')
    if (path.includes('#')) {
      path = path.split('#')[0]
    }
    if (!path || path === '/') {
      res.statusCode = 400
      res.end('Missing finance path')
      return
    }

    const symbolMatch = path.match(/^\/([^/]+)/)
    const symbol = symbolMatch ? symbolMatch[1] : ''
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Referer': symbol
        ? `https://stockpage.10jqka.com.cn/${symbol}/finance/`
        : 'https://stockpage.10jqka.com.cn/'
    }

    try {
      const targetUrl = `https://basic.10jqka.com.cn${path}`
      const result = await fetchWithRedirects(targetUrl, headers)
      res.statusCode = result.status || 200
      if (result.headers['content-type']) {
        res.setHeader('Content-Type', result.headers['content-type'])
      }
      res.end(result.body)
    } catch (error) {
      res.statusCode = 502
      res.end('Proxy failed')
    }
  })
}

const basicHtmlProxyPlugin = () => ({
  name: 'basic-html-proxy',
  configureServer(server) {
    attachBasicHtmlProxy(server)
  },
  configurePreviewServer(server) {
    attachBasicHtmlProxy(server)
  }
})

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
  },
  '/api/ths': {
    target: 'https://stockpage.10jqka.com.cn',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/ths/, ''),
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('origin')
      })
    },
    headers: {
      'Referer': 'https://stockpage.10jqka.com.cn/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  },
  '/api/ths-basic': {
    target: 'https://basic.10jqka.com.cn',
    changeOrigin: true,
    followRedirects: true,
    rewrite: (path) => path.replace(/^\/api\/ths-basic/, ''),
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('origin')
      })
    },
    headers: {
      'Referer': 'https://stockpage.10jqka.com.cn/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  }
}

export default defineConfig({
  plugins: [vue(), basicHtmlProxyPlugin()],
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
