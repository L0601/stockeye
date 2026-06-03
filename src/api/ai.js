// 兼容 OpenAI 接口的大模型客户端
// 设计：IO（fetch/axios）与纯算法（SSE 解析）分离，纯函数单独导出便于单测
import axios from 'axios'

// 同源透传代理路径：浏览器直连大模型端点会因目标缺少 CORS 头被拦截，
// 故统一走 /api/ai-proxy（dev/Cloudflare/Vercel/自托管均已实现），真实目标放在 x-ai-target 头
const AI_PROXY_PATH = '/api/ai-proxy'

// 拼接 baseUrl 与路径：去掉 baseUrl 尾部斜杠和 path 头部斜杠，避免出现 // 或缺斜杠
export function buildUrl(baseUrl, path) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const tail = String(path || '').replace(/^\/+/, '')
  return `${base}/${tail}`
}

// 构造经代理的请求信息：返回同源 url 与需透传的头
// - x-ai-target：真实目标地址，由代理转发
// - Authorization：apiKey 为空时不带（对应无需鉴权的服务）
export function buildProxyRequest({ baseUrl, apiKey }, path) {
  const headers = { 'x-ai-target': buildUrl(baseUrl, path) }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  return { url: AI_PROXY_PATH, headers }
}

// 拉取模型列表：成功返回模型 id 数组；失败或空列表抛错，供上层判定「配置有问题」
export async function fetchModels({ baseUrl, apiKey }) {
  const { url, headers } = buildProxyRequest({ baseUrl, apiKey }, 'models')
  const resp = await axios.get(url, { timeout: 10000, headers })
  // 兼容 { data: [{id}] } 与直接数组两种返回结构
  const list = Array.isArray(resp.data) ? resp.data : resp.data?.data
  const ids = (list || [])
    .map(item => (typeof item === 'string' ? item : item?.id))
    .filter(Boolean)
  if (ids.length === 0) {
    throw new Error('未获取到任何模型')
  }
  return ids
}

// 纯函数：解析单条 SSE data 内容，返回 { done, delta }
// - '[DONE]' → 结束标记
// - 正常 chunk → 提取 choices[0].delta.content
// - 非法 JSON → 不抛错，返回空 delta（容错半包/心跳）
export function parseSSEData(dataStr) {
  const text = String(dataStr || '').trim()
  if (text === '[DONE]') return { done: true, delta: '' }
  if (!text) return { done: false, delta: '' }
  try {
    const json = JSON.parse(text)
    const delta = json?.choices?.[0]?.delta?.content || ''
    return { done: false, delta }
  } catch {
    return { done: false, delta: '' }
  }
}

// 纯函数：按空行（\n\n）切分 SSE 缓冲区，返回完整事件数组与尾部残留
// 残留 rest 用于拼接下一个网络包，保证半包不丢字符
export function splitSSEBuffer(buffer) {
  const text = String(buffer || '')
  const parts = text.split(/\r?\n\r?\n/)
  const rest = parts.pop() ?? ''
  return { events: parts, rest }
}

// 从一个完整 SSE 事件块中取出 data: 行内容（可能多行 data:）
function extractData(eventBlock) {
  return eventBlock
    .split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trimStart())
    .join('\n')
}

// 流式对话补全：POST /chat/completions (stream:true)，逐块回调 onDelta，返回完整文本
// 用 fetch 而非 axios，因为需要读取 ReadableStream；支持 AbortSignal 取消
export async function streamChatCompletion({ baseUrl, apiKey, model }, messages, { onDelta, signal } = {}) {
  const { url, headers } = buildProxyRequest({ baseUrl, apiKey }, 'chat/completions')
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ model, messages, stream: true }),
    signal
  })
  if (!resp.ok || !resp.body) {
    throw new Error(`请求失败：${resp.status}`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let full = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const { events, rest } = splitSSEBuffer(buffer)
    buffer = rest
    for (const block of events) {
      const data = extractData(block)
      if (!data) continue
      const { done: finished, delta } = parseSSEData(data)
      if (finished) return full
      if (delta) {
        full += delta
        onDelta?.(delta)
      }
    }
  }
  return full
}
