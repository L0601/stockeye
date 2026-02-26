import https from 'node:https'
import http from 'node:http'

const PROXY_MAP = {
  sina:             { target: 'https://hq.sinajs.cn',            referer: 'https://finance.sina.com.cn/' },
  qq:               { target: 'https://web.ifzq.gtimg.cn',       referer: 'https://stockapp.finance.qq.com/' },
  search:           { target: 'https://smartbox.gtimg.cn',        referer: 'https://stockapp.finance.qq.com/' },
  qqquote:          { target: 'https://qt.gtimg.cn',             referer: 'https://stockapp.finance.qq.com/' },
  ths:              { target: 'https://stockpage.10jqka.com.cn', referer: 'https://stockpage.10jqka.com.cn/' },
  'ths-basic':      { target: 'https://basic.10jqka.com.cn',     referer: 'https://stockpage.10jqka.com.cn/' },
  'ths-basic-html': { target: 'https://basic.10jqka.com.cn',     referer: 'https://stockpage.10jqka.com.cn/', followRedirects: true },
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
const SKIP_HEADERS = new Set(['transfer-encoding', 'connection'])

function doRequest(url, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const client = parsed.protocol === 'https:' ? https : http
    const req = client.request(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'GET', headers },
      (res) => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
      }
    )
    req.on('error', reject)
    req.end()
  })
}

async function fetchWithRedirects(url, headers, depth = 0) {
  if (depth >= 5) throw new Error('Too many redirects')
  const res = await doRequest(url, headers)
  if (res.status >= 300 && res.status < 400 && res.headers.location) {
    return fetchWithRedirects(new URL(res.headers.location, url).toString(), headers, depth + 1)
  }
  return res
}

export default async function handler(req, res) {
  const [urlPath, queryString] = (req.url || '').split('?')
  const segments = urlPath.replace(/^\/api\//, '').split('/').filter(Boolean)
  const service = segments[0]
  const config = PROXY_MAP[service]

  if (!config) {
    res.statusCode = 404
    return res.end('Unknown service')
  }

  const hasTrailingSlash = urlPath.endsWith('/')
  const restPath = segments.slice(1).join('/') + (hasTrailingSlash ? '/' : '')
  const targetUrl = `${config.target}/${restPath}${queryString ? `?${queryString}` : ''}`
  const headers = { 'User-Agent': UA, 'Referer': config.referer }

  try {
    const response = config.followRedirects
      ? await fetchWithRedirects(targetUrl, headers)
      : await doRequest(targetUrl, headers)

    res.statusCode = response.status
    for (const [key, value] of Object.entries(response.headers)) {
      if (!SKIP_HEADERS.has(key.toLowerCase())) res.setHeader(key, value)
    }
    res.end(response.body)
  } catch (err) {
    res.statusCode = 502
    res.end(`Proxy error: ${err.message}`)
  }
}
