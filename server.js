import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import path from 'path'
import { fileURLToPath } from 'url'

// 获取当前文件的目录路径（ES Module环境）
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 5000

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
