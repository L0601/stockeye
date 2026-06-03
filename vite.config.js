import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'url'
import http from 'http'
import https from 'https'
import { Readable } from 'node:stream'

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

// 读取请求体（用于转发 POST /chat/completions）
const readReqBody = (req) => new Promise((resolve) => {
  const chunks = []
  req.on('data', (chunk) => chunks.push(chunk))
  req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined))
})

// AI 透传代理：目标地址由 x-ai-target 头给出，转发 method/body/Authorization 并流式回传
// 解决浏览器直连大模型端点的跨域问题；目标任意，故不能用固定映射
const attachAiProxy = (server) => {
  server.middlewares.use('/api/ai-proxy', async (req, res) => {
    const target = req.headers['x-ai-target']
    if (!target || !/^https?:\/\//i.test(target)) {
      res.statusCode = 400
      res.end('Missing or invalid x-ai-target')
      return
    }
    try {
      const headers = {}
      if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization']
      let body
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        headers['Content-Type'] = req.headers['content-type'] || 'application/json'
        body = await readReqBody(req)
      }
      const upstream = await fetch(target, { method: req.method, headers, body })
      res.statusCode = upstream.status
      const ct = upstream.headers.get('content-type')
      if (ct) res.setHeader('Content-Type', ct)
      res.setHeader('Cache-Control', 'no-store')
      if (upstream.body) Readable.fromWeb(upstream.body).pipe(res)
      else res.end()
    } catch (err) {
      res.statusCode = 502
      res.end(`AI proxy error: ${err.message}`)
    }
  })
}

const aiProxyPlugin = () => ({
  name: 'ai-proxy',
  configureServer(server) {
    attachAiProxy(server)
  },
  configurePreviewServer(server) {
    attachAiProxy(server)
  }
})

// 代理配置（server和preview共用）
const proxyConfig = {
  '/api/yahoo': {
    target: 'https://query1.finance.yahoo.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  },
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
  plugins: [vue(), basicHtmlProxyPlugin(), aiProxyPlugin()],
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
