import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

// 获取当前文件的目录路径（ES Module环境）
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 5000

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

// 配置代理中间件 - 解决跨域问题
// 代理新浪财经API
app.use('/api/sina', createProxyMiddleware({
  target: 'https://hq.sinajs.cn',
  changeOrigin: true,
  pathRewrite: { '^/api/sina': '' },
  headers: {
    'Referer': 'https://finance.sina.com.cn/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  }
}))

// 代理腾讯财经API（获取K线数据）
app.use('/api/qq', createProxyMiddleware({
  target: 'https://web.ifzq.gtimg.cn',
  changeOrigin: true,
  pathRewrite: { '^/api/qq': '' },
  headers: {
    'Referer': 'https://stockapp.finance.qq.com/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  }
}))

// 代理腾讯搜索API
app.use('/api/search', createProxyMiddleware({
  target: 'https://smartbox.gtimg.cn',
  changeOrigin: true,
  pathRewrite: { '^/api/search': '' },
  headers: {
    'Referer': 'https://stockapp.finance.qq.com/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  }
}))

// 代理腾讯行情API
app.use('/api/qqquote', createProxyMiddleware({
  target: 'https://qt.gtimg.cn',
  changeOrigin: true,
  pathRewrite: { '^/api/qqquote': '' },
  headers: {
    'Referer': 'https://stockapp.finance.qq.com/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  }
}))

// 代理同花顺公司页
app.use('/api/ths', createProxyMiddleware({
  target: 'https://stockpage.10jqka.com.cn',
  changeOrigin: true,
  pathRewrite: { '^/api/ths': '' },
  onProxyReq: (proxyReq) => {
    proxyReq.removeHeader('origin')
  },
  headers: {
    'Referer': 'https://stockpage.10jqka.com.cn/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  }
}))

// 代理同花顺基础财务页（A股财务 iframe）
app.use('/api/ths-basic', createProxyMiddleware({
  target: 'https://basic.10jqka.com.cn',
  changeOrigin: true,
  followRedirects: true,
  pathRewrite: { '^/api/ths-basic': '' },
  onProxyReq: (proxyReq) => {
    proxyReq.removeHeader('origin')
  },
  headers: {
    'Referer': 'https://stockpage.10jqka.com.cn/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  }
}))

// 直连抓取同花顺A股财务页，避免浏览器重定向导致CORS
app.get('/api/ths-basic-html/*', async (req, res) => {
  const path = req.originalUrl.replace(/^\/api\/ths-basic-html/, '')
  if (!path || path === '/') {
    res.status(400).send('Missing finance path')
    return
  }

  const match = path.match(/^\/([^/]+)/)
  const symbol = match ? match[1] : ''
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Referer': symbol
      ? `https://stockpage.10jqka.com.cn/${symbol}/finance/`
      : 'https://stockpage.10jqka.com.cn/'
  }

  try {
    const targetUrl = `https://basic.10jqka.com.cn${path}`
    const result = await fetchWithRedirects(targetUrl, headers)
    if (result.headers['content-type']) {
      res.set('Content-Type', result.headers['content-type'])
    }
    res.status(result.status || 200).send(result.body)
  } catch (error) {
    res.status(502).send('Proxy failed')
  }
})

// 配置静态文件服务 - 提供dist目录下的文件
app.use(express.static(path.join(__dirname, 'dist')))

// 处理SPA路由 - 所有未匹配的路由都返回index.html
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 服务器已启动！`)
  console.log(`\n访问地址: http://localhost:${PORT}`)
  console.log(`\n按 Ctrl+C 停止服务器\n`)
})
