const PROXY_MAP = {
  sina:             { target: 'https://hq.sinajs.cn',            referer: 'https://finance.sina.com.cn/' },
  qq:               { target: 'https://web.ifzq.gtimg.cn',       referer: 'https://stockapp.finance.qq.com/' },
  search:           { target: 'https://smartbox.gtimg.cn',        referer: 'https://stockapp.finance.qq.com/' },
  qqquote:          { target: 'https://qt.gtimg.cn',             referer: 'https://stockapp.finance.qq.com/' },
  ths:              { target: 'https://stockpage.10jqka.com.cn', referer: 'https://stockpage.10jqka.com.cn/' },
  'ths-basic':      { target: 'https://basic.10jqka.com.cn',     referer: 'https://stockpage.10jqka.com.cn/' },
  'ths-basic-html': { target: 'https://basic.10jqka.com.cn',     referer: 'https://stockpage.10jqka.com.cn/', followRedirects: true },
  yahoo:            { target: 'https://query1.finance.yahoo.com', referer: 'https://finance.yahoo.com/' },
  eastmoney:        { target: 'https://datacenter-web.eastmoney.com', referer: 'https://data.eastmoney.com/' },
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
const SKIP_HEADERS = new Set(['transfer-encoding', 'connection', 'etag', 'last-modified', 'expires', 'cache-control'])

async function fetchWithRedirects(url, headers, depth = 0) {
  if (depth >= 5) throw new Error('Too many redirects')
  const res = await fetch(url, { headers, redirect: 'manual' })
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location')
    if (location) return fetchWithRedirects(new URL(location, url).toString(), headers, depth + 1)
  }
  return res
}

// AI 透传代理：目标地址由 x-ai-target 头给出（baseUrl 用户任意填，不能用固定映射）
// 转发 method/body/Authorization 并流式回传，解决浏览器直连大模型端点的跨域问题
async function handleAiProxy(request) {
  const target = request.headers.get('x-ai-target')
  if (!target || !/^https?:\/\//i.test(target)) {
    return new Response('Missing or invalid x-ai-target', { status: 400 })
  }
  const headers = {}
  const auth = request.headers.get('authorization')
  if (auth) headers['Authorization'] = auth
  const init = { method: request.method, headers }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    headers['Content-Type'] = request.headers.get('content-type') || 'application/json'
    init.body = await request.text()
  }
  try {
    const upstream = await fetch(target, init)
    const resHeaders = new Headers()
    const ct = upstream.headers.get('content-type')
    if (ct) resHeaders.set('Content-Type', ct)
    resHeaders.set('Cache-Control', 'no-store')
    return new Response(upstream.body, { status: upstream.status, headers: resHeaders })
  } catch (err) {
    return new Response(`AI proxy error: ${err.message}`, { status: 502 })
  }
}

export async function onRequest({ request }) {
  const { pathname, search } = new URL(request.url)
  const segments = pathname.replace(/^\/api\//, '').split('/').filter(Boolean)
  const service = segments[0]

  if (service === 'ai-proxy') return handleAiProxy(request)

  const proxyConfig = PROXY_MAP[service]
  if (!proxyConfig) return new Response('Unknown service', { status: 404 })

  const restPath = segments.slice(1).join('/') + (pathname.endsWith('/') ? '/' : '')
  const targetUrl = `${proxyConfig.target}/${restPath}${search}`
  const headers = { 'User-Agent': UA, 'Referer': proxyConfig.referer, 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }

  try {
    const response = proxyConfig.followRedirects
      ? await fetchWithRedirects(targetUrl, headers)
      : await fetch(targetUrl, { headers })

    if (response.status === 304) {
      return new Response('', { status: 200, headers: { 'Cache-Control': 'no-store' } })
    }

    const resHeaders = new Headers()
    for (const [key, value] of response.headers.entries()) {
      if (!SKIP_HEADERS.has(key.toLowerCase())) resHeaders.set(key, value)
    }
    resHeaders.set('Cache-Control', 'no-store')

    return new Response(response.body, { status: response.status, headers: resHeaders })
  } catch (err) {
    return new Response(`Proxy error: ${err.message}`, { status: 502 })
  }
}
